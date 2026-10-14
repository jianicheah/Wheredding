const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Element {
 constructor(){this.value='';this.textContent='';this.innerHTML='';this.className='';this.hidden=false;this.disabled=false;this.valid=true;}
 querySelectorAll(){return [];} checkValidity(){return this.valid;} reportValidity(){return this.valid;} focus(){} reset(){}
}
(async()=>{
 const elements=new Map(),get=s=>{if(s==='#reload')return null;if(!elements.has(s))elements.set(s,new Element());return elements.get(s);};
 let submitted=[],missingRoute=false,sessionReply={enabled:false};
 const context=vm.createContext({document:{querySelector:get},window:{addEventListener(){}},Intl,Date,console,confirm:()=>true,location:{reload(){}},fetch:async(url,options={})=>{
  if(url==='/api/admin/session')return{ok:true,json:async()=>sessionReply};
  if(missingRoute)return{ok:false,status:405,json:async()=>{throw Error('Non-JSON server response');}};
  const body=JSON.parse(options.body);submitted.push({url,body});return{ok:true,json:async()=>({revision:body.expectedRevision+1})};
 }});
 vm.runInContext(fs.readFileSync('wwwroot/admin.js','utf8'),context);
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(get('#status').textContent,/Admin editing is not configured/);
 console.log('PASS: Session startup completes when the optional reload button is removed');
 vm.runInContext(`doc={revision:1,venues:[{id:'hotel',name:'Unsaved hotel',district:'George Town',area:'Island',packages:[]}],contact:{heading:'Contact',message:'Draft message',email:'owner@example.com',phone:''}};hotelsDirty=contactDirty=dirty=true;`,context);
 get('#hotel-form').valid=false;
 await get('#save-contact').onclick();
 assert.equal(submitted[0].url,'/api/admin/contact');assert.equal(submitted[0].body.venues,undefined);
 assert.equal(vm.runInContext('hotelsDirty && !contactDirty && dirty && doc.revision===2',context),true);
 assert.match(get('#contact-save-status').textContent,/Hotel and package edits remain unsaved/);
 console.log('PASS: Contact save ignores invalid hotel draft, sends only contact and preserves hotel changes');
 vm.runInContext(`doc.contact.message='Another unsaved contact edit';changed('contact');`,context);
 get('#hotel-form').valid=true;get('#contact-form').valid=false;
 await get('#publish').onclick();
 assert.equal(submitted[1].url,'/api/admin/hotels');assert.equal(submitted[1].body.contact,undefined);
 assert.equal(submitted[1].body.expectedRevision,2);
 assert.equal(vm.runInContext('!hotelsDirty && contactDirty && dirty && doc.revision===3',context),true);
 console.log('PASS: Hotel save sends only hotels, ignores invalid contact draft and preserves contact changes');
 get('#hotel-search').value='missing';vm.runInContext('renderList()',context);
 assert.match(get('#hotel-list').innerHTML,/No hotels match/);
 get('#hotel-search').value='';vm.runInContext('renderList()',context);
 assert.match(get('#hotel-list').innerHTML,/<tr/);assert.match(get('#hotel-list').innerHTML,/data-edit="0"/);assert.match(get('#hotel-list').innerHTML,/data-archive="0"/);
 console.log('PASS: Hotel table renders edit/archive actions and empty search state');
 missingRoute=true;get('#contact-form').valid=true;
 await get('#save-contact').onclick();
 assert.match(get('#contact-save-status').textContent,/restart Wheredding/);
 assert.equal(vm.runInContext('contactDirty && dirty',context),true);
 assert.equal(get('#save-contact').disabled,false);
 console.log('PASS: An outdated server gives restart instructions and keeps the unsaved draft');
 sessionReply={enabled:true,authenticated:false,csrfToken:'test-token',storage:'SQL Server'};
 await assert.rejects(vm.runInContext('session(true)',context),/sign-in cookie was not accepted/);
 console.log('PASS: A rejected sign-in session reports an error instead of silently returning to login');
})().catch(e=>{console.error(e);process.exitCode=1;});
