const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const data=JSON.parse(fs.readFileSync('Data/venues.json','utf8'));
class Element {
 constructor(){this.value='';this.innerHTML='';this.textContent='';this.dataset={};this.checked=false;}
 querySelectorAll(selector){const attribute=selector.slice(1,-1);return [...this.innerHTML.matchAll(new RegExp(attribute+'="([^"]+)"','g'))].map(m=>{const e=new Element();e.dataset[attribute.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=m[1];e.checked=this.innerHTML.includes(`data-select="${m[1]}" checked`);return e;});}
 insertAdjacentHTML(_,html){this.innerHTML+=html;} focus(){this.focused=true;}checkValidity(){return true;}showModal(){this.open=true;}close(){this.open=false;}
}
const nodes=new Map();const get=s=>{if(!nodes.has(s))nodes.set(s,new Element());return nodes.get(s);};
get('#budget').value='0';get('#sort').value='name';get('#giftform').elements=Object.fromEntries(['tablePrice','seats','guests','servicePercent','taxPercent','extra','budget'].map(k=>[k,new Element()]));
for(const [k,v] of Object.entries({tablePrice:'',seats:'10',guests:'1',servicePercent:'0',taxPercent:'0',extra:'0',budget:'0'}))get('#giftform').elements[k].value=v;
const context=vm.createContext({document:{querySelector:get,querySelectorAll:s=>get('#comparison').querySelectorAll(s)},fetch:async(url,options)=>({ok:true,json:async()=>url==='/api/venues'?data:{priceMode:JSON.parse(options.body).priceMode,tableTotal:Number(JSON.parse(options.body).tablePrice),mealShare:Number(JSON.parse(options.body).tablePrice)/10*Number(JSON.parse(options.body).guests),suggested:Math.ceil(Number(JSON.parse(options.body).tablePrice)/10*Number(JSON.parse(options.body).guests)/10)*10,withinBudget:true}}),Intl,console,window:{print(){}},location:{hash:''},setTimeout:f=>f(),FormData:class{}});
vm.runInContext(fs.readFileSync('wwwroot/app.js','utf8'),context);
(async()=>{
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal((get('#cards').innerHTML.match(/<article /g)||[]).length,25);
 assert.equal((get('#giftvenue').innerHTML.match(/<option value="[^"]+"/g)||[]).length,26);
 console.log('PASS: All 25 hotels render in browsing and calculator');
 for(const v of data){assert.ok(v.photo&&fs.existsSync('wwwroot'+v.photo),v.name);assert.ok(v.photoUrl&&v.photoCredit&&v.photoPage);}
 console.log('PASS: Every hotel has a local photo and provenance');
 get('#area').value='Butterworth';get('#filters').oninput();assert.equal((get('#cards').innerHTML.match(/<article /g)||[]).length,3);
 console.log('PASS: Butterworth filter excludes neighbouring mainland towns');
 get('#area').value='';get('#filters').oninput();let boxes=get('#cards').querySelectorAll('[data-select]');
 // Assign handlers through the rendered element instances retained by the DOM adapter.
 const original=Element.prototype.querySelectorAll;let rendered;
 Element.prototype.querySelectorAll=function(s){const result=original.call(this,s);if(this===get('#cards')&&s==='[data-select]')rendered=result;return result;};
 get('#filters').oninput();for(const box of rendered.slice(0,4)){box.checked=true;box.onchange();}assert.equal(get('#count').textContent,3);assert.equal(rendered[3].checked,false);
 console.log('PASS: Three-hotel comparison retained; fourth selection rejected');
 const html=fs.readFileSync('wwwroot/index.html','utf8');assert.doesNotMatch(html,/id="giftsearch"|id="giftmatches"/);
 console.log('PASS: Redundant calculator search removed');
 get('#giftvenue').value='gurney';get('#giftform').elements.tablePrice.value='1600';get('#giftvenue').onchange();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(get('#giftform').elements.tablePrice.value,2000);assert.match(get('#giftcontext').innerHTML,/GENERAL FALLBACK/);assert.match(get('#giftresult').innerHTML,/YOUR TOTAL ANGPAO/);assert.equal(get('#giftadjustments').open,false);
 console.log('PASS: Hotel without a verified price automatically gets an explicitly labelled fallback and angpao result');
 get('#giftvenue').value='eo';get('#giftvenue').onchange();await new Promise(resolve=>setImmediate(resolve));assert.equal(get('#giftform').elements.tablePrice.value,2700);assert.match(get('#giftcontext').innerHTML,/ILLUSTRATIVE HOTEL/);assert.doesNotMatch(get('#giftcontext').innerHTML,/GENERAL FALLBACK/);
 console.log('PASS: Existing hotel estimate uses its own range midpoint');
 get('#giftform').elements.guests.value='2';get('#giftform').oninput({target:{id:''}});await new Promise(resolve=>setImmediate(resolve));assert.match(get('#giftresult').innerHTML,/For 2 guests/);assert.match(get('#giftresult').innerHTML,/540/);
 console.log('PASS: Changing guest count automatically recalculates');
 get('#giftvenue').value='manual';get('#giftvenue').onchange();assert.equal(get('#giftadjustments').open,true);assert.equal(get('#giftform').elements.tablePrice.value,'');
 console.log('PASS: Manual table pricing remains an optional override');
 for(const v of data){assert.ok(v.guestEstimate.reference>0);assert.ok(v.guestEstimate.low<=v.guestEstimate.reference&&v.guestEstimate.reference<=v.guestEstimate.high);}
 console.log('PASS: All 25 hotels have transparent, bounded guest estimate assumptions');
 get('#clear').onclick();assert.equal(get('#count').textContent,0);
 console.log('All frontend checks passed.');
})();
