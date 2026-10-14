const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let doc=null,current=null,token='',dirty=false,busy=false,hotelsDirty=false,contactDirty=false;
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const hotelFields=[['id','Hotel ID (unique, lowercase, no spaces)'],['name','Hotel name'],['area','Location','select','Island|Mainland'],['district','Town / district'],['style','Venue style'],['capacity','Maximum guests (leave blank if unknown)','number'],['address','Full address','textarea'],['mapUrl','Google Maps link (https, optional)','url'],['phone','Hotel phone'],['email','Hotel email','email'],['source','Official venue source','url'],['checkedAt','Venue facts checked on','date'],['weddingVerified','Venue facts verified against source','checkbox'],['fact','Verified facts / enquiry notes','textarea'],['photo','Image URL (https) or /images/hotels/filename.jpg'],['photoAlt','Image description'],['photoPage','Image source page','url'],['photoCredit','Image credit'],['photoUrl','Original image URL (optional)','url']];
const packageFields=[['id','Package ID (unique within hotel)'],['name','Package name'],['amount','Published table price (RM)','number'],['seats','Seats per table','number'],['seatsConfirmed','Seats confirmed by source','checkbox'],['chargeLabel','Price notation','select','nett|+|++'],['servicePercent','Additional service charge (%)','number'],['taxPercent','Additional tax (%)','number'],['chargesComplete','All compulsory charges accounted for','checkbox'],['source','Published package source (https required)','url'],['checkedAt','Price last checked on','date'],['validUntil','Valid until (blank if not stated)','date'],['validity','Validity explanation','textarea'],['conditions','Minimum tables, extras and conditions','textarea'],['menuSummary','Menu summary','textarea'],['chinese','Chinese banquet package','checkbox']];
const contactFields=[['heading','Contact section heading'],['message','Message','textarea'],['email','Wheredding email','email'],['phone','Wheredding phone']];
function status(text,error=false){$('#status').textContent=text;$('#status').className=error?'error':'';}
async function api(url,options={}){const r=await fetch(url,{...options,headers:{'Content-Type':'application/json','X-CSRF-TOKEN':token,...options.headers}});if([404,405].includes(r.status)&&url.startsWith('/api/admin/'))throw Error('This save feature is not available in the running server. Keep a copy of your draft, restart Wheredding with dotnet run, then refresh and sign in again.');const d=await r.json().catch(()=>({error:'The server could not complete this request.'}));if(!r.ok){if(r.status===401 && doc){$('#workspace').hidden=true;$('#login-panel').hidden=false;}throw Error(d.error||'Please sign in again.');}return d;}
function fieldHtml([key,label,type='text',choices],value,prefix){const id=prefix+'-'+key;return '<label class="'+(type==='textarea'?'wide':'')+'" for="'+id+'">'+(type==='checkbox'?'':'<span>'+esc(label)+'</span>')+(type==='textarea'?'<textarea id="'+id+'" data-key="'+key+'" maxlength="5000">'+esc(value)+'</textarea>':type==='select'?'<select id="'+id+'" data-key="'+key+'">'+choices.split('|').map(x=>'<option '+(value===x?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select>':'<input id="'+id+'" data-key="'+key+'" type="'+type+'" '+(type==='checkbox'?(value?'checked':''):'value="'+esc(value)+'"')+(type==='number'?' step="0.01" min="0"':'')+(type==='text'?' maxlength="2000"':'')+'>')+(type==='checkbox'?esc(label):'')+'</label>';}
function fillFields(container,fields,obj,prefix){container.innerHTML=fields.map(f=>fieldHtml(f,obj[f[0]],prefix)).join('');container.querySelectorAll('[data-key]').forEach(input=>{input.oninput=()=>{const key=input.dataset.key;obj[key]=input.type==='checkbox'?input.checked:input.type==='number'?(input.value===''?null:Number(input.value)):input.value;if(key==='validUntil' && !input.value)obj[key]=null;changed(prefix==='contact'?'contact':'hotels');if(prefix==='hotel' && ['name','district','area'].includes(key))renderList();if(prefix==='hotel' || prefix.startsWith('pkg'))preview();};});}
function updateRevision(){dirty=hotelsDirty||contactDirty;$('#revision').textContent='Revision '+doc.revision+(dirty?' · Unsaved: '+[hotelsDirty?'hotels & packages':'',contactDirty?'Contact Us':''].filter(Boolean).join(', '):' · All changes saved');}
function contactStatus(message,error=false){$('#contact-save-status').textContent=message;$('#contact-save-status').className=error?'error':'';}
function changed(section='hotels'){if(section==='contact'){contactDirty=true;contactStatus('Unsaved contact changes. Click Save Contact Us to publish.');}else hotelsDirty=true;updateRevision();}
function setBusy(value){busy=value;$('#publish').disabled=value;$('#save-contact').disabled=value;}
function renderList(){
 const q=$('#hotel-search').value.trim().toLowerCase(),rows=doc.venues.map((v,i)=>({v,i})).filter(({v})=>(v.name+' '+v.district).toLowerCase().includes(q));
 $('#hotel-count').textContent=rows.length+' of '+doc.venues.length+' hotels · '+doc.venues.filter(v=>v.archived).length+' archived';
 $('#hotel-list').innerHTML=rows.length?rows.map(({v,i})=>'<tr class="'+(v===current?'is-selected ':'')+(v.archived?'is-archived':'')+'"><th scope="row">'+esc(v.name)+'</th><td>'+esc(v.area==='Island'?'Penang Island':'Mainland')+'</td><td>'+esc(v.district)+'</td><td>'+v.packages.length+'</td><td><span class="hotel-status '+(v.archived?'archived':'active')+'">'+(v.archived?'Archived':'Active')+'</span></td><td class="hotel-row-actions"><div><button type="button" data-edit="'+i+'" aria-label="Edit '+esc(v.name)+'">Edit</button><button type="button" class="'+(v.archived?'restore-action':'archive-action')+'" data-archive="'+i+'" aria-label="'+(v.archived?'Restore ':'Archive ')+esc(v.name)+'">'+(v.archived?'Restore':'Archive')+'</button></div></td></tr>').join(''):'<tr><td colspan="6" class="hotel-empty">No hotels match your search. Try another name or town.</td></tr>';
 $('#hotel-list').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editHotel(Number(b.dataset.edit)));
 $('#hotel-list').querySelectorAll('[data-archive]').forEach(b=>b.onclick=()=>{const v=doc.venues[Number(b.dataset.archive)];v.archived=!v.archived;changed();renderList();if(v===current)preview();status(v.name+(v.archived?' archived in your draft.':' restored in your draft.')+' Click Save & publish changes to update the public guide.');});
}
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
function editHotel(i){current=doc.venues[i];$('#hotel-editor').hidden=false;$('#hotel-title').textContent=current.name;$('#hotel-actions').hidden=false;fillFields($('#hotel-fields'),hotelFields,current,'hotel');renderPackages();renderList();selectEditorTab('general');preview();$('#hotel-title').focus();}
function renderPackages(){$('#package-list').innerHTML=current.packages.map((p,i)=>'<details class="package-editor" open><summary>'+esc(p.name)+'</summary><div class="admin-fields" id="pkg-'+i+'"></div><button type="button" data-remove="'+i+'">Delete this package</button></details>').join('');current.packages.forEach((p,i)=>fillFields($('#pkg-'+i),packageFields,p,'pkg'+i));$('#package-list').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{if(confirm('Remove this package from the draft? It is removed publicly only when you save.')){current.packages.splice(Number(b.dataset.remove),1);changed();renderPackages();preview();}});}
function preview(){if(!current)return;$('#preview').innerHTML='<p><strong>Unsaved draft · '+(current.archived?'Archived':'Visible in guide')+'</strong></p>'+((current.photo.startsWith('/images/hotels/')&&!current.photo.includes('..'))||/^https:\/\//.test(current.photo)?'<img src="'+esc(current.photo)+'" alt="'+esc(current.photoAlt)+'">':'')+'<h3>'+esc(current.name)+'</h3><p>'+esc(current.address)+'</p><p>'+esc(current.phone)+' · '+esc(current.email)+'</p>'+current.packages.map(p=>'<p><strong>'+esc(p.name)+': RM '+esc(p.amount)+' '+esc(p.chargeLabel)+'</strong> / '+esc(p.seats)+' guests'+(!p.seatsConfirmed?' (assumed)':'')+'<br>'+esc(p.menuSummary)+'<br>'+(p.validUntil&&p.validUntil<today()?'Historical · expired '+esc(p.validUntil):p.validUntil?'Valid until '+esc(p.validUntil):'Validity unconfirmed')+(!p.chargesComplete?' · extra charges unconfirmed':'')+'</p>').join('');}
async function load(){doc=await api('/api/admin/content');current=null;dirty=hotelsDirty=contactDirty=false;$('#workspace').hidden=false;$('#login-panel').hidden=true;$('#logout').hidden=false;updateRevision();contactStatus('No unsaved contact changes.');$('#hotel-fields').innerHTML='';$('#hotel-actions').hidden=true;$('#hotel-editor').hidden=true;$('#hotel-title').textContent='Select a hotel';renderList();fillFields($('#contact-form'),contactFields,doc.contact,'contact');status('Saved content loaded. Use Edit in the hotel table or add a hotel.');}
async function session(expectAuthenticated=false){const s=await api('/api/admin/session');token=s.csrfToken;$('#storage').textContent='Storage: '+s.storage;if(!s.enabled){status('Admin editing is not configured. Set persistent storage and administrator credentials on the server. Public browsing still works.',true);return;}if(s.authenticated){status('Signed in. Loading your hotels…');await load();}else{if(expectAuthenticated)throw Error('The sign-in cookie was not accepted. Use the same website address throughout sign-in and restart the app if credentials were changed.');$('#login-panel').hidden=false;status('Sign in to manage Wheredding.');}}
$('#login').onsubmit=async e=>{e.preventDefault();const button=e.submitter||$('#login button');if(button)button.disabled=true;status('Signing in…');try{const f=new FormData(e.target);await api('/api/admin/login',{method:'POST',body:JSON.stringify(Object.fromEntries(f))});e.target.reset();await session(true);}catch(e){status(e.message,true);}finally{if(button)button.disabled=false;}};
$('#logout').onclick=async()=>{if(dirty&&!confirm('Sign out and discard unsaved edits?'))return;try{await api('/api/admin/logout',{method:'POST',body:'{}'});dirty=false;location.reload();}catch(e){status(e.message,true);}};
$('#hotel-search').oninput=renderList;
$('#new-hotel').onclick=()=>{const v={id:'hotel-'+Date.now(),name:'New hotel',area:'Island',district:'',style:'',address:'',phone:'',email:'',source:'',fact:'',weddingVerified:false,capacity:null,checkedAt:today(),photo:'/images/hotels/eo.jpg',photoPage:'',photoUrl:'',photoCredit:'Add image credit',photoAlt:'Replace with this hotel’s image',mapUrl:'',packages:[]};v.photo='';doc.venues.push(v);changed();editHotel(doc.venues.length-1);};
$('#close-editor').onclick=()=>{current=null;$('#hotel-editor').hidden=true;renderList();$('#hotel-search').focus();status(dirty?'Editor closed. Your draft changes are kept; save to publish them.':'Choose Edit beside a hotel to manage its details.');};
$('#new-package').onclick=()=>{current.packages.push({id:'package-'+Date.now(),name:'New package',amount:0,seats:10,seatsConfirmed:false,chargeLabel:'+',servicePercent:0,taxPercent:0,chargesComplete:false,source:'',checkedAt:today(),validUntil:null,validity:'Validity not stated; confirm with hotel.',conditions:'',menuSummary:'',chinese:true,hotelName:current.name});changed();renderPackages();preview();};
$('#hotel-form').onsubmit=e=>e.preventDefault();$('#contact-form').onsubmit=e=>e.preventDefault();
$('#publish').onclick=async()=>{
 if(busy)return;if(!hotelsDirty){status('No unsaved hotel or package changes. Use Save Contact Us for contact details.');return;}
 if(!$('#hotel-form').checkValidity()){
  $('#hotel-editor').hidden=false;
  const invalid=$('#hotel-form').querySelector('input:invalid,select:invalid,textarea:invalid');
  const panel=invalid?.closest('[role="tabpanel"]');
  if(panel)selectEditorTab(panel.dataset.editorPanel);
  const details=invalid?.closest('details');if(details)details.open=true;
  $('#hotel-form').reportValidity();return;
 }
 const snapshot=JSON.stringify(doc.venues);setBusy(true);
 try{const r=await api('/api/admin/hotels',{method:'PUT',body:JSON.stringify({venues:JSON.parse(snapshot),expectedRevision:doc.revision})});doc.revision=r.revision;hotelsDirty=JSON.stringify(doc.venues)!==snapshot;updateRevision();status('Hotels and packages published.'+(hotelsDirty?' New hotel edits are still unsaved.':'')+(contactDirty?' Contact Us changes are still unsaved; use Save Contact Us.':''));}
 catch(e){status(e.message,true);}finally{setBusy(false);}
};
$('#save-contact').onclick=async()=>{
 if(busy)return;if(!contactDirty){contactStatus('No unsaved contact changes.');return;}if(!$('#contact-form').reportValidity())return;
 const snapshot=JSON.stringify(doc.contact);setBusy(true);contactStatus('Saving Contact Us…');
 try{const r=await api('/api/admin/contact',{method:'PUT',body:JSON.stringify({contact:JSON.parse(snapshot),expectedRevision:doc.revision})});doc.revision=r.revision;contactDirty=JSON.stringify(doc.contact)!==snapshot;updateRevision();contactStatus(contactDirty?'Contact Us published. New contact edits are still unsaved.':'Contact Us saved and published successfully.'+(hotelsDirty?' Hotel and package edits remain unsaved.':''));}
 catch(e){contactStatus(e.message,true);}finally{setBusy(false);}
};
const reloadButton=$('#reload');
if(reloadButton)reloadButton.onclick=async()=>{if(dirty&&!confirm('Discard unsaved edits and reload the saved content?'))return;try{await load();}catch(e){status(e.message,true);}};
$('#history-refresh').onclick=async()=>{try{const rows=await api('/api/admin/history');$('#history').innerHTML=rows.length?rows.map(r=>'<div class="history-row"><span>Revision '+r.revision+' · '+esc(new Date(r.savedAt).toLocaleString())+' · '+esc(r.actor)+'</span><button data-restore="'+r.revision+'">Restore</button></div>').join(''):'No earlier revisions yet.';$('#history').querySelectorAll('button').forEach(b=>b.onclick=async()=>{if(!confirm('Restore all hotels, packages and contact information from revision '+b.dataset.restore+'? Unsaved edits will be discarded.'))return;try{await api('/api/admin/restore/'+b.dataset.restore,{method:'POST',body:JSON.stringify({expectedRevision:doc.revision})});await load();status('Previous revision restored and published.');}catch(e){status(e.message,true);}});}catch(e){status(e.message,true);}};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
session().catch(e=>status(e.message,true));
