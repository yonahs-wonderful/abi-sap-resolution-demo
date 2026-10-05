import { invoices, documentTypes, reasons } from './data.js';

const STORAGE_KEY = 'abi-sap-transactions-v2';
const main = document.querySelector('#main');
const dialog = document.querySelector('#dialog');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatAmount = value => Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toLocaleDateString('en-CA');
let draft = createDraft();
let activeTab = 'items';
let displayed = null;
let saving = false;
let dirty = false;

function createDraft(action = 'credit') {
  return { action, invoice:'', account:'', customer:'', city:'', order:'', delivery:'', po:'', material:'', product:'', invoiceQuantity:0, reference:'', reason:'', quantity:'', unitPrice:'', summary:'', createdBy:'', documentDate:today() };
}
function getRecords() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const data = JSON.parse(raw);
  if (!Array.isArray(data) || data.some(r => typeof r.documentId !== 'string' || !documentTypes[r.action])) throw new Error('Saved document data could not be read. Contact the system administrator.');
  return data;
}
function setStatus(message, kind = 'info') {
  const status = document.querySelector('#status');
  status.replaceChildren();
  const icon = document.createElement('span'); icon.className = `status-icon ${kind}`; icon.textContent = {info:'i',success:'✓',error:'×',warning:'!'}[kind];
  const text = document.createElement('span'); text.textContent = message;
  status.append(icon, text); status.dataset.kind = kind;
}
function getInput(label, id, value, { readonly = false, size = '', type = 'text', description = '' } = {}) {
  return `<div class="field"><label for="${id}">${label}</label><input id="${id}" class="${size}" value="${esc(value)}" type="${type}" ${readonly || displayed ? 'readonly' : ''} maxlength="180">${description ? `<span class="description">${esc(description)}</span>` : ''}</div>`;
}
function capture() {
  if (displayed) return;
  const fields = {reference:'reference',reason:'reason',quantity:'quantity',unitPrice:'unit-price',summary:'header-text',createdBy:'created-by',documentDate:'document-date'};
  for (const [key,id] of Object.entries(fields)) { const input = document.getElementById(id); if (input) draft[key] = input.value; }
}
function render() {
  const type = documentTypes[draft.action];
  document.title = `${displayed ? 'Display' : 'Create'} ${type.name} — SAP AB1`;
  document.querySelector('#screen-title').textContent = `${displayed ? 'Display' : 'Create'} ${type.name}: Overview`;
  document.querySelector('#document-number').textContent = displayed ? `Document ${displayed.documentId}` : '';
  document.querySelector('#transaction-name').textContent = displayed ? 'VA03' : type.transaction;
  for (const id of ['save','save-text','create-reference','check']) document.getElementById(id).disabled = !!displayed || saving;
  main.innerHTML = `${displayed ? `<div class="saved-banner"><span class="status-icon success">✓</span><strong>${esc(type.name)} ${esc(displayed.documentId)}</strong><span>has been saved.</span><span class="doc-status">${esc(displayed.documentStatus)}</span></div>` : ''}
    <form class="transaction-form" id="transaction-form" novalidate>
      <fieldset class="group"><legend>Sales document</legend><div class="group-grid">
        <div class="field"><label for="document-type">Order type</label><select id="document-type" ${displayed ? 'disabled' : ''}>${Object.entries(documentTypes).map(([key,t])=>`<option value="${key}" ${key===draft.action?'selected':''}>${t.code} — ${t.name}</option>`).join('')}</select></div>
        ${getInput('Sales organization','sales-org','US01',{readonly:true,size:'short',description:'Anheuser-Busch USA'})}
        ${getInput('Distribution channel','distribution','10',{readonly:true,size:'short',description:'Wholesale'})}
        ${getInput('Division','division','01',{readonly:true,size:'short',description:'Beer'})}
      </div></fieldset>
      <fieldset class="group"><legend>Header data</legend><div class="group-grid">
        ${getInput('Sold-to party','sold-to',draft.account,{readonly:true,size:'mid',description:draft.customer})}
        ${getInput('Ship-to party','ship-to',draft.account,{readonly:true,size:'mid',description:draft.city})}
        ${getInput('Reference billing doc.','invoice',draft.invoice,{readonly:true,size:'mid'})}
        ${getInput('Customer PO number','customer-po',draft.po,{readonly:true,size:'mid'})}
        ${getInput('Customer reference','reference',draft.reference,{size:'long'})}
        ${getInput('Document date','document-date',draft.documentDate,{type:'date',size:'mid'})}
        <div class="field"><label for="reason">Order reason</label><select id="reason" ${displayed?'disabled':''}>${reasons.map(r=>`<option value="${esc(r)}" ${draft.reason===r?'selected':''}>${esc(r||'Select reason')}</option>`).join('')}</select></div>
        ${getInput('Currency','currency','USD',{readonly:true,size:'short',description:'US Dollar'})}
      </div></fieldset>
      <div class="tabs" role="tablist" aria-label="Document details"><button type="button" role="tab" data-tab="items" aria-controls="tab-panel" aria-selected="${activeTab==='items'}">Item overview</button><button type="button" role="tab" data-tab="texts" aria-controls="tab-panel" aria-selected="${activeTab==='texts'}">Header texts${draft.summary?'':' *'}</button><button type="button" role="tab" data-tab="flow" aria-controls="tab-panel" aria-selected="${activeTab==='flow'}">Document flow</button></div>
      <section class="tab-panel" id="tab-panel" role="tabpanel">${activeTab==='items'?renderItems():activeTab==='texts'?renderTexts():renderFlow()}</section>
      <div class="footer-fields">${getInput('Created by','created-by',draft.createdBy)}${getInput('Billing block','billing-block',draft.action==='credit'?'Pending release':'Not applicable',{readonly:true})}</div>
    </form>`;
  document.querySelector('#transaction-form').onsubmit = event => { event.preventDefault(); void saveDocument(); };
  document.querySelector('#document-type').onchange = event => { capture(); draft.action=event.target.value; dirty=true; render(); };
  document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{capture();activeTab=button.dataset.tab;render();});
  for (const input of main.querySelectorAll('input:not([readonly]),textarea:not([readonly]),select:not(:disabled)')) input.addEventListener('input',()=>{dirty=true;capture();updateTotal();});
}
function renderItems() {
  if (draft.action==='note') return '<div class="grid-toolbar"><strong>Customer contact</strong></div><p class="inline-note">Maintain the contact text on the Header texts tab. This document does not contain sales items.</p>';
  const credit=draft.action==='credit';
  return `<div class="grid-toolbar"><strong>All items</strong><span>${draft.invoice?'1':'0'} item(s)</span><span class="right">${draft.invoice?`Copied from billing document ${esc(draft.invoice)}`:'No reference document selected'}</span></div>
    <div class="table-scroll"><table><thead><tr><th></th><th>Itm</th><th>Material</th><th>Order quantity</th><th>Un</th><th>Description</th><th>${credit?'Credit / case':'Net price'}</th><th>Crcy</th><th>Net value</th><th>Plant</th></tr></thead><tbody>
    ${draft.invoice?`<tr><td class="row-number selected">▶</td><td>10</td><td>${esc(draft.material)}</td><td><input id="quantity" aria-label="Order quantity" type="number" min="1" max="${draft.invoiceQuantity}" step="1" class="item-input" value="${esc(draft.quantity)}" ${displayed?'readonly':''}></td><td>CS</td><td>${esc(draft.product)}</td><td><input id="unit-price" aria-label="Credit per case" type="number" min="0.01" max="10000" step="0.01" class="item-input" value="${credit?esc(draft.unitPrice):'0.00'}" ${displayed||!credit?'readonly':''}></td><td>USD</td><td id="line-total">${formatAmount(getTotal())}</td><td>US01</td></tr>`:''}
    ${Array.from({length:4},()=>'<tr class="ghost-row"><td class="row-number"></td>'+Array.from({length:9},()=>'<td>&nbsp;</td>').join('')+'</tr>').join('')}</tbody></table></div>
    <div class="grid-total"><span>Net value</span><strong id="net-value">${formatAmount(getTotal())} USD</strong></div>
    <div class="inline-note">${draft.invoice?`Reference quantity: ${draft.invoiceQuantity} CS. `:''}${credit?'Credit memo request is saved with a billing block.':'Subsequent processing is performed separately.'}</div>`;
}
function renderTexts() {
  return `<div class="text-layout"><div class="text-types"><span>Customer resolution</span></div><div class="text-editor"><label for="header-text">Header text / customer resolution</label><textarea id="header-text" maxlength="2000" ${displayed?'readonly':''}>${esc(draft.summary)}</textarea><div class="editor-footer"><span>Language: EN</span><span>Plain text · 2,000 characters maximum</span></div></div></div>`;
}
function renderFlow() {
  const rows=draft.invoice?[['Sales order',draft.order,'Completed'],['Outbound delivery',draft.delivery,'Goods issue posted'],['Billing document',draft.invoice,'Posted']]:[];
  if(displayed)rows.push([documentTypes[draft.action].name,displayed.documentId,displayed.documentStatus]);
  return `<div class="grid-toolbar"><strong>Document flow</strong></div><div class="table-scroll"><table><thead><tr><th>Document category</th><th>Document number</th><th>Status</th></tr></thead><tbody>${rows.map(([category,id,status])=>`<tr><td>${esc(category)}</td><td>${esc(id)}</td><td>${esc(status)}</td></tr>`).join('')||'<tr><td colspan="3">No reference document selected</td></tr>'}</tbody></table></div>${displayed?`<div class="status-row"><dl><dt>Customer reference</dt><dd>${esc(displayed.reference)}</dd><dt>Created at</dt><dd>${esc(new Date(displayed.savedAt).toLocaleString())}</dd></dl></div>`:''}`;
}
function getTotal() { return draft.action==='credit'?Math.round(Number(draft.quantity||0)*Number(draft.unitPrice||0)*100)/100:0; }
function updateTotal() {
  const line=document.querySelector('#line-total'),total=document.querySelector('#net-value');
  if(line)line.textContent=formatAmount(getTotal());if(total)total.textContent=`${formatAmount(getTotal())} USD`;
}
function showDialog(title, body, actions) {
  dialog.innerHTML=`<div class="dialog-title"><span>${esc(title)}</span><button type="button" id="dialog-close" aria-label="Close dialog">×</button></div><div class="dialog-body">${body}</div><div class="dialog-actions">${actions}</div>`;
  document.querySelector('#dialog-close').onclick=()=>dialog.close();dialog.showModal();
}
function referenceDialog() {
  capture();showDialog('Create with Reference',`<div class="field"><label for="reference-invoice">Billing document</label><input id="reference-invoice" value="${esc(draft.invoice)}" maxlength="10" inputmode="numeric" autofocus></div><div class="dialog-hint">Enter the billing document to copy its customer and material data.</div><p id="dialog-error" class="dialog-error" role="alert"></p>`,`<button id="copy-reference">Copy</button><button id="dialog-cancel">Cancel</button>`);
  document.querySelector('#dialog-cancel').onclick=()=>dialog.close();
  const copy=()=>{const value=document.querySelector('#reference-invoice').value.trim(),invoice=invoices.find(i=>i.invoice===value);
    if(!invoice){document.querySelector('#dialog-error').textContent=`Billing document ${value||'(blank)'} does not exist in this system.`;return;}
    const action=draft.action;draft={...createDraft(action),...invoice,invoiceQuantity:invoice.quantity,quantity:'',unitPrice:invoice.price};delete draft.caseId;
    displayed=null;dirty=true;activeTab='items';dialog.close();render();setStatus(`Data copied from billing document ${invoice.invoice}. Enter quantity, reason, customer reference and header text.`,'success');};
  document.querySelector('#copy-reference').onclick=copy;document.querySelector('#reference-invoice').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();copy();}};
}
function getValidationError() {
  if(!draft.invoice)return ['Select a reference billing document using Create with Reference.','create-reference'];
  if(!draft.reference.trim())return ['Enter a customer reference. Use the approval reference from Wonderful.','reference'];
  if(!draft.reason)return ['Enter an order reason.','reason'];
  if(!draft.createdBy.trim())return ['Enter the name or ID of the document creator.','created-by'];
  if(!/^\d{4}-\d{2}-\d{2}$/.test(draft.documentDate))return ['Enter a valid document date.','document-date'];
  if(draft.action!=='note'&&(!Number.isInteger(Number(draft.quantity))||Number(draft.quantity)<1||Number(draft.quantity)>draft.invoiceQuantity))return [`Order quantity must be a whole number between 1 and ${draft.invoiceQuantity} cases.`,'quantity'];
  if(draft.action==='credit'&&(!Number.isFinite(Number(draft.unitPrice))||Number(draft.unitPrice)<=0||Number(draft.unitPrice)>10000||Math.abs(Number(draft.unitPrice)*100-Math.round(Number(draft.unitPrice)*100))>0.000001))return ['Credit per case must be a positive USD amount with at most two decimal places.','unit-price'];
  if(draft.summary.trim().length<12)return ['Maintain a customer resolution of at least 12 characters in Header texts.','header-text'];
  return null;
}
function checkDocument() {
  capture();const error=getValidationError();if(error){if(error[1]==='header-text'){activeTab='texts';render();}else if(['quantity','unit-price'].includes(error[1])){activeTab='items';render();}setStatus(error[0],'error');document.getElementById(error[1])?.focus();return false;}
  setStatus('Document is complete. Save to create the sales document.','success');return true;
}
async function saveDocument() {
  if(displayed||saving||dialog.open)return;
  if(!checkDocument())return;
  saving=true;document.querySelector('#save').disabled=true;document.querySelector('#save-text').disabled=true;
  try{
    const persist=()=>{const records=getRecords();const reference=draft.reference.trim();const existing=records.find(r=>r.reference===reference);
      if(existing)throw new Error(`Customer reference already exists in document ${existing.documentId}. Use Display Document to verify it.`);
      const type=documentTypes[draft.action];let number=type.prefix+1;while(records.some(r=>r.documentId===String(number)))number++;
      const record={...draft,reference,summary:draft.summary.trim(),createdBy:draft.createdBy.trim(),quantity:draft.action==='note'?0:Number(draft.quantity),unitPrice:draft.action==='credit'?Number(draft.unitPrice):0,amount:getTotal(),documentId:String(number),documentStatus:type.status,savedAt:new Date().toISOString(),demo:true};
      localStorage.setItem(STORAGE_KEY,JSON.stringify([...records,record]));return record;};
    displayed=navigator.locks?await navigator.locks.request(STORAGE_KEY,persist):persist();draft={...displayed};dirty=false;activeTab='items';render();setStatus(`${documentTypes[draft.action].name} ${displayed.documentId} has been saved.`,'success');
  }catch(error){setStatus(error.message||'Document could not be saved. Check storage availability.','error');}
  finally{saving=false;document.querySelector('#save').disabled=!!displayed;document.querySelector('#save-text').disabled=!!displayed;}
}
function displayDialog() {
  showDialog('Display Sales Document',`<div class="field"><label for="find-document">Document / reference</label><input id="find-document" maxlength="180" autofocus></div><div class="dialog-hint">Enter an exact sales document number or customer reference.</div><p id="dialog-error" class="dialog-error" role="alert"></p>`,`<button id="open-document">Display</button><button id="dialog-cancel">Cancel</button>`);
  document.querySelector('#dialog-cancel').onclick=()=>dialog.close();
  const find=()=>{try{const query=document.querySelector('#find-document').value.trim();const record=getRecords().find(r=>r.documentId===query||r.reference===query);if(!record)throw new Error('No document found for this number or customer reference.');displayed=record;draft={...record};dirty=false;activeTab='items';dialog.close();render();setStatus(`Displaying ${documentTypes[record.action].name} ${record.documentId}.`);}catch(error){document.querySelector('#dialog-error').textContent=error.message;}};
  document.querySelector('#open-document').onclick=find;document.querySelector('#find-document').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();find();}};
}
function startNew(action=draft.action) {
  const reset=()=>{draft=createDraft(action);displayed=null;dirty=false;activeTab='items';render();setStatus('Create a sales document with reference to a billing document.');};
  if(dirty&&!displayed){showDialog('Exit transaction','<p>Unsaved entries will be lost. Continue?</p>','<button id="discard">Continue</button><button id="keep-editing">Cancel</button>');document.querySelector('#discard').onclick=()=>{dialog.close();reset();};document.querySelector('#keep-editing').onclick=()=>dialog.close();}else reset();
}
function executeCommand() {
  const code=document.querySelector('#command').value.trim().toUpperCase().replace(/^\/N/,'');
  if(code==='FD32')openCreditManagement();else if(code==='VA01')startNew('credit');else if(code==='VA03')displayDialog();else if(code==='ZCNOTE')startNew('note');else setStatus(`Transaction ${code} is not available in this demonstration system.`,'error');
}
function showHelp() {
  showDialog('SAP — Application Help',`<p>This is a legacy SAP GUI-style demonstration for executing customer resolutions. Review and approval take place in the separate Wonderful Control Tower application.</p><p>Use <strong>Create with Reference</strong>, maintain the header and item data, enter the resolution on <strong>Header texts</strong>, then <strong>Save</strong>. Use <strong>Display Document</strong> to verify an existing document by number or customer reference.</p><table class="help-table"><thead><tr><th>Billing document</th><th>Sold-to party</th><th>Customer</th></tr></thead><tbody>${invoices.map(i=>`<tr><td>${i.invoice}</td><td>${i.account}</td><td>${esc(i.customer)}</td></tr>`).join('')}</tbody></table><p class="help-footnote" style="margin-top:15px">All data is fictional. Saved documents remain in this browser only. ZCNOTE is a custom demo transaction. The layout is inspired by legacy SAP GUI; it is not a verified copy of Anheuser-Busch's internal system.</p>`,`<button id="help-close">Close</button>`);
  document.querySelector('#help-close').onclick=()=>dialog.close();
}
function openCreditManagement() {
  if(!dirty||displayed||confirm('Unsaved entries will be lost. Continue?'))location.href='credit-increase.html';
}
function openMenu(button) {
  const menu=document.querySelector('#menu');const menus={document:[['New',()=>startNew()],['Save',()=>void saveDocument()],['Display',displayDialog]],edit:[['Check document',checkDocument],['Cancel entry',()=>startNew()]],goto:[['Credit Line Increase (FD32)',openCreditManagement],['Item overview',()=>{capture();activeTab='items';render();}],['Header texts',()=>{capture();activeTab='texts';render();}],['Document flow',()=>{capture();activeTab='flow';render();}]],system:[['System information',showHelp]],help:[['Application help',showHelp]]};
  const items=menus[button.dataset.menu];menu.replaceChildren();for(const [label,action]of items){const item=document.createElement('button');item.setAttribute('role','menuitem');item.textContent=label;item.onclick=()=>{menu.hidden=true;action();};menu.append(item);}
  const rect=button.getBoundingClientRect();menu.style.left=`${rect.left+scrollX}px`;menu.style.top=`${rect.bottom+scrollY}px`;menu.hidden=false;
}
for(const id of ['save','save-text'])document.getElementById(id).onclick=()=>void saveDocument();
for(const id of ['display','find'])document.getElementById(id).onclick=displayDialog;
for(const id of ['new','back','cancel'])document.getElementById(id).onclick=()=>startNew();
for(const id of ['create-reference'])document.getElementById(id).onclick=referenceDialog;
document.querySelector('#check').onclick=checkDocument;document.querySelector('#help').onclick=showHelp;
document.querySelector('#execute').onclick=executeCommand;document.querySelector('#command').onkeydown=e=>{if(e.key==='Enter')executeCommand();};
document.querySelectorAll('[data-menu]').forEach(button=>button.onclick=e=>{e.stopPropagation();openMenu(button);});
document.addEventListener('click',()=>document.querySelector('#menu').hidden=true);
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();void saveDocument();}if(e.key==='Escape')document.querySelector('#menu').hidden=true;});
const params=new URLSearchParams(location.search),invoice=invoices.find(i=>i.invoice===params.get('invoice')||i.caseId===params.get('case'));
if(invoice){const action=Object.hasOwn(documentTypes,params.get('transaction'))?params.get('transaction'):'credit';draft={...createDraft(action),...invoice,invoiceQuantity:invoice.quantity,quantity:'',unitPrice:invoice.price};delete draft.caseId;}
render();
