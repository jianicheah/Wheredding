const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let doc=null,current=null,token='',dirty=false,busy=false,hotelsDirty=false,contactDirty=false;
let pendingImageUploads=0;
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const hotelFields=[['id','Hotel ID (unique, lowercase, no spaces)'],['name','Hotel name'],['area','Location','select','Island|Mainland'],['district','Town / district'],['style','Venue style'],['capacity','Maximum guests (leave blank if unknown)','number'],['address','Full address','textarea'],['mapUrl','Google Maps link (https, optional)','url'],['phone','Hotel phone'],['email','Hotel email','email'],['source','Official venue source','url'],['checkedAt','Venue facts checked on','date'],['weddingVerified','Hotel details verified against source','checkbox'],['fact','Verified facts / enquiry notes','textarea'],['photoAlt','Image description'],['photoPage','Image source page','url'],['photoCredit','Image credit'],['photoUrl','Original image URL (optional)','url']];
const packageFields=[['id','Package ID (unique within hotel)'],['name','Package name'],['amount','Published table price (RM)','number'],['seats','Seats per table','number'],['seatsConfirmed','Seats confirmed by source','checkbox'],['chargeLabel','Price notation','select','nett|+|++'],['servicePercent','Additional service charge (%)','number'],['taxPercent','Additional tax (%)','number'],['chargesComplete','All compulsory charges accounted for','checkbox'],['source','Published package source (https required)','url'],['checkedAt','Price last checked on','date'],['validUntil','Valid until (blank if not stated)','date'],['validity','Validity explanation','textarea'],['conditions','Minimum tables, extras and conditions','textarea'],['menuSummary','Menu summary','textarea'],['chinese','Chinese banquet package','checkbox']];
const contactFields=[['heading','Contact section heading'],['message','Message','textarea'],['email','Wheredding email','email'],['phone','Wheredding phone']];
function status(text,error=false){$('#status').textContent=text;$('#status').className=error?'error':'';document.querySelectorAll('.package-save-status').forEach(el=>{el.textContent=text;el.className='package-save-status'+(error?' error':'');});}
async function api(url,options={}){const r=await fetch(url,{...options,headers:{'Content-Type':'application/json','X-CSRF-TOKEN':token,...options.headers}});if([404,405].includes(r.status)&&url.startsWith('/api/admin/'))throw Error('This save feature is not available in the running server. Keep a copy of your draft, restart Wheredding with dotnet run, then refresh and sign in again.');const d=await r.json().catch(()=>({error:'The server could not complete this request.'}));if(!r.ok){if(r.status===401 && doc){$('#workspace').hidden=true;$('#login-panel').hidden=false;}throw Error(d.error||'Please sign in again.');}return d;}
function fieldHtml([key,label,type='text',choices],value,prefix){const id=prefix+'-'+key;return '<label class="'+(type==='textarea'?'wide':'')+'" for="'+id+'">'+(type==='checkbox'?'':'<span>'+esc(label)+'</span>')+(type==='textarea'?'<textarea id="'+id+'" data-key="'+key+'" maxlength="5000">'+esc(value)+'</textarea>':type==='select'?'<select id="'+id+'" data-key="'+key+'">'+choices.split('|').map(x=>'<option '+(value===x?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select>':'<input id="'+id+'" data-key="'+key+'" type="'+type+'" '+(type==='checkbox'?(value?'checked':''):'value="'+esc(value)+'"')+(type==='number'?' step="0.01" min="0"':'')+(type==='text'?' maxlength="2000"':'')+'>')+(type==='checkbox'?esc(label):'')+'</label>';}
function fillFields(container,fields,obj,prefix){container.innerHTML=fields.map(f=>fieldHtml(f,obj[f[0]],prefix)).join('');container.querySelectorAll('[data-key]').forEach(input=>{input.oninput=()=>{const key=input.dataset.key;obj[key]=input.type==='checkbox'?input.checked:input.type==='number'?(input.value===''?null:Number(input.value)):input.value;if(key==='validUntil' && !input.value)obj[key]=null;changed(prefix==='contact'?'contact':'hotels');if(prefix==='hotel' && ['name','district','area'].includes(key))renderList();if(prefix==='hotel' || prefix.startsWith('pkg'))preview();};});}
function updateRevision(){dirty=hotelsDirty||contactDirty;$('#revision').textContent='Revision '+doc.revision+(dirty?' · Unsaved: '+[hotelsDirty?'hotels & packages':'',contactDirty?'Contact Us':''].filter(Boolean).join(', '):' · All changes saved');}
function contactStatus(message,error=false){$('#contact-save-status').textContent=message;$('#contact-save-status').className=error?'error':'';}
function changed(section='hotels'){if(section==='contact'){contactDirty=true;contactStatus('Unsaved contact changes. Click Save Contact Us to publish.');}else hotelsDirty=true;updateRevision();}
let savingSection=null;
function setBusy(value,section=savingSection){
 busy=value;savingSection=value?section:null;
 const savingHotels=savingSection==='hotels',savingContact=savingSection==='contact';
 $('#save-hotel-details').disabled=savingHotels||pendingImageUploads>0;
 $('#save-hotel-details').textContent=savingHotels?'Saving…':'Save hotels & packages';
 $('#save-contact').disabled=savingContact;
 $('#save-contact').textContent=savingContact?'Saving…':'Save Contact Us';
 document.querySelectorAll('[data-save-packages]').forEach(b=>{b.disabled=savingHotels||pendingImageUploads>0;b.textContent=savingHotels?'Saving…':'Save hotels & packages';});
}
function hotelStatus(text,error=false){
 status(text,error);
 const local=$('#hotel-save-status');local.textContent=text;local.className='hotel-save-status'+(error?' error':'');
}
function showInvalidHotelField(input){
 if(!input)return;
 const panel=input.closest('[data-editor-panel]');if(panel)selectEditorTab(panel.dataset.editorPanel);
 const packagePanel=input.closest('[data-package-index]');if(packagePanel)selectPackage(Number(packagePanel.dataset.packageIndex));
 const label=input.closest('label')?.querySelector('span')?.textContent||'Highlighted field';
 hotelStatus(label+': '+input.validationMessage,true);input.focus();input.scrollIntoView({block:'center'});input.reportValidity();
}
function renderList(){
 const q=$('#hotel-search').value.trim().toLowerCase(),rows=doc.venues.map((v,i)=>({v,i})).filter(({v})=>(v.name+' '+v.district).toLowerCase().includes(q));
 $('#hotel-count').textContent=rows.length+' of '+doc.venues.length+' hotels · '+doc.venues.filter(v=>v.archived).length+' archived';
 $('#hotel-list').innerHTML=rows.length?rows.map(({v,i})=>'<tr class="'+(v===current?'is-selected ':'')+(v.archived?'is-archived':'')+'"><th scope="row">'+esc(v.name)+'</th><td>'+esc(v.area==='Island'?'Penang Island':'Mainland')+'</td><td>'+esc(v.district)+'</td><td>'+v.packages.length+'</td><td><span class="hotel-status '+(v.archived?'archived':'active')+'">'+(v.archived?'Archived':'Active')+'</span></td><td class="hotel-row-actions"><div><button type="button" data-edit="'+i+'" aria-label="Edit '+esc(v.name)+'">Edit</button><button type="button" class="'+(v.archived?'restore-action':'archive-action')+'" data-archive="'+i+'" aria-label="'+(v.archived?'Restore ':'Archive ')+esc(v.name)+'">'+(v.archived?'Restore':'Archive')+'</button></div></td></tr>').join(''):'<tr><td colspan="6" class="hotel-empty">No hotels match your search. Try another name or town.</td></tr>';
 $('#hotel-list').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editHotel(Number(b.dataset.edit)));
 $('#hotel-list').querySelectorAll('[data-archive]').forEach(b=>b.onclick=()=>{const v=doc.venues[Number(b.dataset.archive)];v.archived=!v.archived;changed();renderList();if(v===current)preview();status(v.name+(v.archived?' archived in your draft.':' restored in your draft.')+' Click Save & publish changes to update the public guide.');});
}
let activePackage=0;
const packageLabels=new WeakMap();
const editorTabs=['general','packages','preview'];
function selectEditorTab(name,focus=false){
 editorTabs.forEach(tab=>{
  const selected=tab===name,button=$('#editor-tab-'+tab);
  button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
  $('#editor-panel-'+tab).hidden=!selected;
 });
 if(name==='preview')preview();
 if(focus)$('#editor-tab-'+name).focus();
}
editorTabs.forEach((name,index)=>{
 const button=$('#editor-tab-'+name);
 button.onclick=()=>selectEditorTab(name);
 button.onkeydown=e=>{
  let next;
  if(e.key==='ArrowRight')next=(index+1)%editorTabs.length;
  else if(e.key==='ArrowLeft')next=(index+editorTabs.length-1)%editorTabs.length;
  else if(e.key==='Home')next=0;
  else if(e.key==='End')next=editorTabs.length-1;
  else return;
  e.preventDefault();selectEditorTab(editorTabs[next],true);
 };
});
function editHotel(i){current=doc.venues[i];activePackage=0;$('#hotel-save-status').textContent='';$('#hotel-editor').hidden=false;$('#hotel-title').textContent=current.name;$('#hotel-actions').hidden=false;fillFields($('#hotel-fields'),hotelFields,current,'hotel');renderHotelImage();renderPackages();renderList();selectEditorTab('general');preview();$('#hotel-title').focus();}
function selectPackage(index,focus=false){
 activePackage=index;
 $('#package-tabs').querySelectorAll('[role="tab"]').forEach((button,i)=>{
  const selected=i===index;
  button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
  $('#package-panel-'+i).hidden=!selected;
 });
 if(focus){const button=$('#package-tab-'+index);button?.focus();button?.scrollIntoView({block:'nearest',inline:'nearest'});}
}
function confirmPackageDelete(name){
 const dialog=$('#delete-package-dialog');
 if(dialog.open)return Promise.resolve(false);
 $('#delete-package-message').textContent='Delete “'+(name||'New package')+'”?';
 dialog.returnValue='cancel';
 return new Promise(resolve=>{
  dialog.addEventListener('close',()=>resolve(dialog.returnValue==='delete'),{once:true});
  dialog.showModal();
 });
}
function renderPackages(){
 activePackage=Math.max(0,Math.min(activePackage,current.packages.length-1));
 $('#package-tabs').innerHTML=current.packages.map((p,i)=>{
  if(!packageLabels.has(p))packageLabels.set(p,p.name||'Unnamed package');
  return '<button type="button" role="tab" id="package-tab-'+i+'" aria-controls="package-panel-'+i+'" aria-selected="false" tabindex="-1">'+esc(packageLabels.get(p))+'</button>';
 }).join('');
 $('#package-list').innerHTML=current.packages.length?current.packages.map((p,i)=>'<section class="package-editor" id="package-panel-'+i+'" role="tabpanel" aria-labelledby="package-tab-'+i+'" data-package-index="'+i+'" hidden><div class="admin-fields" id="pkg-'+i+'"></div><div class="package-save-bar"><div class="package-save-buttons"><button type="button" class="package-save" data-save-packages>Save hotels &amp; packages</button><button type="button" class="package-delete" data-remove="'+i+'">Delete this package</button></div><p class="package-save-status" role="status" aria-live="polite">Saves all hotel and package edits. Deletion takes effect after saving.</p></div></section>').join(''):'<p>No banquet packages yet. Choose Add banquet package to create one.</p>';
 current.packages.forEach((p,i)=>{
  fillFields($('#pkg-'+i),packageFields,p,'pkg'+i);
  const source=$('#pkg'+i+'-source');source.required=true;source.pattern='https://.+';source.title='Enter the HTTPS link to the published package source.';
  ['id','name','amount','seats','checkedAt','validity','conditions','menuSummary'].forEach(key=>$('#pkg'+i+'-'+key).required=true);
 });
 $('#package-list').querySelectorAll('[data-save-packages]').forEach(b=>{b.disabled=savingSection==='hotels'||pendingImageUploads>0;b.onclick=saveHotels;});
 $('#package-tabs').querySelectorAll('[role="tab"]').forEach((button,i)=>{
  button.onclick=()=>selectPackage(i);
  button.onkeydown=e=>{
   const count=current.packages.length;let next;
   if(e.key==='ArrowRight')next=(i+1)%count;
   else if(e.key==='ArrowLeft')next=(i+count-1)%count;
   else if(e.key==='Home')next=0;
   else if(e.key==='End')next=count-1;
   else return;
   e.preventDefault();selectPackage(next,true);
  };
 });
 $('#package-list').querySelectorAll('[data-remove]').forEach(b=>b.onclick=async()=>{
  const hotel=current,index=Number(b.dataset.remove),item=hotel.packages[index];
  if(await confirmPackageDelete(item.name)){
   if(current!==hotel || hotel.packages[index]!==item)return;
   current.packages.splice(index,1);
   if(index<activePackage)activePackage--;
   changed();renderPackages();preview();
   if(current.packages.length)selectPackage(activePackage,true);else $('#new-package').focus();
  }
 });
 selectPackage(activePackage);
}
function updateSavedPackageLabels(savedVenues){
 savedVenues.forEach((hotel,hotelIndex)=>hotel.packages.forEach((p,packageIndex)=>{
  const draft=doc.venues[hotelIndex]?.packages[packageIndex];
  if(draft && draft.id===p.id)packageLabels.set(draft,p.name||'Unnamed package');
 }));
 if(current)$('#package-tabs').querySelectorAll('[role="tab"]').forEach((button,i)=>{button.textContent=packageLabels.get(current.packages[i])||'New package';});
}


function renderHotelImage(){
 const hotel=current,host=document.createElement('div');host.className='hotel-image-editor wide';
 $('#hotel-fields').append(host);
 const safePhoto=(hotel.photo?.startsWith('/images/hotels/')&&!hotel.photo.includes('..'))||/^https:\/\//.test(hotel.photo||'');
 host.innerHTML='<h3>Hotel image</h3><img class="hotel-current-image" alt="'+esc(hotel.photoAlt||hotel.name)+'" '+(safePhoto?'src="'+esc(hotel.photo)+'"':'hidden')+'><p class="image-empty" '+(safePhoto?'hidden':'')+'>No hotel image selected.</p><label>Choose a replacement image<input type="file" accept="image/jpeg,image/png,image/webp"></label><p>JPEG, PNG or WebP, up to 1 MB. Upload the image, then save hotel changes to publish it.</p><p class="image-upload-status" role="status" aria-live="polite"></p>';
 const input=host.querySelector('input'),image=host.querySelector('img'),feedback=host.querySelector('.image-upload-status');
 image.onerror=()=>{image.hidden=true;const empty=host.querySelector('.image-empty');empty.hidden=false;empty.textContent='Current image could not load. Choose a replacement if needed.';};
 input.onchange=async()=>{
  const file=input.files[0];if(!file)return;
  if(file.size>1048576 || !['image/jpeg','image/png','image/webp'].includes(file.type)){feedback.textContent='Choose a JPEG, PNG or WebP image, up to 1 MB.';input.value='';return;}
  input.disabled=true;pendingImageUploads++;setBusy(busy);feedback.textContent='Uploading image…';
  try{
   const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read the selected file.'));reader.readAsDataURL(file);});
   const result=await api('/api/admin/images',{method:'POST',body:JSON.stringify({base64:data.slice(data.indexOf(',')+1)})});
   hotel.photo=result.url;changed();image.src=result.url;image.hidden=false;host.querySelector('.image-empty').hidden=true;
   feedback.textContent='Image uploaded. Save hotel changes to publish it.';if(current===hotel)preview();
  }catch(e){feedback.textContent=e.message;}finally{pendingImageUploads--;setBusy(busy);input.disabled=false;input.value='';}
 };
}

function preview(){if(!current)return;$('#preview').innerHTML='<p><strong>Unsaved draft · '+(current.archived?'Archived':'Visible in guide')+'</strong></p>'+((current.photo.startsWith('/images/hotels/')&&!current.photo.includes('..'))||/^https:\/\//.test(current.photo)?'<img src="'+esc(current.photo)+'" alt="'+esc(current.photoAlt)+'">':'')+'<h3>'+esc(current.name)+'</h3><p>'+esc(current.address)+'</p><p>'+esc(current.phone)+' · '+esc(current.email)+'</p>'+current.packages.map(p=>'<p><strong>'+esc(p.name)+': RM '+esc(p.amount)+' '+esc(p.chargeLabel)+'</strong> / '+esc(p.seats)+' guests'+(!p.seatsConfirmed?' (assumed)':'')+'<br>'+esc(p.menuSummary)+'<br>'+(p.validUntil&&p.validUntil<today()?'Historical · expired '+esc(p.validUntil):p.validUntil?'Valid until '+esc(p.validUntil):'Validity unconfirmed')+(!p.chargesComplete?' · extra charges unconfirmed':'')+'</p>').join('');}
async function load(){doc=await api('/api/admin/content');current=null;dirty=hotelsDirty=contactDirty=false;$('#workspace').hidden=false;$('#login-panel').hidden=true;$('#logout').hidden=false;updateRevision();contactStatus('No unsaved contact changes.');$('#hotel-fields').innerHTML='';$('#hotel-actions').hidden=true;$('#hotel-editor').hidden=true;$('#hotel-title').textContent='Select a hotel';renderList();fillFields($('#contact-form'),contactFields,doc.contact,'contact');status('Saved content loaded. Use Edit in the hotel table or add a hotel.');}
async function session(expectAuthenticated=false){const s=await api('/api/admin/session');token=s.csrfToken;$('#storage').textContent='Storage: '+s.storage;if(!s.enabled){status('Admin editing is not configured. Set persistent storage and administrator credentials on the server. Public browsing still works.',true);return;}if(s.authenticated){status('Signed in. Loading your hotels…');await load();}else{if(expectAuthenticated)throw Error('The sign-in cookie was not accepted. Use the same website address throughout sign-in and restart the app if credentials were changed.');$('#login-panel').hidden=false;status('Sign in to manage Wheredding.');}}
$('#login').onsubmit=async e=>{e.preventDefault();const button=e.submitter||$('#login button');if(button)button.disabled=true;status('Signing in…');try{const f=new FormData(e.target);await api('/api/admin/login',{method:'POST',body:JSON.stringify(Object.fromEntries(f))});e.target.reset();await session(true);}catch(e){status(e.message,true);}finally{if(button)button.disabled=false;}};
$('#logout').onclick=async()=>{if(dirty&&!confirm('Sign out and discard unsaved edits?'))return;try{await api('/api/admin/logout',{method:'POST',body:'{}'});dirty=false;location.reload();}catch(e){status(e.message,true);}};
$('#hotel-search').oninput=renderList;
$('#new-hotel').onclick=()=>{const v={id:'hotel-'+Date.now(),name:'New hotel',area:'Island',district:'',style:'',address:'',phone:'',email:'',source:'',fact:'',weddingVerified:false,capacity:null,checkedAt:today(),photo:'/images/hotels/eo.jpg',photoPage:'',photoUrl:'',photoCredit:'Add image credit',photoAlt:'Replace with this hotel’s image',mapUrl:'',packages:[]};v.photo='';doc.venues.push(v);changed();editHotel(doc.venues.length-1);};
$('#close-editor').onclick=()=>{current=null;$('#hotel-editor').hidden=true;renderList();$('#hotel-search').focus();status(dirty?'Editor closed. Your draft changes are kept; save to publish them.':'Choose Edit beside a hotel to manage its details.');};
$('#new-package').onclick=()=>{current.packages.push({id:'package-'+Date.now(),name:'New package',amount:0,seats:10,seatsConfirmed:false,chargeLabel:'+',servicePercent:0,taxPercent:0,chargesComplete:false,source:'',checkedAt:today(),validUntil:null,validity:'Validity not stated; confirm with hotel.',conditions:'',menuSummary:'',chinese:true,hotelName:current.name});activePackage=current.packages.length-1;changed();renderPackages();selectPackage(activePackage,true);preview();};
$('#hotel-form').onsubmit=e=>e.preventDefault();$('#contact-form').onsubmit=e=>e.preventDefault();
async function saveHotels(){
 if(pendingImageUploads){hotelStatus('Wait for the image upload to finish before saving.',true);return;}
 if(busy){hotelStatus('Contact Us is saving. Please try saving hotels again when it finishes.',true);return;}if(!hotelsDirty){hotelStatus('No unsaved hotel or package changes. Use Save Contact Us for contact details.');return;}
 // Check every draft package, including hotels outside the open editor.
 for(let h=0;h<doc.venues.length;h++)for(let p=0;p<doc.venues[h].packages.length;p++){
  const item=doc.venues[h].packages[p];let validSource=false;
  try{validSource=new URL(item.source).protocol==='https:';}catch{}
  if(!validSource){
   if(current!==doc.venues[h])editHotel(h);
   selectEditorTab('packages');selectPackage(p);
   hotelStatus('Cannot save “'+(item.name||'New package')+'”: enter an HTTPS link in Published package source.',true);
   const input=$('#pkg'+p+'-source');input.focus();input.scrollIntoView({block:'center'});input.reportValidity();return;
  }
 }
 if(!$('#hotel-form').checkValidity()){
  $('#hotel-editor').hidden=false;
  const invalid=$('#hotel-form').querySelector('input:invalid,select:invalid,textarea:invalid');
  const panel=invalid?.closest('[data-editor-panel]');
  if(panel)selectEditorTab(panel.dataset.editorPanel);
  const packagePanel=invalid?.closest('[data-package-index]');if(packagePanel)selectPackage(Number(packagePanel.dataset.packageIndex));
  showInvalidHotelField(invalid);return;
 }
 const snapshot=JSON.stringify(doc.venues);setBusy(true,'hotels');hotelStatus('Saving hotels and packages…');
 try{const r=await api('/api/admin/hotels',{method:'PUT',body:JSON.stringify({venues:JSON.parse(snapshot),expectedRevision:doc.revision})});updateSavedPackageLabels(JSON.parse(snapshot));doc.revision=r.revision;hotelsDirty=JSON.stringify(doc.venues)!==snapshot;updateRevision();hotelStatus('Hotels and packages published.'+(hotelsDirty?' New hotel edits are still unsaved.':'')+(contactDirty?' Contact Us changes are still unsaved; use Save Contact Us.':''));}
 catch(e){hotelStatus(e.message,true);}finally{setBusy(false);}
};
$('#save-hotel-details').onclick=saveHotels;
$('#save-contact').onclick=async()=>{
 if(busy){contactStatus('Hotels and packages are saving. Please try saving Contact Us again when they finish.',true);return;}if(!contactDirty){contactStatus('No unsaved contact changes.');return;}if(!$('#contact-form').reportValidity())return;
 const snapshot=JSON.stringify(doc.contact);setBusy(true,'contact');contactStatus('Saving Contact Us…');
 try{const r=await api('/api/admin/contact',{method:'PUT',body:JSON.stringify({contact:JSON.parse(snapshot),expectedRevision:doc.revision})});doc.revision=r.revision;contactDirty=JSON.stringify(doc.contact)!==snapshot;updateRevision();contactStatus(contactDirty?'Contact Us published. New contact edits are still unsaved.':'Contact Us saved and published successfully.'+(hotelsDirty?' Hotel and package edits remain unsaved.':''));}
 catch(e){contactStatus(e.message,true);}finally{setBusy(false);}
};
const reloadButton=$('#reload');
if(reloadButton)reloadButton.onclick=async()=>{if(dirty&&!confirm('Discard unsaved edits and reload the saved content?'))return;try{await load();}catch(e){status(e.message,true);}};
$('#history-refresh').onclick=async()=>{try{const rows=await api('/api/admin/history');$('#history').innerHTML=rows.length?rows.map(r=>'<div class="history-row"><span>Revision '+r.revision+' · '+esc(new Date(r.savedAt).toLocaleString())+' · '+esc(r.actor)+'</span><button data-restore="'+r.revision+'">Restore</button></div>').join(''):'No earlier revisions yet.';$('#history').querySelectorAll('button').forEach(b=>b.onclick=async()=>{if(!confirm('Restore all hotels, packages and contact information from revision '+b.dataset.restore+'? Unsaved edits will be discarded.'))return;try{await api('/api/admin/restore/'+b.dataset.restore,{method:'POST',body:JSON.stringify({expectedRevision:doc.revision})});await load();status('Previous revision restored and published.');}catch(e){status(e.message,true);}});}catch(e){status(e.message,true);}};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
session().catch(e=>status(e.message,true));
