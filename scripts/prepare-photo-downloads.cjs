const fs=require('node:fs');
const rows=JSON.parse(fs.readFileSync('output/venue-research/new-photo-candidates.json','utf8'));
const jobs=[];
for(const r of rows){
 let photos=r.images.filter(i=>(/\.(?:jpe?g|webp|png)(?:[/?]|$)/i.test(i.url)||i.url.includes('/is/image/'))&&! /logo|icon|\.svg|cashless|play-|\/100w|format=100w|banner-2026|sprite/i.test(i.url));
 if(r.id==='doubletree')photos.sort((a,b)=>(/Facade/i.test(b.url)?1:0)-(/Facade/i.test(a.url)?1:0));
 if(r.id==='zhonghua')photos=photos.filter(i=>/zhonghua/i.test(i.url));
 if(r.id==='soori')photos=photos.filter(i=>! /render|article|magazine|wallpaper|branding/i.test(i.url+' '+i.alt));
 if(r.id==='maplepalace')photos=photos.filter(i=>! /cny|menu|reopen|scaled/i.test(i.url));
 photos=[...new Map(photos.map(i=>[i.url.split('?')[0],i])).values()].slice(0,3);
 for(let n=0;n<photos.length;n++)jobs.push({id:r.id,index:n,source:r.source,url:photos[n].url,alt:photos[n].alt,file:`output/venue-research/photo-${r.id}-${n}.bin`});
}
fs.writeFileSync('output/venue-research/photo-downloads.json',JSON.stringify(jobs,null,2));
console.log(jobs.length+' image candidates for '+new Set(jobs.map(j=>j.id)).size+' venues.');
