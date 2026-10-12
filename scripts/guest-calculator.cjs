const fs=require('node:fs');
const file='wwwroot/app.js';let js=fs.readFileSync(file,'utf8');
js=js.replace("let venues = [], selected = new Set();","let venues = [], selected = new Set();\nlet giftBasis = null, giftRequest = 0;");
const start=js.indexOf('function renderGiftOptions(){'),end=js.indexOf('function render(){',start);
js=js.slice(0,start)+`function renderGiftOptions(){
 const current=$('#giftvenue').value;
 const list=[...venues].sort((a,b)=>a.name.localeCompare(b.name));
 $('#giftvenue').innerHTML='<option value="">Choose the wedding hotel…</option>'+['Island','Mainland'].map(area=>\`<optgroup label="\${area==='Island'?'Penang Island':'Butterworth & mainland'}">\${list.filter(v=>v.area===area).map(v=>\`<option value="\${v.id}">\${escapeHtml(v.name)}</option>\`).join('')}</optgroup>\`).join('')+'<option value="manual">Other venue / use my own amount</option>';
 $('#giftvenue').value=current;
}
`+js.slice(end);
js=js.replace("$('#giftsearch').value='';renderGiftOptions();","renderGiftOptions();");
js=js.replace('Use a quotation from the hotel in the angpao calculator; no estimated hotel price is inserted automatically.','The guest calculator can use a general illustrative fallback; it is not a price verified for this hotel.');
const cstart=js.indexOf('function chooseGiftVenue(){'),cend=js.indexOf("$('#filters').oninput",cstart);
js=js.slice(0,cstart)+`function chooseGiftVenue(){
 ++giftRequest;
 const v=venues.find(v=>v.id===$('#giftvenue').value),form=$('#giftform');
 giftBasis=v?{name:v.name,...v.guestEstimate}:null;
 form.elements.tablePrice.value=giftBasis?giftBasis.reference:'';
 form.elements.seats.value=10;form.elements.servicePercent.value=0;form.elements.taxPercent.value=0;
 $('#giftadjustments').open=$('#giftvenue').value==='manual';
 if(giftBasis){
  $('#giftcontext').innerHTML=\`<p class="eyebrow">\${giftBasis.kind==='hotel-illustrative'?'ILLUSTRATIVE HOTEL PLANNING RANGE':'GENERAL FALLBACK · HOTEL RATE UNKNOWN'}</p><strong class="table-estimate">\${money(giftBasis.low)}–\${money(giftBasis.high)} <small>/ table of 10</small></strong><p>About \${money(giftBasis.low/10)}–\${money(giftBasis.high/10)} per person, before unconfirmed charges.</p><p class="small">\${giftBasis.kind==='hotel-illustrative'?'This is an editorial estimate, not a verified hotel package.':'No hotel-specific price is verified. This shared illustrative scenario is used for all hotels without a price; it is not a market average or a quote for this hotel.'} The calculator uses the midpoint, \${money(giftBasis.reference)}, with 10 seats and no added charges. Actual packages and costs may differ.</p>\`;
  calculateGift();
 }else{
  $('#giftcontext').textContent=$('#giftvenue').value==='manual'?'Enter your table amount in the optional section below.':'Choose your hotel to see an automatic table estimate. No quotation needed.';
  $('#giftresult').innerHTML='<span>囍</span><h3>A thoughtful gift,<br>on your terms.</h3><p>Choose the wedding hotel to see your estimated table cost and angpao reference.</p>';
 }
}
async function calculateGift(){
 const form=$('#giftform'),fields=['tablePrice','seats','guests','servicePercent','taxPercent','extra','budget'];
 const input=Object.fromEntries(fields.map(k=>[k,Number(form.elements[k].value)]));
 const request=++giftRequest;
 if(!$('#giftvenue').value||fields.some(k=>form.elements[k].value===''||!form.elements[k].checkValidity())){
  $('#giftresult').innerHTML='<h3>Almost there.</h3><p>Choose a hotel and enter valid guest counts and amounts. For another venue, enter your table amount under optional adjustments.</p>';return;
 }
 $('#giftresult').innerHTML='<p>Calculating your reference…</p>';
 try{
  const r=await fetch('/api/calculator',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
  const d=await r.json();if(request!==giftRequest)return;if(!r.ok)throw Error(d.error||'Unable to calculate');
  const usingEstimate=giftBasis&&input.tablePrice===giftBasis.reference&&input.seats===10;
  $('#giftresult').innerHTML=\`<p class="eyebrow">YOUR TOTAL ANGPAO REFERENCE</p><h3>\${money(d.suggested)}</h3><p>For \${input.guests} guest\${input.guests===1?'':'s'}, rounded up to the next RM 10.</p><dl><dt>\${usingEstimate?'Estimated table cost':'Your entered table cost'} including entered charges</dt><dd>\${money(d.tableTotal)}</dd><dt>Meal cost per person</dt><dd>\${money(d.tableTotal/input.seats)}</dd><dt>Your guests’ meal share</dt><dd>\${money(d.mealShare)}</dd><dt>Your extra gift</dt><dd>\${money(input.extra)}</dd></dl><p class="small">\${usingEstimate?'Uses the midpoint of the illustrative range. This is not the couple’s actual bill.':'Uses your entered amount and charges.'} Charges default to 0%; adjust them if known. Your gift is voluntary—choose an amount comfortable for you.</p>\${!d.withinBudget?\`<p class="notice">This reference exceeds your budget. Giving within your \${money(input.budget)} budget is completely valid.</p>\`:''}<p class="small">Formula: table × (1 + service %) × (1 + tax %) ÷ seats × guests + extra; round up to RM 10.</p>\`;
 }catch(err){if(request===giftRequest)$('#giftresult').textContent=err.message||'Local server unavailable. Try again.';}
}
`+js.slice(cend);
const tail=js.indexOf("$('#giftsearch').oninput");
js=js.slice(0,tail)+`$('#giftvenue').onchange=chooseGiftVenue;
$('#giftform').oninput=e=>{if(e.target.id!=='giftvenue')calculateGift();};
$('#giftform').onsubmit=e=>{e.preventDefault();calculateGift();};
init();
`;
fs.writeFileSync(file,js);
const data=JSON.parse(fs.readFileSync('Data/venues.json','utf8'));
for(const v of data){const low=v.low??1500,high=v.high??2500;v.guestEstimate={low,high,reference:(low+high)/2,kind:v.low!=null?'hotel-illustrative':'general-fallback',basis:v.low!=null?'Existing editorial hotel planning range; not a verified quotation.':'Shared RM1500–2500 scenario for a table of 10. Editorial assumption, not hotel-specific research or market average.',charges:'Excludes unconfirmed service charge and tax; calculator defaults to 0%.'};}
fs.writeFileSync('Data/venues.json',JSON.stringify(data,null,2));
let html=fs.readFileSync('wwwroot/index.html','utf8');
const fstart=html.indexOf('<form id="giftform">'),fend=html.indexOf('</form>',fstart)+7;
html=html.slice(0,fstart)+`<form id="giftform">
 <label>Which hotel is the wedding at?<select id="giftvenue" required><option value="">Choose the wedding hotel…</option></select></label>
 <div id="giftcontext" class="guest-estimate" aria-live="polite">Choose your hotel to see an automatic table estimate. No quotation needed.</div>
 <div class="field-grid">
  <label>How many guests does your angpao cover?<input name="guests" type="number" min="1" max="100" value="1" required></label>
  <label>Extra gift, total (RM)<input name="extra" type="number" min="0" max="100000" step="0.01" value="0" required></label>
  <label>Your total budget (RM; 0 = unset)<input name="budget" type="number" min="0" max="100000" step="0.01" value="0" required></label>
 </div>
 <details id="giftadjustments" class="gift-adjustments"><summary>Optional: adjust the table estimate or charges</summary>
 <p class="small">You do not need the couple’s quotation. These fields are filled automatically when you choose a hotel. Change them only if you have better information.</p>
 <div class="field-grid">
  <label>Reference table price (RM)<input name="tablePrice" type="number" min="1" max="100000" step="0.01" placeholder="Choose a hotel above" required></label>
  <label>Seats per table<input name="seats" type="number" min="1" max="30" value="10" required></label>
  <label>Service charge (%)<input name="servicePercent" type="number" min="0" max="30" step="0.01" value="0" required></label>
  <label>Tax (%)<input name="taxPercent" type="number" min="0" max="30" step="0.01" value="0" required></label>
 </div><p class="small">0% means no extra charge is included in the estimate. For a nett price, leave both at 0%. Tax is applied after service charge in this model.</p>
 </details>
 <button class="button" type="submit">Update my angpao reference →</button>
</form>`+html.slice(fend);
html=html.replace('Enter your table cost to see a transparent breakdown.','Choose the wedding hotel to see your estimated table cost and angpao reference.');
fs.writeFileSync('wwwroot/index.html',html);
