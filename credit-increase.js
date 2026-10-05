import { invoices } from './data.js';

// Fictional credit master data; values are USD cents to preserve monetary precision.
const customers = invoices.map((item, index) => ({ ...item, area:'US01', currency:'USD', risk:'002 — Normal risk', initialLimit:[2500000,1800000,1500000,3500000,1200000][index], exposure:[1875000,1260000,920000,2240000,780000][index] }));
const KEY='abi-sap-credit-limits-v1';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=cents=>(cents/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const today=()=>new Date().toLocaleDateString('en-CA');
let customer=null, loadedLimit=0, loadedVersion='', receipt=null, dirty=false, saving=false, tab='overview';
let draft={limit:'',reference:'',operator:'',reason:''};
function records(){const result=JSON.parse(localStorage.getItem(KEY)||'[]');if(!Array.isArray(result)||result.some(r=>!r.changeId||!r.account||!Number.isSafeInteger(r.newLimit)))throw new Error('Credit data cannot be read. No change was saved.');return result;}
function latest(all,account){return all.filter(r=>r.account===account&&r.area==='US01').at(-1);}
function status(message,type='info'){$('status').innerHTML=`<span class="status-icon ${type}">${type==='success'?'✓':type==='error'?'!':'i'}</span><span>${esc(message)}</span>`;}
function field(label,id,value,{readOnly=false,short=false}={}){return `<div class="field"><label for="${id}">${label}</label><input id="${id}" value="${esc(value)}" ${readOnly?'readonly':''} ${short?'class="short"':''}></div>`;}
function capture(){if(!receipt&&$('new-limit'))draft={limit:$('new-limit').value,reference:$('approval-reference').value,operator:$('changed-by').value,reason:$('change-reason').value};}
function cents(value){if(!/^\d{1,10}(\.\d{1,2})?$/.test(value.trim()))return null;const n=Math.round(Number(value)*100);return Number.isSafeInteger(n)?n:null;}
function render(){
  $('screen-title').textContent=receipt?'Display Customer Credit Limit Change':'Change Customer Credit Management';
  document.title=$('screen-title').textContent+' — Anheuser-Busch';
  $('document-number').textContent=receipt?`Change ${receipt.changeId}`:'';
  $('save').disabled=$('save-text').disabled=!!receipt||!customer;
  const original=receipt?receipt.previousLimit:loadedLimit;
  $('main').innerHTML=`${receipt?`<div class="saved-banner"><span class="status-icon success">✓</span><strong>Credit limit change ${esc(receipt.changeId)}</strong><span>Saved · ${esc(receipt.account)} · ${money(receipt.newLimit)} USD</span></div>`:''}<form class="transaction-form" onsubmit="return false">
    <fieldset class="group"><legend>Customer credit management</legend><div class="group-grid">
      <div class="field"><label for="customer-account">Customer</label><select id="customer-account" ${receipt?'disabled':''}>${customers.map(c=>`<option value="${c.account}" ${c.account===customer?.account?'selected':''}>${c.account} — ${esc(c.customer)}</option>`).join('')}</select><button type="button" class="search-help" id="customer-help" aria-label="Customer details">⌕</button></div>
      ${field('Credit control area','credit-area','US01',{readOnly:true,short:true})}
      ${field('Name','customer-name',customer?.customer||'',{readOnly:true})}
      ${field('Currency','currency','USD',{readOnly:true,short:true})}
      ${field('City','customer-city',customer?.city||'',{readOnly:true})}
      ${field('Risk category','risk-category',customer?.risk||'',{readOnly:true})}
    </div></fieldset>
    <div class="tabs" role="tablist" aria-label="Credit management views"><button type="button" role="tab" id="overview-tab" aria-controls="overview-panel" aria-selected="${tab==='overview'}">Status / credit limit</button><button type="button" role="tab" id="history-tab" aria-controls="history-panel" aria-selected="${tab==='history'}">Change documents</button></div>
    <section class="tab-panel" id="overview-panel" role="tabpanel" aria-labelledby="overview-tab" ${tab==='overview'?'':'hidden'}>
      <div class="grid-toolbar"><strong>Credit limit data</strong><span class="right">Amounts in USD</span></div>
      <div class="group-grid">
        ${field(receipt?'Previous credit limit':'Current credit limit','current-limit',money(original),{readOnly:true})}
        ${field('Credit exposure','credit-exposure',money(customer?.exposure||0),{readOnly:true})}
        ${field('New credit limit *','new-limit',draft.limit,{readOnly:!!receipt})}
        ${field('Available credit (before)','available-before',money(original-(customer?.exposure||0)),{readOnly:true})}
        ${field('Increase amount','increase-amount','',{readOnly:true})}
        ${field('Available credit (after)','available-after','',{readOnly:true})}
      </div>
      <p class="inline-note">Enter the customer credit limit authorized in Wonderful. Saving applies the increase to this customer's credit master record.</p>
      <fieldset class="group"><legend>Change details</legend><div class="group-grid">
        ${field('Approval reference *','approval-reference',draft.reference,{readOnly:!!receipt})}
        ${field('Changed by *','changed-by',draft.operator,{readOnly:!!receipt})}
        ${field('Change date','change-date',receipt?receipt.savedAt.slice(0,10):today(),{readOnly:true})}
        ${field('Change document','change-document',receipt?.changeId||'Assigned on save',{readOnly:true})}
      </div><div class="text-editor" style="margin-top:15px"><label for="change-reason">Reason for increase *</label><textarea id="change-reason" style="height:75px" maxlength="2000" ${receipt?'readonly':''}>${esc(draft.reason)}</textarea></div></fieldset>
    </section>
    <section class="tab-panel" id="history-panel" role="tabpanel" aria-labelledby="history-tab" ${tab==='history'?'':'hidden'}></section>
    <div class="footer-fields"><span class="inline-note">* Required entry</span><span class="inline-note">FD32 · Customer Credit Management · US01</span></div>
  </form>`;
  $('new-limit').inputMode='decimal';$('new-limit').maxLength=13;$('approval-reference').maxLength=120;$('changed-by').maxLength=80;
  $('customer-account').onchange=()=>{const account=$('customer-account').value;if(!canLeave()){$('customer-account').value=customer.account;return;}load(account);};
  $('customer-help').onclick=help;
  for(const id of ['new-limit','approval-reference','changed-by','change-reason'])$(id).oninput=()=>{dirty=true;capture();updateAmounts();};
  $('overview-tab').onclick=()=>{capture();tab='overview';render();};
  $('history-tab').onclick=()=>{capture();tab='history';render();};
  updateAmounts();if(tab==='history')renderHistory();
}
function updateAmounts(){const n=cents(draft.limit),base=receipt?receipt.previousLimit:loadedLimit;$('increase-amount').value=n===null?'':money(n-base);$('available-after').value=n===null?'':money(n-(customer?.exposure||0));}
function renderHistory(){try{const rows=records().filter(r=>r.account===customer?.account).reverse();$('history-panel').innerHTML=`<div class="grid-toolbar"><strong>Credit limit change documents</strong><span class="right">${rows.length} entries</span></div><div class="table-scroll"><table><thead><tr><th>Change document</th><th>Date / time</th><th>Previous limit</th><th>New limit</th><th>Approval reference</th><th>Changed by</th></tr></thead><tbody>${rows.length?rows.map(r=>`<tr><td><button type="button" data-change="${esc(r.changeId)}">${esc(r.changeId)}</button></td><td>${esc(new Date(r.savedAt).toLocaleString())}</td><td>${money(r.previousLimit)}</td><td>${money(r.newLimit)}</td><td>${esc(r.reference)}</td><td>${esc(r.operator)}</td></tr>`).join(''):'<tr><td colspan="6">No credit limit changes recorded for this customer.</td></tr>'}</tbody></table></div>`;document.querySelectorAll('[data-change]').forEach(b=>b.onclick=()=>{if(canLeave())displayRecord(rows.find(r=>r.changeId===b.dataset.change));});}catch(e){status(e.message,'error');}}
function canLeave(){return !dirty||confirm('Unsaved entries will be lost. Continue?');}
function load(account){try{const c=customers.find(c=>c.account===account);if(!c)throw new Error('Customer does not exist in this demonstration system.');const last=latest(records(),account);customer=c;loadedLimit=last?.newLimit??c.initialLimit;loadedVersion=last?.changeId||'';receipt=null;draft={limit:'',reference:'',operator:'',reason:''};dirty=false;tab='overview';render();status(`Customer ${c.account} loaded. Enter the approved new credit limit.`);}catch(e){status(e.message,'error');}}
function validate(){capture();let error;if(!customer)error=['Load a customer first.','customer-account'];else if(cents(draft.limit)===null)error=['Enter a USD credit limit with at most two decimal places (no commas).','new-limit'];else if(cents(draft.limit)<=loadedLimit)error=['New credit limit must be greater than the current credit limit.','new-limit'];else if(!draft.reference.trim())error=['Enter the approval reference from Wonderful.','approval-reference'];else if(!draft.operator.trim())error=['Enter the name or ID of the operator.','changed-by'];else if(draft.reason.trim().length<12)error=['Enter a reason for increase of at least 12 characters.','change-reason'];if(error){tab='overview';render();status(error[0],'error');$(error[1])?.focus();return false;}status('Credit limit change is complete. Save to apply the increase.','success');return true;}
async function save(){
  if(saving||receipt||$('dialog').open||!validate())return;
  saving=true;$('main').inert=true;$('save').disabled=$('save-text').disabled=true;
  const input={...draft},account=customer.account,previousLimit=loadedLimit,version=loadedVersion;
  try{
    if(!navigator.locks)throw new Error('This browser does not support safe concurrent saves. Open the page in current Chrome or Edge.');
    const result=await navigator.locks.request(KEY,()=>{
      const all=records(),existing=all.find(r=>r.reference===input.reference.trim());
      if(existing)throw new Error(`Approval reference already exists in change ${existing.changeId}. Use Display Change to verify it.`);
      const last=latest(all,account);
      if((last?.changeId||'')!==version)throw new Error('The customer credit limit changed in another window. Load Customer again and verify the approved amount.');
      let number=7000010001;while(all.some(r=>r.changeId===String(number)))number++;
      const record={changeId:String(number),account,area:'US01',currency:'USD',previousLimit,newLimit:cents(input.limit),reference:input.reference.trim(),operator:input.operator.trim(),reason:input.reason.trim(),savedAt:new Date().toISOString(),demo:true};
      localStorage.setItem(KEY,JSON.stringify([...all,record]));return record;
    });
    dirty=false;displayRecord(result);status(`Credit limit for customer ${account} changed to ${money(result.newLimit)} USD. Change document ${result.changeId} saved.`,'success');
  }catch(e){status(e.message||'Credit limit could not be saved.','error');}
  finally{saving=false;$('main').inert=false;$('save').disabled=$('save-text').disabled=!!receipt||!customer;}
}
function displayRecord(record){customer=customers.find(c=>c.account===record.account);receipt=record;draft={limit:(record.newLimit/100).toFixed(2),reference:record.reference,operator:record.operator,reason:record.reason};dirty=false;tab='overview';render();status(`Displaying saved change document ${record.changeId}.`);}
function dialog(title,body,actions){$('dialog').innerHTML=`<div class="dialog-title"><span>${esc(title)}</span><button id="dialog-close" aria-label="Close dialog">×</button></div><div class="dialog-body">${body}</div><div class="dialog-actions">${actions}</div>`;$('dialog-close').onclick=()=>$('dialog').close();$('dialog').showModal();}
function display(){if(!canLeave())return;dialog('Display Credit Limit Change',`${field('Document / reference','find-change','')}<p class="dialog-hint">Enter an exact change document number or approval reference.</p><p id="dialog-error" class="dialog-error" role="alert"></p>`,'<button id="open-change">Display</button><button id="dialog-cancel">Cancel</button>');$('dialog-cancel').onclick=()=>$('dialog').close();const find=()=>{try{const query=$('find-change').value.trim(),r=records().find(r=>r.changeId===query||r.reference===query);if(!r)throw new Error('No change document found for this number or approval reference.');displayRecord(r);$('dialog').close();}catch(e){$('dialog-error').textContent=e.message;}};$('open-change').onclick=find;$('find-change').onkeydown=e=>{if(e.key==='Enter')find();};$('find-change').focus();}
function help(){dialog('SAP — Credit Management Help','<p>Load the customer, enter the approved new credit limit, approval reference, operator, and reason. Save applies the change directly. Display Change retrieves its receipt by document number or reference.</p><p>Credit limit changes are separate from credit memo requests. Use Goto → Credit Memo Request to open the existing sales-document transaction.</p><p class="help-footnote">Demonstration system with fictional customer credit data. This screen is inspired by classic FD32; it is not a verified copy of Anheuser-Busch’s SAP installation. Changes are stored in this browser only. Approvals take place in Wonderful.</p>','<button id="help-close">Close</button>');$('help-close').onclick=()=>$('dialog').close();}
function reset(){if(canLeave())load(customer?.account||customers[0].account);}
function memo(){if(canLeave()){dirty=false;location.href='index.html';}}
function execute(){const code=$('command').value.trim().toUpperCase().replace(/^\/N/,'');if(code==='FD32')reset();else if(code==='VA01')memo();else status(`Transaction ${code} is not available on this screen.`,'error');}
function menu(button){const options={document:[['Load customer',reset],['Save',save],['Display change',display]],edit:[['Check',()=>!receipt&&validate()],['Cancel entry',reset]],goto:[['Credit limit',()=>{capture();tab='overview';render();}],['Change documents',()=>{capture();tab='history';render();}],['Credit Memo Request',memo]],system:[['System information',help]],help:[['Application help',help]]};$('menu').replaceChildren();for(const [label,action]of options[button.dataset.menu]){const b=document.createElement('button');b.textContent=label;b.setAttribute('role','menuitem');b.onclick=()=>{$('menu').hidden=true;action();};$('menu').append(b);}const rect=button.getBoundingClientRect();$('menu').style.left=`${rect.left+scrollX}px`;$('menu').style.top=`${rect.bottom+scrollY}px`;$('menu').hidden=false;}
for(const id of ['save','save-text'])$(id).onclick=save;
for(const id of ['new','back','cancel','load-customer'])$(id).onclick=reset;
for(const id of ['display','find'])$(id).onclick=display;
$('check').onclick=()=>!receipt&&validate();$('help').onclick=help;$('execute').onclick=execute;
$('command').onkeydown=e=>{if(e.key==='Enter')execute();};
document.querySelectorAll('[data-menu]').forEach(b=>b.onclick=e=>{e.stopPropagation();menu(b);});
document.addEventListener('click',()=>$('menu').hidden=true);
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();save();}if(e.key==='Escape')$('menu').hidden=true;});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
load(new URLSearchParams(location.search).get('account')||customers[0].account);
