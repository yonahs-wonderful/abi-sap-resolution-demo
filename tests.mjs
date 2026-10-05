import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

const remote=process.env.DEMO_TEST_URL;
const base=remote||'http://127.0.0.1:4174/';
const server=remote?null:spawn('python3',['-m','http.server','4174'],{stdio:'ignore'});
let browser;
try {
  if(server)for(let i=0;i<40;i++){try{await fetch(base);break;}catch{await new Promise(r=>setTimeout(r,100));}}
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  assert.equal(await page.locator('#cases-body tr').count(),5);
  await page.getByLabel('Search',{exact:true}).fill('9000124581');
  assert.equal(await page.locator('#cases-body tr').count(),1);
  assert.match(await page.locator('#cases-body').innerText(),/Riverside Market/);
  await page.getByRole('button',{name:'Open CS-100241',exact:true}).click();
  await page.getByRole('button',{name:'Review resolution',exact:true}).click();
  assert.equal(await page.locator('#dialog').isVisible(),false,'Empty mandatory fields must block review');
  await page.getByLabel('Resolved by',{exact:false}).fill('Demo Representative');
  await page.getByLabel('Resolution summary',{exact:false}).fill('Record the agreed credit for 3 missing cases, pending financial release.');
  await page.getByLabel('Affected quantity',{exact:false}).fill('21');
  await page.getByRole('button',{name:'Review resolution',exact:true}).click();
  assert.equal(await page.locator('#dialog').isVisible(),false,'Quantity exceeding invoice must be rejected');
  await page.getByLabel('Affected quantity',{exact:false}).fill('3');
  await page.getByRole('button',{name:'Review resolution',exact:true}).click();
  assert.match(await page.locator('#dialog').innerText(),/\$73\.50/);
  // Two tabs submit the same case concurrently. Exactly one persisted record wins.
  const second=await context.newPage();await second.goto(base+'?case=CS-100241');
  await second.getByLabel('Resolved by',{exact:false}).fill('Second Representative');
  await second.getByLabel('Resolution summary',{exact:false}).fill('Duplicate attempt from a second tab must not create another credit.');
  await second.getByRole('button',{name:'Review resolution',exact:true}).click();
  await Promise.all([page.getByRole('button',{name:'Save resolution',exact:true}).click(),second.getByRole('button',{name:'Save resolution',exact:true}).click()]);
  await page.waitForTimeout(200);
  let records=await page.evaluate(()=>JSON.parse(localStorage.getItem('abi-sap-demo-v1')).records);
  assert.equal(records.length,1);assert.equal(records[0].amount,73.5);assert.equal(records[0].status,'Pending release');
  const firstId=records[0].documentId;
  await page.reload();assert.match(await page.locator('main').innerText(),new RegExp(firstId));
  assert.equal(await page.locator('#resolution-form').count(),0,'Recorded cases cannot be submitted again');
  await second.close();
  await page.getByRole('button',{name:'Sales Documents',exact:true}).click();
  assert.match(await page.locator('main').innerText(),/Pending release/);
  await page.getByRole('button',{name:'Change Log',exact:true}).click();assert.match(await page.locator('main').innerText(),new RegExp(firstId));
  // Reject reuse of the same handoff reference on a different case.
  await page.goto(base+'?case=CS-100242');
  await page.getByLabel('Handoff reference',{exact:false}).fill('ABI-DEMO-100241');
  await page.getByLabel('Resolved by',{exact:false}).fill('Demo Representative');
  await page.getByLabel('Resolution summary',{exact:false}).fill('Request two replacements for damaged cases.');
  await page.getByRole('button',{name:'Review resolution',exact:true}).click();
  await page.getByRole('button',{name:'Save resolution',exact:true}).click();
  await page.locator('#save-error').waitFor({state:'visible'});
  assert.match(await page.locator('#save-error').innerText(),/already recorded/);
  await page.getByRole('button',{name:'Back to edit',exact:true}).click();
  await page.getByLabel('Handoff reference',{exact:false}).fill('ABI-DEMO-100242');
  await page.getByRole('button',{name:'Review resolution',exact:true}).click();
  await page.getByRole('button',{name:'Save resolution',exact:true}).click();
  await page.getByRole('heading',{name:'Resolution recorded',exact:true}).waitFor();
  assert.match(await page.locator('main').innerText(),/Awaiting fulfillment/);
  // Complete the remaining supported paths and verify totals and persistence.
  for(const id of ['CS-100243','CS-100244','CS-100245']){
    await page.goto(base+'?case='+id);
    await page.getByLabel('Resolved by',{exact:false}).fill('Demo Representative');
    await page.getByLabel('Resolution summary',{exact:false}).fill('Record the agreed demonstration resolution for '+id+'.');
    if(id==='CS-100245')assert.equal(await page.locator('#item-fields').isVisible(),false);
    await page.getByRole('button',{name:'Review resolution',exact:true}).click();
    await page.getByRole('button',{name:'Save resolution',exact:true}).click();
    await page.getByRole('heading',{name:'Resolution recorded',exact:true}).waitFor();
  }
  records=await page.evaluate(()=>JSON.parse(localStorage.getItem('abi-sap-demo-v1')).records);
  assert.equal(records.length,5);assert.equal(records.filter(r=>r.action==='credit').reduce((sum,r)=>sum+r.amount,0),85.5);
  assert.equal(records.find(r=>r.action==='note').quantity,0);
  assert.equal(records.find(r=>r.action==='return').status,'Awaiting collection');
  await page.getByRole('button',{name:'Demo Guide',exact:true}).click();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export records',exact:true}).click();
  assert.equal((await download).suggestedFilename(),'abi-sap-demo-records.json');
  await page.getByRole('button',{name:'Reset demo data',exact:true}).click();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('abi-sap-demo-v1')).records.length),5);
  await page.getByRole('button',{name:'Reset demo data',exact:true}).click();
  await page.locator('#confirm-reset').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('abi-sap-demo-v1')),null);
  await mkdir('test-results',{recursive:true});
  await page.screenshot({path:'test-results/worklist.png',fullPage:true});
  await page.goto(base+'?case=CS-100241');await page.screenshot({path:'test-results/resolution-form.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Mobile detail should not overflow');
  await page.screenshot({path:'test-results/mobile-form.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS: five resolution paths, required fields, invoice quantity limit, credit totals, concurrent saves, duplicate references, reload persistence, documents, history, export, reset and mobile layout.');
} finally {await browser?.close();server?.kill();}
