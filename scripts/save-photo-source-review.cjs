const fs=require('node:fs');
const sourceRows=[
 ['doubletree','https://hiltoncontenthub.com/property/doubletree-resort-by-hilton-penang','Official media library','Travel-advisor marketing library; Wheredding usage permission not established.'],
 ['lonepine','https://www.marriott.com/en-us/hotels/penlp-lone-pine-penang-a-tribute-portfolio-resort/photos/','Official gallery','Garden and exterior photos available; republication permission not stated.'],
 ['prestige','https://www.theprestige.my/gallery/','Official gallery','Hotel gallery and media pages found; republication permission not stated.'],
 ['granite','https://www.thegranitehotel.com/','Official website','Official hotel imagery found; request approved rooftop/event-space image.'],
 ['kelawai','https://ghotel.com.my/','Official website and press kit','Additional press kit: https://www.v2com-newswire.com/en/newsroom/categories/commercial-architecture/press-kits/6111-01/g-hotel-kelawai . Downloads restricted to media; photographer credits required. Wheredding eligibility not established.'],
 ['seventerraces','https://www.georgetownheritage.com/our-hotels/','Official hotel-group site','Seven Terraces is identified on its hotel-group site; request approved courtyard/Kebaya image.'],
 ['fourhands','https://www.facebook.com/fourhandspenang/','Social-account lead','Account linked from business directory listings; ownership and image permission not independently verified. https://wanderlog.com/place/details/4207119/four-hands'],
 ['jazz','https://www.jazzhotel.com.my/gallery.html','Official gallery','Official photo gallery found; permission for Wheredding not stated.'],
 ['eastin','https://eastin.com/gallery/','Official gallery','Penang hotel verified by Queensbay address. Do not substitute the similarly named Thai hotel group.'],
 ['mercure','https://all.accor.com/hotel/B4R7/index.en.shtml','Official hotel listing','Hotel imagery supplied through Accor; permission for republication not established.'],
 ['suffolk','https://www.suffolkhouse.com.my/','Official website','Official venue imagery found. Separate reusable alternative: https://commons.wikimedia.org/wiki/File:Suffolk_House.JPG by Thesamacbook, CC BY-SA 3.0; link licence https://creativecommons.org/licenses/by-sa/3.0/ and disclose edits. Exterior photographed 2 September 2011; not current banquet setup or venue endorsement.'],
 ['bluemansion','https://www.cheongfatttzemansion.com/thebluemansion/discover/gallery/','Official gallery','Official venue gallery found; no republication permission confirmed.'],
 ['macalister','https://www.marriott.com/en-us/hotels/pengt-macalister-mansion-george-town-a-member-of-design-hotels/photos/','Official gallery','Correct George Town property, not the similarly named Pennsylvania mansion.'],
 ['soori','https://sooripenang.com/press','Official press page','Hotel press page found; featured magazine coverage is not itself an image licence. Contact info@sooripenang.com for approved assets.'],
 ['stjos','https://www.hunzagroup.com/property/st--jo---s---gurney-paragon-mall','Official property-owner page','Hunza confirms the correct St Jo’s building; request a property-owner-approved chapel/event photo.'],
 ['peninsula','https://www.peninsula.house/our-house','Official restaurant website','Correct first-floor India House restaurant. Contact hello@peninsula.house for approved interior imagery.'],
 ['seaqueen','https://www.straitsquay.com/shops/sea-queen-restaurant/','Official landlord listing','Official Straits Quay listing identifies SeaQueen and its @seaqueenpenang account; request approved hall image.'],
 ['maplepalace','https://www.maplepalace.com/wp-content/uploads/2022/10/Wed_Menu_1110.pdf','Official restaurant brochure','Restaurant domain verified through its wedding brochure. Gallery/homepage access was inconclusive; request approved room photo.'],
 ['starview','https://www.facebook.com/starviewrestaurant/','Social-account lead','Business listing links this account for 341 Jalan Dato Keramat. Verify this branch, not Starview Prai, before using images. https://www.waze.com/live-map/directions/my/pulau-pinang/george-town/starview-restaurant?to=place.ChIJKzTB3bjDSjARbM9xSlwnxdY'],
 ['elitehouse','https://www.bizmalay.com/en/elite-house-04-288-8888','Contact lead only','Official photo page not verified. Directory lists 04-288 8888 and Fortune Park; request approved venue photos directly.'],
 ['zhonghua','https://www.cititelpenang.com/dining/zhonghua-gourmet-restaurant','Official hotel restaurant page','Cititel’s own page identifies the restaurant and its images; permission for Wheredding not established.'],
 ['wworld','https://wworld.com.my/private-dining-wedding/','Official restaurant wedding page','Correct banquet-hall source; request approved interior image and its required credit.'],
 ['xipalace','https://www.facebook.com/kimheebm.restaurant/','Social-account lead','Business directory links this account for Xi Palace BM, formerly Kim Hee. Verify current ownership and permission. https://wanderlog.com/place/details/2816425/金喜大酒家-xi-palace-restaurant-bm-formerly-known-as-kim-hee-bm'],
 ['fuhouse','https://www.findglocal.com/MY/Bukit-Mertajam/104223605079648/FuHouse-Restaurant-福臨門大酒樓','Contact lead only','Mirror lists No 41 Lorong Setia Sentral 1 and 04-5057978. Official account and image permission need direct verification.']
];
const venues=JSON.parse(fs.readFileSync('Data/venues.json','utf8'));
const rows=sourceRows.map(([id,url,sourceType,notes])=>({id,name:venues.find(v=>v.id===id).name,url,sourceType,notes,checkedAt:'2026-10-15',approvedForWheredding:false}));
if(rows.length!==24 || new Set(rows.map(r=>r.id)).size!==24)throw Error('Source review incomplete');
const path='output/venue-research/photo-source-review';
fs.writeFileSync(path+'.json',JSON.stringify(rows,null,2)+'\n');
let md='# Photo source review — 15 October 2026\n\nResearch covers the 24 new venues. Finding an official image establishes its source, not a grant to republish it. No direct approval from a venue has been received. No emails or social messages were sent.\n\n19 official venue/operator/property-owner sources, 3 social-account leads and 2 contact-only leads were found. The Maple Palace source is its brochure, not a verified photo gallery.\n\nSuffolk House additionally has a clearly licensed alternative by Thesamacbook under CC BY-SA 3.0. This is a photographer-licensed exterior from 2011, not a venue-supplied or current event photo. Required attribution, licence link and edit disclosure are recorded below.\n\n';
for(const r of rows)md+='## '+r.name+'\n\n- Source: ['+r.sourceType+']('+r.url+')\n- Status: Wheredding republication approval not confirmed for official/social images.\n- '+r.notes+'\n\n';
md+='For a venue approval request: ask for one landscape image of the correct branch’s ballroom, dining room or exterior, and written permission to display it on Wheredding’s public venue guide, including any photographer credit and restrictions.\n';
fs.writeFileSync(path+'.md',md);
console.log('Saved source review for all 24 new venues.');
