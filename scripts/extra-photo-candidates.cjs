const fs=require('node:fs');
const rows=JSON.parse(fs.readFileSync('output/venue-research/new-photo-candidates.json','utf8'));
let jobs=JSON.parse(fs.readFileSync('output/venue-research/photo-downloads.json','utf8'));
for(const [id,pattern] of [['suffolk',/10365952|384644_|20160925_172846/],['maplepalace',/Home-1-1|Home-2-2|Home-3\.jpg/],['bluemansion',/architecture-0[345]/]]){
 let n=10;for(const im of rows.find(r=>r.id===id).images.filter(i=>pattern.test(i.url)))jobs.push({id,index:n++,url:im.url,source:rows.find(r=>r.id===id).source,file:`output/venue-research/photo-${id}-${n-1}.bin`});
}
const h=fs.readFileSync('output/venue-research/photos-peninsula-home.html','utf8');
const url=[...h.matchAll(/https:\/\/images\.squarespace-cdn\.com[^\s"<>]+Peninsula_Space_55[^\s"<>]+\.jpeg/gi)][0]?.[0];
if(url)jobs.push({id:'peninsula',index:10,url,source:'https://www.peninsula.house/',file:'output/venue-research/photo-peninsula-10.bin'});
fs.writeFileSync('output/venue-research/photo-downloads.json',JSON.stringify(jobs,null,2));
