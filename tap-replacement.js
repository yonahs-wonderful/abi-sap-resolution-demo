// Fictional equipment master data for the independent Budweiser replacement demo.
const CUSTOMER={account:'10004912',name:'Oak & Main Grill',city:'Austin, TX',equipment:'EQ-BUD-04912-01',material:'BUD-TAP-001',description:'Budweiser branded draft tap assembly',brand:'Budweiser'};
const KEY='abi-sap-tap-replacements-v1';
const DOCUMENT_STATUS='Open — delivery not created';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const empty=()=>({quantity:'',reason:'',reference:'',operator:'',contact:'',phone:'',address:'',shipping:'',damage:''});
let draft=empty(),receipt=null,dirty=false,saving=false,tab='details',loaded=false;
function records(){
  const all=JSON.parse(localStorage.getItem(KEY)||'[]');
  if(!Array.isArray(all)||all.some(r=>!r||!/^510001\d{4}$/.test(r.documentId)||r.account!==CUSTOMER.account||r.material!==CUSTOMER.material||r.equipment!==CUSTOMER.equipment||r.quantity!==1||r.amount!==0||r.currency!=='USD'||r.documentStatus!==DOCUMENT_STATUS||['reference','operator','contact','phone','address','shipping','reason','damage','savedAt'].some(k=>typeof r[k]!=='string'||!r[k].trim())))throw new Error('Replacement records cannot be read. No request was saved.');
  return all;
}
function status(message,type='info'){$('status').innerHTML=`<span class="status-icon ${type}">${type==='success'?'✓':type==='error'?'!':'i'}</span><span>${esc(message)}</span>`;}
function field(label,id,value,readOnly=false){return `<div class="field"><label for="${id}">${esc(label)}</label><input id="${id}" value="${esc(value)}" ${readOnly||receipt?'readonly':''} maxlength="160"></div>`;}
function choice(label,id,value,options){return `<div class="field"><label for="${id}">${esc(label)}</label><select id="${id}" ${receipt?'disabled':''}><option value="">Select…</option>${options.map(o=>`<option ${o===value?'selected':''}>${esc(o)}</option>`).join('')}</select></div>`;}
const controls={quantity:'quantity',reason:'replacement-reason',reference:'approval-reference',operator:'created-by',contact:'contact-name',phone:'contact-phone',address:'ship-to-address',shipping:'shipping-method',damage:'damage-description'};
function capture(){if(!receipt&&$('quantity'))for(const [key,id]of Object.entries(controls))draft[key]=$(id).value;}
function render(){
  $('screen-title').textContent=receipt?'Display Tap Replacement Request':'Create Tap Replacement Request';
  document.title=$('screen-title').textContent+' — Anheuser-Busch';
  $('document-number').textContent=receipt?`Request ${receipt.documentId}`:'';
  $('save').disabled=$('save-text').disabled=!!receipt||!loaded||saving;
  $('main').innerHTML=`${receipt?`<div class="saved-banner"><span class="status-icon success">✓</span><strong>Replacement request ${esc(receipt.documentId)}</strong><span>Saved · ${esc(receipt.documentStatus)}</span></div>`:''}
    <form class="transaction-form" onsubmit="return false">
    <fieldset class="group"><legend>Customer / request header</legend><div class="group-grid">
      ${field('Customer','customer-account',CUSTOMER.account,true)}${field('Name','customer-name',CUSTOMER.name,true)}
      ${field('Sales organization','sales-org','US01',true)}${field('City','customer-city',CUSTOMER.city,true)}
      ${field('Approval reference *','approval-reference',draft.reference)}${field('Created by *','created-by',draft.operator)}
    </div></fieldset>
    <div class="tabs" role="tablist" aria-label="Replacement request views"><button type="button" role="tab" id="details-tab" aria-controls="details-panel" aria-selected="${tab==='details'}">Replacement details</button><button type="button" role="tab" id="history-tab" aria-controls="history-panel" aria-selected="${tab==='history'}">Request history</button></div>
    <section class="tab-panel" id="details-panel" role="tabpanel" aria-labelledby="details-tab" ${tab==='details'?'':'hidden'}>
      <fieldset class="group"><legend>Equipment replacement — free of charge</legend><div class="group-grid">
        ${field('Equipment','equipment-id',CUSTOMER.equipment,true)}${field('Material','material',CUSTOMER.material,true)}
        ${field('Description','material-description',CUSTOMER.description,true)}${field('Brand','brand',CUSTOMER.brand,true)}
        ${field('Quantity (EA) *','quantity',draft.quantity)}${field('Net value / currency','net-value','0.00 USD',true)}
        ${choice('Replacement reason *','replacement-reason',draft.reason,['Broken / damaged tap'])}${field('Request status','request-status',receipt?.documentStatus||'Not saved',true)}
      </div></fieldset>
      <fieldset class="group"><legend>Delivery / customer contact</legend><div class="group-grid">
        ${field('Contact name *','contact-name',draft.contact)}${field('Contact phone *','contact-phone',draft.phone)}
        ${field('Ship-to address *','ship-to-address',draft.address)}${choice('Shipping method *','shipping-method',draft.shipping,['Standard ground','Expedited ground'])}
      </div><div class="text-editor"><label for="damage-description">Damage description / resolution *</label><textarea id="damage-description" maxlength="2000" ${receipt?'readonly':''}>${esc(draft.damage)}</textarea></div></fieldset>
      <div class="group-grid">${field('Request date','request-date',(receipt?.savedAt||new Date().toISOString()).slice(0,10),true)}${field('Replacement request','request-number',receipt?.documentId||'Assigned on save',true)}</div>
      <p class="inline-note">One replacement draft tap assembly, free of charge. Save creates the request; delivery is processed separately.</p>
    </section>
    <section class="tab-panel" id="history-panel" role="tabpanel" aria-labelledby="history-tab" ${tab==='history'?'':'hidden'}></section>
    <div class="footer-fields"><span class="inline-note">* Required entry</span><span class="inline-note">ZTAP01 · Equipment Services · US01</span></div></form>`;
  $('quantity').inputMode='numeric';$('quantity').maxLength=2;
  for(const id of Object.values(controls))$(id).oninput=()=>{dirty=true;capture();};
  $('details-tab').onclick=()=>{capture();tab='details';render();};
  $('history-tab').onclick=()=>{capture();tab='history';render();};
  if(tab==='history')renderHistory();
}
function renderHistory(){try{const rows=records().filter(r=>r.account===CUSTOMER.account).reverse();$('history-panel').innerHTML=`<div class="grid-toolbar"><strong>Equipment replacement requests</strong><span class="right">${rows.length} entries</span></div><div class="table-scroll"><table><thead><tr><th>Request</th><th>Date / time</th><th>Material</th><th>Quantity</th><th>Approval reference</th><th>Status</th></tr></thead><tbody>${rows.length?rows.map(r=>`<tr><td><button type="button" data-request="${esc(r.documentId)}">${esc(r.documentId)}</button></td><td>${esc(new Date(r.savedAt).toLocaleString())}</td><td>${esc(r.material)}</td><td>${r.quantity} EA</td><td>${esc(r.reference)}</td><td>${esc(r.documentStatus)}</td></tr>`).join(''):'<tr><td colspan="6">No replacement requests recorded for this customer.</td></tr>'}</tbody></table></div>`;document.querySelectorAll('[data-request]').forEach(b=>b.onclick=()=>{if(canLeave())displayRecord(rows.find(r=>r.documentId===b.dataset.request));});}catch(e){status(e.message,'error');}}
function canLeave(){return !saving&&(!dirty||confirm('Unsaved entries will be lost. Continue?'));}
function reset(){if(requestedAccount&&requestedAccount!==CUSTOMER.account){status('Customer does not exist in this equipment demonstration. Open the supported account 10004912.','error');return;}if(!canLeave())return;try{records();loaded=true;receipt=null;draft=empty();dirty=false;tab='details';render();status('Enter the approved equipment replacement and reference.');}catch(e){status(e.message,'error');}}
function validate(){
  capture();let error;
  if(!loaded)error=['Load the supported customer first.','customer-account'];
  else if(draft.quantity.trim()!=='1')error=['Enter quantity 1 EA for this single-tap replacement.','quantity'];
  else if(draft.reason!=='Broken / damaged tap')error=['Select the replacement reason.','replacement-reason'];
  else if(!draft.reference.trim())error=['Enter the approval reference from Wonderful.','approval-reference'];
  else if(!draft.operator.trim())error=['Enter the name or ID of the operator.','created-by'];
  else if(!draft.contact.trim())error=['Enter the customer contact name.','contact-name'];
  else if(!/^\+?[\d ()-]{7,25}$/.test(draft.phone.trim()))error=['Enter a valid customer contact phone.','contact-phone'];
  else if(draft.address.trim().length<15)error=['Enter the complete ship-to address.','ship-to-address'];
  else if(!['Standard ground','Expedited ground'].includes(draft.shipping))error=['Select a shipping method.','shipping-method'];
  else if(draft.damage.trim().length<20)error=['Describe the damage and agreed replacement (at least 20 characters).','damage-description'];
  if(error){tab='details';render();status(error[0],'error');$(error[1])?.focus();return false;}
  status('Replacement request is complete. Save to create the request.','success');return true;
}
async function save(){
  if(saving||receipt||$('dialog').open||!validate())return;
  const input=Object.fromEntries(Object.entries(draft).map(([key,value])=>[key,value.trim()]));
  saving=true;$('main').inert=true;for(const id of ['save','save-text','new','back','cancel','load-customer','execute','find','display'])$(id).disabled=true;
  try{
    if(!navigator.locks)throw new Error('This browser does not support safe concurrent saves. Open the page in current Chrome or Edge.');
    const result=await navigator.locks.request(KEY,()=>{
      const all=records(),existing=all.find(r=>r.reference===input.reference);
      if(existing)throw new Error(`Approval reference already exists in request ${existing.documentId}. Use Display Request to verify it.`);
      let number=5100010001;while(all.some(r=>r.documentId===String(number)))number++;
      if(number>5100019999)throw new Error('Demo document number range exhausted. No request was saved.');
      const record={...input,documentId:String(number),account:CUSTOMER.account,customer:CUSTOMER.name,equipment:CUSTOMER.equipment,material:CUSTOMER.material,brand:CUSTOMER.brand,salesOrg:'US01',quantity:1,unit:'EA',amount:0,currency:'USD',documentStatus:DOCUMENT_STATUS,savedAt:new Date().toISOString(),demo:true};
      localStorage.setItem(KEY,JSON.stringify([...all,record]));return record;
    });
    displayRecord(result);status(`Replacement request ${result.documentId} saved. ${DOCUMENT_STATUS}.`,'success');
  }catch(e){status(e.message||'Replacement request could not be saved.','error');}
  finally{saving=false;$('main').inert=false;for(const id of ['new','back','cancel','load-customer','execute','find','display'])$(id).disabled=false;$('save').disabled=$('save-text').disabled=!!receipt||!loaded;}
}
function displayRecord(record){receipt=record;draft=Object.fromEntries(Object.keys(controls).map(k=>[k,String(record[k])]));dirty=false;tab='details';render();status(`Displaying saved replacement request ${record.documentId}.`);}
function dialog(title,body,actions){$('dialog').innerHTML=`<div class="dialog-title"><span>${esc(title)}</span><button id="dialog-close" aria-label="Close dialog">×</button></div><div class="dialog-body">${body}</div><div class="dialog-actions">${actions}</div>`;$('dialog-close').onclick=()=>$('dialog').close();$('dialog').showModal();}
function display(){if(!canLeave())return;dialog('Display Tap Replacement Request','<div class="field"><label for="find-request">Document / reference</label><input id="find-request"></div><p class="dialog-hint">Enter the exact replacement request number or approval reference.</p><p id="dialog-error" class="dialog-error" role="alert"></p>','<button id="open-request">Display</button><button id="dialog-cancel">Cancel</button>');$('dialog-cancel').onclick=()=>$('dialog').close();const find=()=>{try{const q=$('find-request').value.trim(),r=records().find(r=>r.documentId===q||r.reference===q);if(!r)throw new Error('No replacement request found for this number or approval reference.');displayRecord(r);$('dialog').close();}catch(e){$('dialog-error').textContent=e.message;}};$('open-request').onclick=find;$('find-request').onkeydown=e=>{if(e.key==='Enter')find();};$('find-request').focus();}
function help(){if(saving)return;dialog('SAP — Equipment Services Help','<p>Create one free-of-charge replacement request for a broken Budweiser draft tap assembly. Enter the Wonderful approval reference, operator, quantity, reason, contact, ship-to address, shipping method and damage description. Save creates the request directly.</p><p>Display Request retrieves a saved receipt by exact request number or approval reference. Request history lists this customer’s saved requests. A saved request is not a delivery or shipment confirmation.</p><p class="help-footnote">ZTAP01 is a custom SAP-inspired demonstration transaction, not a verified Anheuser-Busch SAP screen. All customer and equipment data is fictional. Records stay in this browser. Approvals take place in Wonderful.</p>','<button id="help-close">Close</button>');$('help-close').onclick=()=>$('dialog').close();}
function go(url){if(canLeave()){dirty=false;location.href=url;}}
function execute(){if(saving)return;const code=$('command').value.trim().toUpperCase().replace(/^\/N/,'');if(code==='ZTAP01')reset();else if(code==='FD32')go('credit-increase.html?account=10004521');else if(code==='VA01')go('index.html');else status(`Transaction ${code} is not available on this screen.`,'error');}
function menu(button){if(saving)return;const options={document:[['New request',reset],['Save',save],['Display request',display]],edit:[['Check',()=>!receipt&&validate()],['Cancel entry',reset]],goto:[['Credit Line Increase (FD32)',()=>go('credit-increase.html?account=10004521')],['Credit Memo Request',()=>go('index.html')]],system:[['System information',help]],help:[['Application help',help]]};$('menu').replaceChildren();for(const [label,action]of options[button.dataset.menu]){const b=document.createElement('button');b.textContent=label;b.setAttribute('role','menuitem');b.onclick=()=>{$('menu').hidden=true;action();};$('menu').append(b);}const rect=button.getBoundingClientRect();$('menu').style.left=`${rect.left+scrollX}px`;$('menu').style.top=`${rect.bottom+scrollY}px`;$('menu').hidden=false;}
for(const id of ['save','save-text'])$(id).onclick=save;
for(const id of ['new','back','cancel','load-customer'])$(id).onclick=reset;
for(const id of ['display','find'])$(id).onclick=display;
$('check').onclick=()=>!receipt&&!saving&&validate();$('help').onclick=help;$('execute').onclick=execute;
$('command').onkeydown=e=>{if(e.key==='Enter')execute();};
document.querySelectorAll('[data-menu]').forEach(b=>b.onclick=e=>{e.stopPropagation();menu(b);});
document.addEventListener('click',()=>$('menu').hidden=true);
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();save();}if(e.key==='Escape')$('menu').hidden=true;});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
const requestedAccount=new URLSearchParams(location.search).get('account');
render();
if(requestedAccount&&requestedAccount!==CUSTOMER.account){$('main').inert=true;status('Customer does not exist in this equipment demonstration. Open the supported account 10004912.','error');for(const id of ['new','back','cancel','load-customer'])$(id).disabled=true;}
else reset();
