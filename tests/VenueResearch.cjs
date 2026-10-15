const fs=require('node:fs'),assert=require('node:assert/strict');
const venues=JSON.parse(fs.readFileSync('Data/venues.json','utf8'));
const refs=JSON.parse(fs.readFileSync('output/venue-research/penang-directory-references.json','utf8'));
assert.equal(new Set(venues.map(v=>v.id)).size,venues.length);
const directory=refs.filter(r=>r.source.includes('/catalog/venues/'));
assert.equal(directory.length,22);
for(const r of refs){
 const v=venues.find(v=>v.id===r.id);assert.ok(v,r.id);
 assert.ok(v.source.startsWith('https://'));assert.ok(fs.existsSync('wwwroot'+v.photo));
 assert.ok(v.fact.length<=2000);assert.equal(r.calculatorImported,false);
 if(v.photo.endsWith('venue-placeholder.svg'))assert.equal(v.weddingVerified,false);
}
for(const id of ['seaqueen','maplepalace','starview','elitehouse','zhonghua','wworld','xipalace','fuhouse'])assert.ok(venues.find(v=>v.id===id));
for(const id of ['doubletree','seventerraces','suffolk','bluemansion','granite'])assert.equal(venues.find(v=>v.id===id).packages.length,0);
assert.equal(venues.find(v=>v.id==='xipalace').area,'Mainland');
assert.equal(venues.find(v=>v.id==='fuhouse').area,'Mainland');
const oldIds=['eo','courtyard','olive','iconic','sunway','degarden','gurney','royale','ixora','light','aroma','pearlview','rasa','goldensands','hardrock','parkroyal','angsana','amari','berjaya','lexis','marriott','marjorie','ac','bayviewbeach','chariton'];
for(const id of oldIds)assert.ok(venues.find(v=>v.id===id),'Original venue retained: '+id);
assert.equal(venues.reduce((n,v)=>n+v.packages.length,0),18);
console.log('PASS: Every reviewed Penang directory and guide entry is present; original venues and calculator packages preserved.');
