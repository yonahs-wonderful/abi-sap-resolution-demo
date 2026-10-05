import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const key='abi-sap-tap-replacements-v1';
const fixture=JSON.parse(await readFile(new URL('./sample-tap-replacement.json',import.meta.url),'utf8'));
export async function testTapReplacement(context,base){
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  const open=p=>p.goto(base+'tap-replacement.html?account=10004912');
  const read=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'[]'),key);
  const save=p=>p.getByRole('button',{name:'Save',exact:true}).click();
  async function fill(p,reference='TAP-001'){
    for(const [id,value]of Object.entries({'approval-reference':reference,'created-by':fixture.created_by,quantity:'1','contact-name':fixture.contact_name,'contact-phone':fixture.contact_phone,'ship-to-address':fixture.ship_to_address,'damage-description':fixture.damage_description}))await p.locator('#'+id).fill(value);
    await p.locator('#replacement-reason').selectOption(fixture.replacement_reason);await p.locator('#shipping-method').selectOption(fixture.shipping_method);
  }
  await open(page);
  const before=await page.evaluate(()=>[localStorage.getItem('abi-sap-credit-limits-v1'),localStorage.getItem('abi-sap-transactions-v2')]);
  assert.equal(await page.locator('#customer-account').inputValue(),'10004912');
  assert.equal(await page.getByRole('button',{name:/approve|review/i}).count(),0);
  await save(page);assert.match(await page.locator('#status').innerText(),/quantity 1/);
  await fill(page);await page.locator('#quantity').fill('2');await save(page);assert.match(await page.locator('#status').innerText(),/quantity 1/);
  await page.locator('#quantity').fill('1');await page.locator('#contact-phone').fill('bad');await save(page);assert.match(await page.locator('#status').innerText(),/valid customer contact/);
  await page.locator('#contact-phone').fill(fixture.contact_phone);
  await page.getByRole('tab',{name:'Request history',exact:true}).click();await page.getByRole('tab',{name:'Replacement details',exact:true}).click();
  assert.equal(await page.locator('#damage-description').inputValue(),fixture.damage_description);
  await page.getByRole('button',{name:'Check',exact:true}).click();assert.equal((await read()).length,0);
  await page.screenshot({path:'test-results/tap-replacement-entry.png',fullPage:true});
  // Save directly in competing tabs: one reference must create exactly one request.
  const second=await context.newPage();second.on('dialog',d=>d.accept());await open(second);await fill(second);
  await Promise.all([save(page),save(second)]);
  await Promise.all([page,second].map(p=>p.waitForFunction(()=>/saved\.|already exists/.test(document.querySelector('#status').textContent))));
  const records=await read();assert.equal(records.length,1);const r=records[0];
  assert.equal(r.documentId,'5100010001');assert.equal(r.account,fixture.customer_account);assert.equal(r.material,fixture.material);assert.equal(r.quantity,1);assert.equal(r.amount,0);assert.equal(r.address,fixture.ship_to_address);assert.equal(r.damage,fixture.damage_description);assert.equal(r.documentStatus,'Open — delivery not created');
  await second.close();await page.reload();
  await page.getByRole('button',{name:'Display Request',exact:true}).click();await page.getByLabel('Document / reference',{exact:true}).fill('TAP-MISSING');await page.getByRole('button',{name:'Display',exact:true}).click();assert.match(await page.locator('#dialog-error').innerText(),/No replacement request found/);
  await page.getByLabel('Document / reference',{exact:true}).fill('TAP-001');await page.getByRole('button',{name:'Display',exact:true}).click();await page.locator('.saved-banner').waitFor();
  assert.equal(await page.locator('#quantity').inputValue(),'1');assert.equal(await page.locator('#approval-reference').getAttribute('readonly'),'');assert.equal(await page.getByRole('button',{name:'Save',exact:true}).isDisabled(),true);
  await page.screenshot({path:'test-results/tap-replacement-saved.png',fullPage:true});
  await page.getByRole('tab',{name:'Request history',exact:true}).click();assert.match(await page.locator('#history-panel').innerText(),/5100010001/);await page.getByRole('button',{name:'5100010001',exact:true}).click();
  await open(page);await fill(page);await save(page);await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('already exists'));assert.equal((await read()).length,1);
  await fill(page,'TAP-STORAGE');await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new Error('Browser storage unavailable');};});await save(page);await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Browser storage unavailable'));assert.equal(await page.locator('.saved-banner').count(),0);
  await page.reload();
  assert.deepEqual(await page.evaluate(()=>[localStorage.getItem('abi-sap-credit-limits-v1'),localStorage.getItem('abi-sap-transactions-v2')]),before,'Credit limits and sales documents remain unchanged');
  await page.getByLabel('Transaction code',{exact:true}).fill('/nFD32');await page.getByRole('button',{name:'Enter transaction',exact:true}).click();await page.waitForURL(/credit-increase.html\?account=10004521/);assert.match(await page.title(),/Customer Credit Management/);
  // Storage corruption cannot silently overwrite records or claim success.
  await open(page);await fill(page,'TAP-CORRUPT');await page.evaluate(k=>localStorage.setItem(k,'{}'),key);await save(page);await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('cannot be read'));assert.equal(await page.locator('.saved-banner').count(),0);await page.evaluate(({key,records})=>localStorage.setItem(key,JSON.stringify(records)),{key,records});
  await page.reload();await page.setViewportSize({width:1280,height:800});await page.evaluate(()=>document.body.style.zoom='0.8');await fill(page,'TAP-VIEWPORT');await page.screenshot({path:'test-results/tap-replacement-computer.png',fullPage:true});
  assert.deepEqual(errors,[]);await page.close();
  console.log('PASS: tap replacement validation, direct/concurrent save, receipt/history, duplicate protection, storage failure/corruption, computer viewport, and unchanged credit/memo records.');
}
