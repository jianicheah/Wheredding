// Read saved public pages; never fetch or publish, and preserve existing packages.
const fs = require('node:fs');
const root = 'output/venue-research/';
const decode = s => s.replace(/&amp;/g,'&').replace(/&#x27;|&#39;/g,"'").replace(/&quot;/g,'"').replace(/&nbsp;/g,' ');
const entries = [
 ['parkroyal','parkroyal-penang-resort'],['angsana','angsana-teluk-bahang'],['rasa','rasa-sayang-penang'],
 ['eo','eo-hotel-penang'],['iconic','iconic-hotel-penang'],['marriott','penang-marriott-hotel-mul27zxd'],
 ['ixora','ixora-hotel-penang'],['hardrock','hard-rock-penang'],['gurney','g-hotel-gurney'],['olive','olive-tree-penang'],
 ['doubletree','doubletree-penang','DoubleTree Resort by Hilton Penang','Batu Ferringhi','Resort & ballroom','Esplanade Ballroom receptions; directory states a minimum of 15 tables of 10.'],
 ['lonepine','lone-pine-penang-a-tribute-portfolio-resort-msy4rrrm','Lone Pine, Penang, a Tribute Portfolio Resort','Batu Ferringhi','Beach resort & garden','Directory lists an intimate resort ceremony package; the lump sum is not a banquet table price.'],
 ['prestige','prestige-hotel-penang','The Prestige Hotel Penang','George Town','Design hotel & intimate ballroom','Directory lists a 50-72 guest ballroom, poolside solemnisation and a buffet option. Listed totals and FAQ base prices differ; confirm charges.'],
 ['granite','granite-hotel-penang','The Granite Luxury Hotel Penang','George Town','Hotel & rooftop events','The Skye event space is listed for 50-180 guests. Essential and Ultimate are event packages, not table prices.'],
 ['kelawai','g-hotel-kelawai','G Hotel Kelawai','George Town','Hotel ballroom & rooftop','Directory lists Chinese banquet options and a separate rooftop ceremony.'],
 ['seventerraces','seven-terraces','Seven Terraces','George Town','Heritage hotel & Peranakan dining','Kebaya restaurant buyouts are listed for 50-100 guests; full hotel buyouts and Library tea ceremonies are separate. FAQ states RM400++ per adult minimum spend.'],
 ['fourhands','four-hands-penang','Four Hands','George Town','Restaurant & glasshouse','Glasshouse ceremonies and Chinese banquet dining are listed separately. The 20-person figure refers to the glasshouse, not a confirmed whole-restaurant maximum.'],
 ['jazz','jazz-hotel-penang','Jazz Hotel Penang','Tanjung Tokong','Hotel & event space','Directory lists wedding events for up to 130 guests; package prices are on request.'],
 ['eastin','eastin-penang','Eastin Hotel Penang','Bayan Lepas','Hotel ballroom','Directory lists receptions for 200-550 guests; package prices are on request.'],
 ['mercure','mercure-penang','Hotel Mercure Penang Beach','Tanjung Bungah','Beach hotel & ballroom','Directory lists Chinese banquet tiers, Malay and Indian dining, and a separate solemnisation package.'],
 ['suffolk','suffolk-house','Suffolk House','George Town','Heritage mansion, garden & restaurant','Directory separates the 90-seat ballroom, 70-seat Marble Hall and 300-seat West Lawn. Rental, food and exclusive use have separate costs.'],
 ['bluemansion','blue-mansion','Cheong Fatt Tze - The Blue Mansion','George Town','Heritage hotel & courtyard','Directory lists 45-100 guest celebrations, mansion buyouts and separately priced dining. Confirm which spaces and nights are included.']
];
const venues = JSON.parse(fs.readFileSync('Data/venues.json','utf8'));
const refs = [];
for (const [id,slug,name,district,style,note] of entries) {
 const text = decode(fs.readFileSync(root+'venue-'+slug+'.html.txt','utf8'));
 const source = 'https://theweddingnotebook.com/catalog/venues/'+slug;
 const lines = text.split('\n').map(s=>s.trim()).filter(Boolean);
 const start = lines.indexOf('Packages & Pricing');
 const end = lines.findIndex((s,i)=>i>start && /^(What this venue offers|Frequently Asked Questions)$/.test(s));
 const prices = lines.slice(start+1,end<0?start+2:end).filter(s=>s.includes('RM')&&s.includes('Details')).map(s=>s.replace(/Details\s*›/,'').trim());
 const ref = prices.length ? prices.join('; ') : 'Package prices on request.';
 let v = venues.find(v=>v.id===id);
 if (!v) {
  const heading=lines.findIndex(s=>s===name);
  // The second occurrence is the main listing title, after gallery controls.
  const title=lines.findIndex((s,i)=>i>heading && s===name);
  const address=lines[(title>=0?title:heading)+2]?.replace(/\s+(?:\d+\s*[–-]\s*\d+|Up to \d+) guests.*$/,'')||district+', Penang; confirm exact address';
  v={id,name,area:'Island',district,style,address,phone:'',email:'',source,weddingVerified:false,capacity:null,checkedAt:'2026-10-15',photo:'/images/hotels/venue-placeholder.svg',photoPage:source,photoCredit:'Venue information source · photo pending',photoAlt:name+' — venue photograph not yet added',fact:note,packages:[]};
  venues.push(v);
 }
 const base=v.fact.split('\nThe Wedding Notebook directory reference')[0];
 const noteText='\nThe Wedding Notebook directory reference (checked 15 October 2026): '+ref+' These are third-party references; confirm price basis, charges, minimums and dates with the venue. Ceremony, rental and buyout totals are separate from banquet meal costs. Directory references are not used in the calculator.';
 // A very long listing gets its full package list in the review export.
 v.fact=base+ (base.length+noteText.length<=2000?noteText:'\nThe Wedding Notebook directory reference checked 15 October 2026 lists additional packages. See Additional source for prices, inclusions and terms; these references are not used in the calculator.');
 v.weddingSource=source;
 refs.push({id,name:v.name,source,checkedAt:'2026-10-15',packageReferences:prices,notes:note||'',calculatorImported:false});
}
const intimate='https://theweddingnotebook.com/inspire/ideas-and-advice/stunning-and-intimate-wedding-venues-in-penang';
const restaurants='https://theweddingnotebook.com/inspire/ideas-and-advice/chinese-wedding-banquet-restaurants-in-penang';
const extra=[
 ['macalister','Macalister Mansion','George Town','Heritage boutique hotel','Island','Colonial boutique hotel with eight rooms; the guide describes ceremony, meal and cocktail events.',intimate],
 ['soori','Soori Penang','George Town','Heritage hotel & courtyard','Island','Restored shophouse hotel beside Khoo Kongsi; courtyard ceremonies and private suite receptions are described.',intimate],
 ['stjos',"St Jo’s at Gurney Paragon",'George Town','Heritage chapel & event space','Island','Heritage chapel at Gurney Paragon; check permitted ceremonies, catering and current event arrangements.',intimate],
 ['peninsula','Peninsula House','George Town','Heritage restaurant reception','Island','Restaurant reception venue on the first floor of India House, Beach Street.',intimate],
 ['seaqueen','Sea Queen Restaurant','Tanjung Tokong','Chinese seafood banquet restaurant','Island','Straits Quay restaurant; guide reports up to 1,000 across indoor and outdoor spaces, subject to layout.',restaurants],
 ['maplepalace','Maple Palace','George Town','Cantonese banquet restaurant','Island','Jalan Sultan Ahmad Shah; guide reports 250 seats, private rooms and a wedding menu.',restaurants],
 ['starview','Starview Restaurant (仙景樓)','George Town','Chinese banquet restaurant','Island','Jalan Dato Keramat; guide references 2026 wedding packages. Request current prices and capacity.',restaurants],
 ['elitehouse','Elite House Restaurant (貴賓樓大酒家)','Jelutong','Chinese banquet restaurant','Island','Fortune Park, Jalan Perusahaan Jelutong 2; guide references wedding packages and private dining.',restaurants],
 ['zhonghua','Zhonghua Gourmet','George Town','Hotel-based Cantonese restaurant','Island','Cititel Penang, Penang Road; guide describes a wedding menu and partitionable private rooms.',restaurants],
 ['wworld','W World','George Town','Chinese restaurant & banquet halls','Island','Drury Lane; guide describes separate 500- and 100-person halls, VIP rooms and audiovisual facilities.',restaurants],
 ['xipalace','Xi Palace Restaurant (金喜大酒家)','Bukit Mertajam','Cantonese banquet restaurant','Mainland','Alma; formerly Kim Hee. Guide identifies wedding banquet dining; confirm capacity and package terms.',restaurants],
 ['fuhouse','FuHouse Restaurant (福臨門大酒樓)','Bukit Mertajam','Chinese banquet restaurant','Mainland','Setia Sentral; guide identifies wedding banquets. Confirm room capacity, current menu and package terms.',restaurants]
];
for(const [id,name,district,style,area,note,source] of extra){
 if(venues.some(v=>v.id===id))continue;
 venues.push({id,name,area,district,style,address:district+', Penang; see the source and confirm the exact event entrance',phone:'',email:'',source,weddingVerified:false,capacity:null,checkedAt:'2026-10-15',photo:'/images/hotels/venue-placeholder.svg',photoPage:source,photoCredit:'Venue information source · photo pending',photoAlt:name+' — venue photograph not yet added',fact:'The Wedding Notebook guide, updated 24 September 2026, lists this venue. '+note+' Current capacity, pricing and availability have not been independently confirmed. No banquet price is imported into the calculator.',packages:[]});
 refs.push({id,name,source,checkedAt:'2026-10-15',packageReferences:[],notes:note,calculatorImported:false});
}
fs.writeFileSync('Data/venues.json',JSON.stringify(venues,null,2)+'\n');
fs.writeFileSync(root+'penang-directory-references.json',JSON.stringify(refs,null,2)+'\n');
fs.writeFileSync(root+'penang-venues-expanded.json',JSON.stringify(venues,null,2)+'\n');
const fields=['id','name','area','district','style','address','fact','source','weddingSource'];
const quote=s=>'"'+String(s??'').replace(/"/g,'""')+'"';
fs.writeFileSync(root+'penang-venues-expanded.csv','\ufeff'+[fields,...venues.map(v=>fields.map(k=>v[k]))].map(row=>row.map(quote).join(',')).join('\r\n'));
console.log(`${venues.length} venues; ${entries.length} directory entries reviewed; ${refs.reduce((n,r)=>n+r.packageReferences.length,0)} package/menu references exported.`);
let app = fs.readFileSync('wwwroot/app.js','utf8');
const replacements = [
 ["badge(v) + '<p>' + esc(v.fact).replace(/\\n/g, '</p><p>') + '</p><p>'", "badge(v) + venueNotes(v) + '<p>'"],
 ["link(v.source, 'Official venue source')", "link(v.source, 'Venue source')"],
 ["'<p>' + esc(v.fact) + '</p><p>'", "'<p>' + esc(v.fact).replace(/\\n/g, '</p><p>') + '</p><p>'"],
 [' hotels · ', ' venues · '], [" hotels'", " venues'"],
 ['three hotels', 'three venues'], ['three hotel cards', 'three venue cards'],
 ['Choose the wedding hotel…', 'Choose the wedding venue…'],
 ['Hotel price not verified', 'Banquet price not verified'],
 ['No hotel-specific price verified.', 'No independently verified banquet price recorded.'],
 ['Use this hotel in calculator', 'Use this venue in calculator'],
 ['Contact hotel', 'Venue website'], ['Prices, menu & sources', 'Details, packages & sources']
 ,['No hotels match.', 'No venues match.'], ['Enquire with hotel', 'Confirm with venue'],
 ['No hotel-specific price verified', 'No independently verified banquet price recorded'],
 ['Official venue information', 'Venue information source'],
 ['Confirm date availability with the hotel.', 'Confirm date availability with the venue.'],
 ['We could not verify this hotel’s price.', 'We could not independently verify this venue’s price.'],
 ['not a rate for your selected hotel', 'not a rate for your selected venue'],
 ['No sourced Chinese menu recorded. Ask the hotel for its dated menu and dietary options.', 'No independently verified menu saved. See the venue notes and source for package references and full menus.']
];
for (const [from,to] of replacements) app=app.split(from).join(to);
fs.writeFileSync('wwwroot/app.js',app);
let html=fs.readFileSync('wwwroot/index.html','utf8').replace(/\bhotels\b/g,'venues').replace(/\bhotel\b/g,'venue').replace(/\bHotel\b/g,'Venue');
fs.writeFileSync('wwwroot/index.html',html);
