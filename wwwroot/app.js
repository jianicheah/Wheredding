const $ = selector => document.querySelector(selector);
let venues = [], selected = new Set();
let giftBasis = null, giftRequest = 0;
const money = value => new Intl.NumberFormat('en-MY', {style:'currency',currency:'MYR',maximumFractionDigits:0}).format(value);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const maps = v => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(v.name + ' ' + v.district + ' Penang');
const link = (url,label) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} ↗</a>`;
const badge = v => `<span class="badge ${v.weddingVerified?'verified':''}">${v.weddingVerified?'✓ Wedding venue fact verified':'? Wedding details: enquire first'}</span>`;
const price = v => v.low != null ? `${money(v.low)}–${money(v.high)}` : 'Request a quotation';
const menu = v => v.courses.length ? `<ol>${v.courses.map(c=>`<li>${escapeHtml(c)}</li>`).join('')}</ol>` : '<p>Current Chinese banquet menu not verified. Ask the hotel for its dated menu, dietary options and package inclusions.</p>';
const photo = (v,large=false) => v.photo ? `<figure class="hotel-photo ${large?'large':''}"><img src="${escapeHtml(v.photo)}" alt="${escapeHtml(v.photoAlt)}" loading="lazy" width="800" height="450"><figcaption>${link(v.photoPage,v.photoCredit||'Photo source')}</figcaption></figure>` : `<div class="photo-unavailable"><span>Photo pending</span><small>A verified photo is not available locally.</small>${link(v.photoPage,'View official hotel gallery')}</div>`;
async function init(){
 try {
  const response=await fetch('/api/venues'); if(!response.ok)throw Error(); venues=await response.json();render();renderGiftOptions();
  $('#coverage').textContent=`${venues.length} hotels in this guide · ${venues.filter(v=>v.area==='Island').length} island · ${venues.filter(v=>v.area==='Mainland').length} mainland. A growing, sourced catalogue; date availability must be confirmed with each hotel.`;
  $('#maplinks').innerHTML=venues.map(v=>`<div class="map-row"><strong>${escapeHtml(v.name)}</strong><small>${escapeHtml(v.district)}</small>${link(maps(v),'Open map & directions')}</div>`).join('');
 }catch{$('#cards').textContent='Venue data could not load. Please refresh or check the local server.';}
}
function renderGiftOptions(){
 const current=$('#giftvenue').value;
 const list=[...venues].sort((a,b)=>a.name.localeCompare(b.name));
 $('#giftvenue').innerHTML='<option value="">Choose the wedding hotel…</option>'+['Island','Mainland'].map(area=>`<optgroup label="${area==='Island'?'Penang Island':'Butterworth & mainland'}">${list.filter(v=>v.area===area).map(v=>`<option value="${v.id}">${escapeHtml(v.name)}</option>`).join('')}</optgroup>`).join('')+'<option value="manual">Other venue / use my own amount</option>';
 $('#giftvenue').value=current;
}
function render(){
 const term=$('#search').value.toLowerCase(),area=$('#area').value,budget=Number($('#budget').value);
 const items=venues.filter(v=>(!area||v.area===area||area==='Butterworth'&&v.district==='Butterworth')&&(!budget||v.low!=null&&v.low<=budget)&&`${v.name} ${v.district} ${v.style}`.toLowerCase().includes(term));
 items.sort((a,b)=>$('#sort').value==='price'?(a.low??Infinity)-(b.low??Infinity)||a.name.localeCompare(b.name):a.name.localeCompare(b.name));
 $('#results').textContent=`${items.length} of ${venues.length} hotels${budget?' · price filter excludes hotels awaiting a quote':''}`;
 $('#cards').innerHTML=items.map(v=>`<article class="card">${photo(v)}<div class="card-body"><p class="eyebrow">${escapeHtml(v.district)} · ${v.area}</p><h3>${escapeHtml(v.name)}</h3><p>${escapeHtml(v.style)}</p>${badge(v)}<div class="price"><strong>${price(v)}</strong><small>${v.low!=null?'Illustrative estimate / table of 10 · before charges':'Current Chinese banquet price not verified'}</small></div><div class="card-actions"><button data-detail="${v.id}" class="quiet">Details & menu ↗</button><label><input type="checkbox" data-select="${v.id}" ${selected.has(v.id)?'checked':''}> Compare</label></div></div></article>`).join('')||'<p class="empty">No hotels match these filters. Try another location or budget.</p>';
 $('#cards').querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>details(b.dataset.detail));
 $('#cards').querySelectorAll('[data-select]').forEach(c=>c.onchange=()=>{if(c.checked&&selected.size===3){c.checked=false;$('#results').textContent='You can compare up to three hotels. Remove one to add another.';return;}c.checked?selected.add(c.dataset.select):selected.delete(c.dataset.select);compare();});compare();
}
function compare(){
 $('#count').textContent=selected.size;const list=venues.filter(v=>selected.has(v.id));
 const rows=[['Location',v=>escapeHtml(v.district)],['Venue evidence',badge],['Table price / 10 guests',price],['Price per person',v=>v.low!=null?money(v.low/10)+'–'+money(v.high/10)+' (illustrative)':'Quote required'],['Verified capacity',v=>v.capacity?v.capacity+' guests; confirm layout':'Ask hotel; not verified'],['Menu information',menu],['Source',v=>link(v.weddingSource||v.source,'Venue source')]];
 $('#comparison').innerHTML=list.length?`<div class="table-scroll"><table><caption>Chinese banquet comparison — estimates and quotation gaps clearly marked</caption><thead><tr><th scope="col">Planning detail</th>${list.map(v=>`<th scope="col">${escapeHtml(v.name)}<br><button class="quiet" data-remove="${v.id}">Remove</button></th>`).join('')}</tr></thead><tbody>${rows.map(([title,fn])=>`<tr><th scope="row">${title}</th>${list.map(v=>`<td>${fn(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><button id="print" class="quiet">Print comparison</button>`:'<div class="empty">Your comparison starts here. Select “Compare” on any three hotel cards.</div>';
 document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{selected.delete(b.dataset.remove);render();});if($('#print'))$('#print').onclick=()=>window.print();
}
function details(id){
 const v=venues.find(v=>v.id===id);
 $('#detailbody').innerHTML=`${photo(v,true)}<p class="eyebrow">${escapeHtml(v.district)}</p><h2>${escapeHtml(v.name)}</h2>${badge(v)}<p>${escapeHtml(v.fact)}</p><p>${link(v.weddingSource||v.source,'Venue source')} · Checked 12 October 2026</p><hr><h3>Chinese banquet information</h3><p><strong>${price(v)}${v.low!=null?' per table of 10':''}</strong></p>${v.low!=null?'<p class="notice">Illustrative planning estimate only. The dishes below are editorial examples, not a verified hotel menu. Request a dated quote for charges, minimum tables and availability.</p>':'<p class="notice">No verified current table price is recorded. The guest calculator can use a general illustrative fallback; it is not a price verified for this hotel.</p>'}${menu(v)}<button class="button" id="usehotel">Use this hotel in calculator →</button><h3>Location & contact</h3><p>${escapeHtml(v.address)}</p><p>${v.phone?`<a href="tel:${escapeHtml(v.phone)}">${escapeHtml(v.phone)}</a>`:'Telephone: use official website'}</p><p>${v.email?`<a href="mailto:${escapeHtml(v.email)}">${escapeHtml(v.email)}</a>`:'Email: use official website enquiry'}</p><p>${link(maps(v),'Map & directions')} · ${link(v.source,'Contact hotel / official information')}</p><p class="small">Map searches open an external service. Confirm the venue entrance before travelling. Hotel photographs show the property or an event space and do not promise a package setup.</p>`;
 $('#usehotel').onclick=()=>{renderGiftOptions();$('#giftvenue').value=v.id;chooseGiftVenue();$('#detail').close();location.hash='calculator';};$('#detail').showModal();
}
function chooseGiftVenue(){
 ++giftRequest;
 const v=venues.find(v=>v.id===$('#giftvenue').value),form=$('#giftform');
 giftBasis=v?{name:v.name,...v.guestEstimate}:null;
 form.elements.tablePrice.value=giftBasis?giftBasis.reference:'';
 form.elements.seats.value=10;form.elements.servicePercent.value=0;form.elements.taxPercent.value=0;
 $('#giftadjustments').open=$('#giftvenue').value==='manual';
 if(giftBasis){
  $('#giftcontext').innerHTML=`<p class="eyebrow">${giftBasis.kind==='hotel-illustrative'?'ILLUSTRATIVE HOTEL PLANNING RANGE':'GENERAL FALLBACK · HOTEL RATE UNKNOWN'}</p><strong class="table-estimate">${money(giftBasis.low)}–${money(giftBasis.high)} <small>/ table of 10</small></strong><p>About ${money(giftBasis.low/10)}–${money(giftBasis.high/10)} per person, before unconfirmed charges.</p><p class="small">${giftBasis.kind==='hotel-illustrative'?'This is an editorial estimate, not a verified hotel package.':'No hotel-specific price is verified. This shared illustrative scenario is used for all hotels without a price; it is not a market average or a quote for this hotel.'} The calculator uses the midpoint, ${money(giftBasis.reference)}, with 10 seats and no added charges. Actual packages and costs may differ.</p>`;
  calculateGift();
 }else{
  $('#giftcontext').textContent=$('#giftvenue').value==='manual'?'Enter your table amount in the optional section below.':'Choose your hotel to see an automatic table estimate. No quotation needed.';
  $('#giftresult').innerHTML='<span>囍</span><h3>A thoughtful gift,<br>on your terms.</h3><p>Choose the wedding hotel to see your estimated table cost and angpao reference.</p>';
 }
}
async function calculateGift(){
 const form=$('#giftform'),fields=['tablePrice','seats','guests','servicePercent','taxPercent','extra','budget'];
 const input=Object.fromEntries(fields.map(k=>[k,Number(form.elements[k].value)]));
 input.venueId=venues.some(v=>v.id===$('#giftvenue').value)?$('#giftvenue').value:null;
 input.priceMode=giftBasis&&input.tablePrice===giftBasis.reference?'hotel':'manual';
 const request=++giftRequest;
 if(!$('#giftvenue').value||fields.some(k=>form.elements[k].value===''||!form.elements[k].checkValidity())){
  $('#giftresult').innerHTML='<h3>Almost there.</h3><p>Choose a hotel and enter valid guest counts and amounts. For another venue, enter your table amount under optional adjustments.</p>';return;
 }
 $('#giftresult').innerHTML='<p>Calculating your reference…</p>';
 try{
  const r=await fetch('/api/calculator',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
  const d=await r.json();if(request!==giftRequest)return;if(!r.ok)throw Error(d.error||(r.status===429?'Too many calculations. Please try again in a minute.':'Unable to calculate'));
  const usingEstimate=d.priceMode==='hotel';
  $('#giftresult').innerHTML=`<p class="eyebrow">YOUR TOTAL ANGPAO REFERENCE</p><h3>${money(d.suggested)}</h3><p>For ${input.guests} guest${input.guests===1?'':'s'}, rounded up to the next RM 10.</p><dl><dt>${usingEstimate?'Estimated table cost':'Your entered table cost'} including entered charges</dt><dd>${money(d.tableTotal)}</dd><dt>Meal cost per person</dt><dd>${money(d.tableTotal/input.seats)}</dd><dt>Your guests’ meal share</dt><dd>${money(d.mealShare)}</dd><dt>Your extra gift</dt><dd>${money(input.extra)}</dd></dl><p class="small">${usingEstimate?'Uses the midpoint of the illustrative range. This is not the couple’s actual bill.':'Uses your entered amount and charges.'} Charges default to 0%; adjust them if known. Your gift is voluntary—choose an amount comfortable for you.</p>${!d.withinBudget?`<p class="notice">This reference exceeds your budget. Giving within your ${money(input.budget)} budget is completely valid.</p>`:''}<p class="small">Formula: table × (1 + service %) × (1 + tax %) ÷ seats × guests + extra; round up to RM 10.</p>`;
 }catch(err){if(request===giftRequest)$('#giftresult').textContent=err.message||'Local server unavailable. Try again.';}
}
$('#filters').oninput=render;$('#filters').onsubmit=e=>e.preventDefault();$('#filters').onreset=()=>setTimeout(render,0);
$('#clear').onclick=()=>{selected.clear();render();};$('.close').onclick=()=>$('#detail').close();$('#detail').onclick=e=>{if(e.target===$('#detail'))$('#detail').close();};
$('#giftvenue').onchange=chooseGiftVenue;
$('#giftform').oninput=e=>{if(e.target.id!=='giftvenue')calculateGift();};
$('#giftform').onsubmit=e=>{e.preventDefault();calculateGift();};
init();
