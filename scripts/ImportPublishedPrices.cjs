// Curated transcription of official hotel pages/brochures checked 12 October 2026.
// This migration replaces invented ranges. It does not scrape or imply live prices.
const fs=require('node:fs');
const venues=JSON.parse(fs.readFileSync('Data/venues.json','utf8'));
const checkedAt='2026-10-12';
function p(id,name,amount,source,options={}) {
 return {id,name,amount,seats:10,seatsConfirmed:true,chargeLabel:'nett',servicePercent:0,taxPercent:0,chargesComplete:true,
  source,checkedAt,validUntil:null,validity:'No validity date published; confirm that this price still applies.',
  conditions:'Subject to availability and a written hotel quotation.',menuSummary:'Ask the hotel for the dated menu and dietary options.',chinese:true,...options};
}
const amari='https://www.amari.com/penang/wedding-packages/';
const parkroyal='https://www.panpacific.com/content/dam/pphg-revamp/en/prpen/pr2-0/celebrate/prpen-wedding-package.pdf';
const olive='https://www.olivetree.my/wp-content/uploads/sites/21/2026/08/Two-of-Us-wedding-package.pdf';
const iconic='https://iconichotel.com.my/cn/wp-content/uploads/2024/12/wedding-package.pdf';
const ixora='https://www.ixorahotel.com/wp-content/uploads/2025/05/chi_wedding_tgb_apr2025.pdf';
const published={
 amari:[['blissful','Blissful Love',2188,'blissful-love'],['hearts','Enchanting Hearts',2488,'enchanting-hearts'],['majestic','Majestic Elegance',2888,'majestic-elegance']].map(([id,name,n,path])=>p(id,name,n,amari+path+'-wedding-package',{
  validUntil:'2026-12-31',validity:'Booking period ends 31 December 2026; confirm your wedding date is covered.',conditions:'Published terms state 100–130 guests. Prices may change.',menuSummary:'Chinese dinner with eight courses; drinks included. Request the chosen dishes.'})),
 parkroyal:[['eternity','Eternity Love',2188],['ultimate','Ultimate Love',2388],['everlasting','Everlasting Love',2888]].map(([id,name,n])=>p(id,name,n,parkroyal,{
  validUntil:'2026-12-31',validity:'Package valid until 31 December 2026.',conditions:'20–30 tables (200–300 guests). Ceremony and other extras are separate.',menuSummary:id==='everlasting'?'Chinese dinner with eight courses, including lobster; drinks included.':'Chinese dinner with eight courses and drinks. Ask for the dish selection.'})),
 olive:[['olive','Wedding at The Olive',1299,'8–15 tables.'],['beginning','Beautiful Beginning',1399,'35–60 tables; MYR200+ per table surcharge below 35.'],['divine','Just Divine',1499,'30–60 tables; MYR200+ per table surcharge below 30.'],['forever','Always and Forever',1799,'30–60 tables.']].map(([id,name,n,terms])=>p(id,name,n,olive,{
  chargeLabel:'+',chargesComplete:false,validity:'Brochure linked from the August 2026 showcase; no package expiry or charge percentage stated.',conditions:terms+' A 10% table surcharge applies on public-holiday eves and public holidays. Confirm what + includes.',menuSummary:'Chinese dinner with eight courses, cordial drinks and tea. Corkage benefits vary by tier.'})),
 iconic:[['splendid','Splendid',1299],['significant','Significant',1599]].map(([id,name,n])=>p(id,name,n,iconic,{
  chargeLabel:'+',chargesComplete:false,validity:'Undated brochure in the hotel’s December 2024 folder; current applicability unconfirmed.',conditions:'Minimum 20 tables; prevailing government tax is extra, percentage not stated.',menuSummary:'Chinese dinner with eight courses, soft drinks and tea. Tasting and wine benefits vary by tier.'})),
 ixora:[['destiny','Destiny — Grand Ballroom',1088],['forever','Forever — Grand Ballroom',1288],['eternity','Eternity — Grand Ballroom',1588]].map(([id,name,n])=>p(id,name,n,ixora,{
  chargeLabel:'+',taxPercent:8,validUntil:'2025-12-31',validity:'Expired: brochure valid only until 31 December 2025. Historical reference, not a current offer.',conditions:'Minimum 40 tables; festive surcharges apply. Monday–Thursday discount is not applied here.',menuSummary:'Eight-course Chinese menu with choices across starter, soup, poultry, prawns, vegetables, fish, rice/noodles and dessert. See the original brochure for dishes.'})),
 berjaya:[p('chinese','Chinese Wedding — advertised starting price',1288,'https://wifi.berjayahotel.com/wp-content/uploads/2024/10/BPH_Wedding_Package.pdf',{
  validity:'Undated flyer in the hotel’s October 2024 folder; current applicability unconfirmed.',conditions:'Advertised from-price; minimum tables and validity are not specified.',menuSummary:'Chinese wedding package advertised; individual dishes are not shown.'})],
 gurney:[p('happiness','Happiness Dome Set',2388,'https://ghotel.com.my/hotels/g-hotel-gurney/offers/wedding-dome-set/',{
  chinese:false,conditions:'Minimum 20 tables; public-holiday eve and holiday surcharge amount is not published.',menuSummary:'Dome set banquet with fruit punch. The flyer does not specify Chinese dishes; confirm cuisine with the hotel.'})],
 angsana:[p('endless','Endless Love Celebration',2288,'https://www.angsana.com/malaysia/penang/wedding-packages',{
  seatsConfirmed:false,conditions:'15–25 tables. The page does not specify seats per table; calculator assumes 10.',menuSummary:'Chinese dinner with eight courses and a choice of fruit punch or tea. Request the detailed menu.'})]
};
for(const v of venues){
 for(const key of ['low','high','guestEstimate','priceStatus','menu','courses'])delete v[key];
 v.packages=(published[v.id]||[]).map(p=>({...p,hotelName:v.name}));
}
fs.writeFileSync('Data/venues.json',JSON.stringify(venues,null,2)+'\n');
console.log(`Imported ${Object.values(published).flat().length} sourced packages for ${Object.keys(published).length} hotels; removed invented prices and dishes.`);
