import assert from 'node:assert/strict';
const key='abi-sap-credit-limits-v1';
export async function testCreditIncrease(context,base){
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.accept());
  async function open(p=page,account='10004521'){await p.goto(base+'credit-increase.html?account='+account);}
  async function fill(p=page,reference='LIMIT-001',limit='40000'){
    await p.getByLabel('New credit limit *',{exact:true}).fill(limit);
    await p.getByLabel('Approval reference *',{exact:true}).fill(reference);
    await p.getByLabel('Changed by *',{exact:true}).fill('Demo Operator');
    await p.getByLabel('Reason for increase *',{exact:true}).fill('Approved seasonal increase for customer order volume.');
  }
  async function save(p=page){await p.getByRole('button',{name:'Save',exact:true}).click();}
  async function saved(p=page){await p.locator('.saved-banner').waitFor();}
  const read=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'[]'),key);
  await open();
  assert.equal(await page.locator('#current-limit').inputValue(),'25,000.00');
  assert.equal(await page.locator('#credit-exposure').inputValue(),'18,750.00');
  assert.equal(await page.getByRole('button',{name:/approve|review/i}).count(),0);
  await fill(page,'LIMIT-001','25000');await save();
  assert.match(await page.locator('#status').innerText(),/greater than/);
  await page.locator('#new-limit').fill('40000.001');await save();
  assert.match(await page.locator('#status').innerText(),/two decimal/);
  await page.locator('#new-limit').fill('40000');
  assert.equal(await page.locator('#increase-amount').inputValue(),'15,000.00');
  assert.equal(await page.locator('#available-after').inputValue(),'21,250.00');
  await page.getByRole('tab',{name:'Change documents',exact:true}).click();
  await page.getByRole('tab',{name:'Status / credit limit',exact:true}).click();
  assert.equal(await page.locator('#new-limit').inputValue(),'40000');
  await page.getByRole('button',{name:'Check',exact:true}).click();
  await page.screenshot({path:'test-results/credit-increase-entry.png',fullPage:true});
  const second=await context.newPage();second.on('dialog',d=>d.accept());await open(second);await fill(second);
  await Promise.all([save(),save(second)]);
  await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)||'[]').length===1,key);
  await Promise.all([page,second].map(p=>p.waitForFunction(()=>/saved\.|already exists/.test(document.querySelector('#status').textContent))));
  assert.equal((await read()).length,1);
  assert.equal(await page.locator('#dialog').isVisible(),false);
  await second.close();
  await page.reload();assert.equal(await page.locator('#current-limit').inputValue(),'40,000.00');
  await page.getByRole('button',{name:'Display Change',exact:true}).click();
  await page.getByLabel('Document / reference',{exact:true}).fill('LIMIT-001');
  await page.getByRole('button',{name:'Display',exact:true}).click();await saved();
  assert.equal(await page.locator('#current-limit').inputValue(),'25,000.00');
  assert.equal(await page.locator('#new-limit').inputValue(),'40000.00');
  assert.equal(await page.getByRole('button',{name:'Save',exact:true}).isDisabled(),true);
  await page.screenshot({path:'test-results/credit-increase-saved.png',fullPage:true});
  await page.getByRole('tab',{name:'Change documents',exact:true}).click();
  assert.match(await page.locator('#history-panel').innerText(),/7000010001/);
  // Stale windows must not overwrite a more recent approved increase.
  await open();await fill(page,'LIMIT-002','45000');
  const stale=await context.newPage();stale.on('dialog',d=>d.accept());await open(stale);await fill(stale,'LIMIT-003','50000');
  await save();await saved();await save(stale);
  await stale.waitForFunction(()=>document.querySelector('#status').textContent.includes('another window'));
  assert.equal((await read()).length,2);await stale.close();
  // Approval references are unique even across customer accounts.
  await open(page,'10004608');await fill(page,'LIMIT-001','30000');await save();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('already exists'));
  assert.equal((await read()).length,2);
  await fill(page,'LIMIT-STORAGE','30000');
  await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new Error('Browser storage unavailable');};});
  await save();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Browser storage unavailable'));
  assert.equal(await page.locator('.saved-banner').count(),0);
  await page.reload();
  // Transaction navigation preserves the original credit memo screen and records.
  await page.getByLabel('Transaction code',{exact:true}).fill('/nVA01');
  await page.getByRole('button',{name:'Enter transaction',exact:true}).click();
  await page.waitForURL(/index.html$/);
  assert.match(await page.title(),/Create Credit Memo Request/);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('abi-sap-transactions-v2')).length),5);
  await page.getByLabel('Transaction code',{exact:true}).fill('/nFD32');
  await page.getByRole('button',{name:'Enter transaction',exact:true}).click();
  await page.waitForURL(/credit-increase.html$/);
  assert.equal(await page.locator('#current-limit').inputValue(),'45,000.00');
  assert.deepEqual(errors,[]);await page.close();
  console.log('PASS: credit increase validation, direct save, concurrent deduplication, stale-change protection, reload/display/history, storage failure, and preserved credit memo navigation/data.');
}
