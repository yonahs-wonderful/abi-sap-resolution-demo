import assert from 'node:assert/strict';
import { testCreditIncrease } from './credit-tests.mjs';
import { testTapReplacement } from './tap-tests.mjs';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
const base=process.env.DEMO_TEST_URL||'http://127.0.0.1:4174/';
const server=process.env.DEMO_TEST_URL?null:spawn('python3',['-m','http.server','4174'],{stdio:'ignore'});
const key='abi-sap-transactions-v2';
let browser;
async function fillDocument(page,{invoice='9000124581',action='credit',reference='APPROVAL-001',quantity='3',price='24.50',reason='Short delivery'}={}){
  await page.goto(base+'?invoice='+invoice+'&transaction='+action);
  await page.getByLabel('Customer reference',{exact:true}).fill(reference);
  await page.getByLabel('Order reason',{exact:true}).selectOption(reason);
  await page.getByLabel('Created by',{exact:true}).fill('Demo Operator');
  if(action!=='note')await page.getByLabel('Order quantity',{exact:true}).fill(quantity);
  if(action==='credit')await page.getByLabel('Credit per case',{exact:true}).fill(price);
  await page.getByRole('tab',{name:/Header texts/}).click();
  await page.getByLabel('Header text / customer resolution',{exact:true}).fill('Record the customer resolution already approved in Wonderful.');
  await page.getByRole('tab',{name:'Item overview',exact:true}).click();
}
async function readRecords(page){return page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'[]'),key);}
async function waitSaved(page){await page.locator('.saved-banner').waitFor();}
try{
  if(server)for(let i=0;i<40;i++){try{await fetch(base);break;}catch{await new Promise(r=>setTimeout(r,100));}}
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:960}});
  context.setDefaultTimeout(10000);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  assert.match(await page.title(),/Create Credit Memo Request/);
  assert.equal(await page.getByRole('button',{name:/approve|review resolution/i}).count(),0);
  assert.equal(await page.locator('.metrics,.filters,#cases-body').count(),0,'External SAP must not contain a control tower');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  assert.match(await page.locator('#status').innerText(),/Select a reference billing/);
  await page.getByRole('button',{name:/Create with Reference/}).click();
  await page.getByLabel('Billing document',{exact:true}).fill('9999999999');
  await page.getByRole('button',{name:'Copy',exact:true}).click();
  assert.match(await page.locator('#dialog-error').innerText(),/does not exist/);
  await page.getByLabel('Billing document',{exact:true}).fill('9000124581');
  await page.getByRole('button',{name:'Copy',exact:true}).click();
  assert.equal(await page.getByLabel('Sold-to party',{exact:true}).inputValue(),'10004521');
  await page.getByLabel('Customer reference',{exact:true}).fill('APPROVAL-001');
  await page.getByLabel('Order reason',{exact:true}).selectOption('Short delivery');
  await page.getByLabel('Created by',{exact:true}).fill('Demo Operator');
  await page.getByLabel('Order quantity',{exact:true}).fill('21');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  assert.match(await page.locator('#status').innerText(),/between 1 and 20/);
  await page.getByLabel('Order quantity',{exact:true}).fill('3');
  await page.getByRole('button',{name:'Save',exact:true}).click();
  assert.match(await page.locator('#status').innerText(),/Header texts/);
  await page.getByLabel('Header text / customer resolution',{exact:true}).fill('Credit for three missing cases, approved in Wonderful.');
  await page.getByRole('tab',{name:'Item overview',exact:true}).click();
  assert.equal(await page.getByLabel('Order quantity',{exact:true}).inputValue(),'3','Tab changes preserve entries');
  assert.equal(await page.locator('#net-value').innerText(),'73.50 USD');
  const second=await context.newPage();await fillDocument(second);
  await Promise.all([page.getByRole('button',{name:'Save',exact:true}).click(),second.getByRole('button',{name:'Save',exact:true}).click()]);
  await page.waitForTimeout(300);
  let records=await readRecords(page);assert.equal(records.length,1,'Concurrent saves produce one document');
  assert.equal(records[0].amount,73.50);assert.equal(records[0].documentId,'6000010001');
  assert.equal(records[0].documentStatus,'Billing block — pending release');
  assert.equal(await page.locator('#dialog').isVisible(),false,'Save does not require a second approval/review');
  await second.close();
  await page.reload();
  await page.getByRole('button',{name:'Display Document',exact:true}).click();
  await page.getByLabel('Document / reference',{exact:true}).fill('APPROVAL-001');
  await page.getByRole('button',{name:'Display',exact:true}).click();
  await waitSaved(page);
  assert.match(await page.getByRole('heading',{level:1}).innerText(),/Display Credit Memo Request/);
  assert.equal(await page.getByLabel('Order quantity',{exact:true}).inputValue(),'3');
  assert.equal(await page.getByRole('button',{name:'Save',exact:true}).isDisabled(),true);
  await page.getByRole('tab',{name:'Document flow',exact:true}).click();
  assert.match(await page.locator('#tab-panel').innerText(),/6000010001/);
  await fillDocument(page,{invoice:'9000124623',action:'replacement',reference:'APPROVAL-001',quantity:'2',reason:'Damaged in transit'});
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('already exists'));
  assert.equal((await readRecords(page)).length,1);
  await page.getByLabel('Customer reference',{exact:true}).fill('APPROVAL-002');
  await page.getByRole('button',{name:'Save',exact:true}).click();await waitSaved(page);
  assert.match(await page.locator('.saved-banner').innerText(),/5000090001/);
  for(const scenario of [
    {invoice:'9000124556',action:'return',reference:'APPROVAL-003',quantity:'2',reason:'Incorrect material'},
    {invoice:'9000124519',action:'credit',reference:'APPROVAL-004',quantity:'1',price:'12.00',reason:'Pricing adjustment'},
    {invoice:'9000124637',action:'note',reference:'APPROVAL-005',reason:'Information provided'}
  ]){
    await fillDocument(page,scenario);await page.getByRole('button',{name:'Save',exact:true}).click();await waitSaved(page);
  }
  records=await readRecords(page);assert.equal(records.length,5);assert.equal(records.filter(r=>r.action==='credit').reduce((sum,r)=>sum+r.amount,0),85.50);
  assert.equal(records.find(r=>r.action==='return').documentStatus,'Open — returns delivery not created');
  assert.equal(records.find(r=>r.action==='note').quantity,0);
  // Editing then cancelling keeps persisted documents and warns about losing unsaved work.
  await fillDocument(page,{reference:'NOT-SAVED'});
  await page.getByRole('button',{name:'New document',exact:true}).click();
  assert.match(await page.locator('#dialog').innerText(),/Unsaved entries will be lost/);
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  assert.equal(await page.getByLabel('Customer reference',{exact:true}).inputValue(),'NOT-SAVED');
  // A browser storage error never produces a success receipt.
  const storagePage=await context.newPage();await fillDocument(storagePage,{reference:'STORAGE-FAILURE'});
  await storagePage.evaluate(()=>{Storage.prototype.setItem=()=>{throw new Error('Browser storage unavailable');};});
  await storagePage.getByRole('button',{name:'Save',exact:true}).click();
  await storagePage.waitForFunction(()=>document.querySelector('#status').textContent.includes('Browser storage unavailable'));
  assert.equal(await storagePage.locator('.saved-banner').count(),0);await storagePage.close();
  await mkdir('test-results',{recursive:true});
  await page.screenshot({path:'test-results/legacy-sap-entry.png',fullPage:true});
  await page.goto(base);
  await page.getByRole('button',{name:'Display Document',exact:true}).click();
  await page.getByLabel('Document / reference',{exact:true}).fill('6000010001');
  await page.getByRole('button',{name:'Display',exact:true}).click();await waitSaved(page);
  await page.screenshot({path:'test-results/legacy-sap-saved.png',fullPage:true});
  await testCreditIncrease(context,base);
  await testTapReplacement(context,base);
  assert.deepEqual(errors,[]);
  console.log('PASS: execution-only legacy UI, reference lookup, missing-field and quantity validation, direct Save, concurrent duplicate prevention, all five tasks, document display after reload, document flow, unsaved cancellation, and storage failure handling.');
}finally{await browser?.close();server?.kill();}
