// Fictional billing/master data. Customer approvals belong to the Wonderful app.
export const invoices = [
  {invoice:'9000124581',account:'10004521',customer:'Riverside Market',city:'St. Louis, MO',order:'4500087210',delivery:'8000642310',po:'RM-2026-1042',material:'101024',product:'Bud Light 24 x 12 fl oz cans',quantity:20,price:24.50,caseId:'CS-100241'},
  {invoice:'9000124623',account:'10004608',customer:'Lakeview Sports Bar',city:'Chicago, IL',order:'4500087244',delivery:'8000642352',po:'LSB-1005',material:'102018',product:'Michelob ULTRA 24 x 12 fl oz bottles',quantity:12,price:31.00,caseId:'CS-100242'},
  {invoice:'9000124556',account:'10004912',customer:'Oak & Main Grill',city:'Austin, TX',order:'4500087198',delivery:'8000642286',po:'OMG-8821',material:'103024',product:'Budweiser 24 x 12 fl oz cans',quantity:10,price:26.00,caseId:'CS-100243'},
  {invoice:'9000124519',account:'10004773',customer:'Union Square Grocery',city:'Denver, CO',order:'4500087180',delivery:'8000642240',po:'USG-4408',material:'101024',product:'Bud Light 24 x 12 fl oz cans',quantity:15,price:24.50,caseId:'CS-100244'},
  {invoice:'9000124637',account:'10004836',customer:'Harbor Point Tavern',city:'Tampa, FL',order:'4500087251',delivery:'8000642368',po:'HPT-0199',material:'104024',product:'Busch Light 24 x 12 fl oz cans',quantity:8,price:22.00,caseId:'CS-100245'}
];
export const documentTypes = {
  credit:{code:'CR',name:'Credit Memo Request',transaction:'VA01',prefix:6000010000,status:'Billing block — pending release'},
  replacement:{code:'SDF',name:'Subsequent Delivery Free of Charge',transaction:'VA01',prefix:5000090000,status:'Open — delivery not created'},
  return:{code:'RE',name:'Returns Order',transaction:'VA01',prefix:6500010000,status:'Open — returns delivery not created'},
  note:{code:'ZCN',name:'Customer Contact Note',transaction:'ZCNOTE',prefix:3000010000,status:'Recorded'}
};
export const reasons = ['','Short delivery','Damaged in transit','Incorrect material','Pricing adjustment','Information provided','Other'];
