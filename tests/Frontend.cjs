const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const base=process.env.BASE_URL||'http://127.0.0.1:5299';
(async()=>{
const data=await (await fetch(base+'/api/venues')).json();
class Element{
 constructor(){this.value='';this.innerHTML='';this.textContent='';this.dataset={};this.checked=false;}
 querySelectorAll(s){const attr=s.slice(1,-1);return [...this.innerHTML.matchAll(new RegExp(attr+'="([^"]+)"','g'))].map(m=>{const e=new Element();e.dataset[attr.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=m[1];return e;});}
 checkValidity(){return true;}showModal(){this.open=true;}close(){this.open=false;}
}
const nodes=new Map(),get=s=>{if(!nodes.has(s))nodes.set(s,new Element());return nodes.get(s);};
get('#budget').value='0';get('#sort').value='name';get('#giftform').elements=Object.fromEntries(['tablePrice','seats','guests','servicePercent','taxPercent','extra','budget'].map(k=>[k,new Element()]));
for(const [k,v] of Object.entries({tablePrice:'',seats:'10',guests:'1',servicePercent:'0',taxPercent:'0',extra:'0',budget:'0'}))get('#giftform').elements[k].value=v;
const pending=[];
const context=vm.createContext({document:{querySelector:get,querySelectorAll:s=>get('#comparison').querySelectorAll(s)},fetch:async(url,options)=>{
 if(url==='/api/venues')return {ok:true,json:async()=>data};
 const response=await fetch(base+url,options),body=response.json();pending.push(body);
 return {ok:response.ok,status:response.status,json:()=>body};
},Intl,console,window:{print(){}},location:{hash:''},setTimeout:f=>f()});
vm.runInContext(fs.readFileSync('wwwroot/app.js','utf8'),context);
async function settle(){for(let n=0;n<200;n++){await new Promise(r=>setTimeout(r,10));if(!get('#giftresult').innerHTML.includes('Calculating'))return;}throw Error('Calculator did not finish');}
await new Promise(r=>setImmediate(r));
const seed=JSON.parse(fs.readFileSync('Data/venues.json','utf8'));
assert.deepEqual(data.map(v=>v.id).sort(),seed.filter(v=>!v.archived).map(v=>v.id).sort());
assert.equal((get('#cards').innerHTML.match(/<article /g)||[]).length,Math.min(10,data.length));
assert.equal((get('#giftvenue').innerHTML.match(/<option value="[^"]+"/g)||[]).length,data.length+1);
console.log('PASS: Complete venue catalogue remains in browsing and calculator');
const firstPage=get('#cards').innerHTML;
vm.runInContext('venuePage=2;render()',context);
assert.equal((get('#cards').innerHTML.match(/<article /g)||[]).length,10);
assert.notEqual(get('#cards').innerHTML,firstPage);
assert.match(get('#results').textContent,/Showing 11–20/);
vm.runInContext('venuePage=Math.ceil(venues.length/10);render()',context);
assert.equal((get('#cards').innerHTML.match(/<article /g)||[]).length,data.length%10||10);
get('#search').value='no such venue exists';get('#filters').oninput();
assert.equal(get('#venue-pagination').hidden,true);assert.match(get('#results').textContent,/0 of 0/);
get('#search').value='';get('#filters').oninput();assert.equal(vm.runInContext('venuePage',context),1);
console.log('PASS: Ten results per page, final page, empty results and filter reset');
vm.runInContext("details('doubletree')",context);
assert.match(get('#detailbody').innerHTML,/Directory package & menu references/);
assert.match(get('#detailbody').innerHTML,/Classic Wedding Package RM1,488/);
assert.match(get('#detailbody').innerHTML,/excluded from the calculator/);
vm.runInContext("details('xipalace')",context);
assert.match(get('#detailbody').innerHTML,/Mainland|Alma/);
console.log('PASS: New venues display sourced directory references separately from calculator prices');
for(const v of data){assert.ok(fs.existsSync('wwwroot'+v.photo));assert.ok(v.photoPage);assert.equal(v.guestEstimate,undefined);assert.equal(v.courses,undefined);}
console.log('PASS: Local photos retained; invented price ranges and menus removed');
get('#area').value='Butterworth';get('#filters').oninput();assert.equal((get('#cards').innerHTML.match(/<article /g)||[]).length,3);
get('#area').value='';get('#filters').oninput();
const original=Element.prototype.querySelectorAll;let boxes;
Element.prototype.querySelectorAll=function(s){const r=original.call(this,s);if(this===get('#cards')&&s==='[data-select]')boxes=r;return r;};
get('#filters').oninput();for(const b of boxes.slice(0,4)){b.checked=true;b.onchange();}assert.equal(get('#count').textContent,3);assert.equal(boxes[3].checked,false);
vm.runInContext('venuePage=2;render()',context);assert.equal(get('#count').textContent,3);
vm.runInContext('venuePage=1;render()',context);assert.match(get('#cards').innerHTML,/checked/);
console.log('PASS: Butterworth filter and three-hotel comparison preserved');
get('#giftvenue').value='amari';get('#giftvenue').onchange();await settle();
assert.match(get('#giftcontext').innerHTML,/HOTEL-PUBLISHED/);assert.match(get('#giftresult').innerHTML,/220.*290/);assert.match(get('#giftcontext').innerHTML,/amari.com/);assert.equal(get('#packagechoice').hidden,false);
get('#giftpackage').value='hearts';get('#giftpackage').onchange();await settle();assert.match(get('#giftresult').innerHTML,/250/);
get('#giftform').elements.guests.value='2';get('#giftform').oninput({target:{name:'guests'}});await settle();assert.match(get('#giftresult').innerHTML,/For 2 guests/);assert.match(get('#giftresult').innerHTML,/500/);
console.log('PASS: Published range, optional package, source links and guest count use real API');
get('#giftvenue').value='ixora';get('#giftvenue').onchange();await settle();assert.match(get('#giftcontext').innerHTML,/EXPIRED/);assert.match(get('#giftresult').innerHTML,/HISTORICAL/);
get('#giftvenue').value='olive';get('#giftvenue').onchange();await settle();assert.match(get('#giftcontext').textContent,/not verified\/confirmed/);assert.equal(get('#giftform').elements.tablePrice.value,'');assert.equal(get('#giftadjustments').open,true);assert.match(get('#giftresult').innerHTML,/fill in the table price manually/);
vm.runInContext("details('olive')",context);assert.match(get('#detailbody').innerHTML,/before additional charges/);assert.match(get('#detailbody').innerHTML,/Service charge and tax not confirmed/);assert.doesNotMatch(get('#detailbody').innerHTML,/Meal reference:/);
get('#giftvenue').value='angsana';get('#giftvenue').onchange();await settle();assert.match(get('#giftcontext').innerHTML,/assumes 10/);
console.log('PASS: Expired rates, incomplete charges and assumed seating shown clearly');
get('#giftvenue').value='degarden';get('#giftvenue').onchange();await settle();assert.equal(get('#packagechoice').hidden,true);assert.equal(get('#giftadjustments').open,true);assert.equal(get('#giftform').elements.tablePrice.value,'');assert.match(get('#giftcontext').textContent,/not verified\/confirmed/);assert.match(get('#giftresult').innerHTML,/fill in the table price manually/);assert.doesNotMatch(get('#giftresult').innerHTML,/2,188|2,888|PARKROYAL/);
console.log('PASS: Missing venue price stays blank and opens manual Options');
get('#giftform').elements.tablePrice.value='1000';get('#giftform').oninput({target:{name:'tablePrice'}});await settle();assert.match(get('#giftresult').innerHTML,/YOUR OWN AMOUNT/);assert.match(get('#giftresult').innerHTML,/200/);
get('#giftvenue').value='manual';get('#giftvenue').onchange();assert.equal(get('#giftadjustments').open,true);assert.equal(get('#giftform').elements.tablePrice.value,'');
get('#clear').onclick();assert.equal(get('#count').textContent,0);
console.log('PASS: Manual override is labelled and comparison can be cleared');
console.log('All frontend checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
