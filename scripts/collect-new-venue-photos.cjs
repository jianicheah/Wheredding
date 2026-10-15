const fs=require('node:fs');
const sources=JSON.parse(fs.readFileSync('output/venue-research/photo-source-review.json','utf8'));
const overrides={maplepalace:'https://www.maplepalace.com/',kelawai:'https://ghotel.com.my/hotels/g-hotel-kelawai/',seventerraces:'https://www.georgetownheritage.com/seven-terraces-hotel/',elitehouse:'https://www.facebook.com/EliteHouseRestaurant/',fuhouse:'https://www.facebook.com/FuHouseRestaurant/'};
const decode=s=>s.replace(/&amp;/g,'&').replace(/&#039;|&#x27;/g,"'").replace(/&quot;/g,'"');
async function collect(row){
 const url=overrides[row.id]||row.url;
 try{
  const file=`output/venue-research/photos-${row.id}.html`;
  let h;
  if(process.argv.includes('--offline'))h=fs.readFileSync(file,'utf8');
  else {const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('HTTP '+r.status);h=await r.text();fs.writeFileSync(file,h);}
  let images=[];
  for(const tag of h.match(/<meta\b[^>]*>/gi)||[])if(/og:image|twitter:image/i.test(tag)){const m=tag.match(/content=["']([^"']+)/i);if(m)images.push({url:decode(m[1]),alt:'Page preview'});}
  for(const tag of h.match(/<(?:img|source)\b[^>]*>/gi)||[]){const m=tag.match(/(?:data-src|src)=["']([^"']+)/i);const alt=tag.match(/alt=["']([^"']*)/i)?.[1]||'';if(m)images.push({url:decode(m[1]),alt});}
  for(const m of h.matchAll(/(?:url\(["']?|["'])(https?:[^\s"'<>\\)]+\.(?:jpe?g|webp|png)(?:\?[^\s"'<>\\)]*)?)/gi))images.push({url:decode(m[1]),alt:'Embedded image'});
  images=images.filter(i=>!/^data:|logo|icon|pixel|flag|avatar|facebook.*branding/i.test(i.url)).map(i=>({...i,url:new URL(i.url,url).href}));
  images=[...new Map(images.map(i=>[i.url,i])).values()];return{id:row.id,source:url,images};
 }catch(e){return{id:row.id,source:url,error:e.message,images:[]};}
}
(async()=>{const rows=[];for(let i=0;i<sources.length;i+=4)rows.push(...await Promise.all(sources.slice(i,i+4).map(collect)));fs.writeFileSync('output/venue-research/new-photo-candidates.json',JSON.stringify(rows,null,2));for(const row of rows)console.log(row.id,row.error||'',JSON.stringify(row.images.slice(0,5)));})();
