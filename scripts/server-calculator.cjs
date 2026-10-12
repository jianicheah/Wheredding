const fs=require('fs');const path='wwwroot/app.js';let js=fs.readFileSync(path,'utf8');js=js.replace("const input=Object.fromEntries(fields.map(k=>[k,Number(form.elements[k].value)]));",`const input=Object.fromEntries(fields.map(k=>[k,Number(form.elements[k].value)]));
 input.venueId=venues.some(v=>v.id===$('#giftvenue').value)?$('#giftvenue').value:null;
 input.priceMode=giftBasis&&input.tablePrice===giftBasis.reference?'hotel':'manual';`);
js=js.replace("const usingEstimate=giftBasis&&input.tablePrice===giftBasis.reference&&input.seats===10;","const usingEstimate=d.priceMode==='hotel';");
js=js.replace("if(!r.ok)throw Error(d.error||'Unable to calculate');","if(!r.ok)throw Error(d.error||(r.status===429?'Too many calculations. Please try again in a minute.':'Unable to calculate'));");fs.writeFileSync(path,js);
let test=fs.readFileSync('tests/Frontend.cjs','utf8');test=test.replace("{tableTotal:Number(JSON.parse(options.body).tablePrice)","{priceMode:JSON.parse(options.body).priceMode,tableTotal:Number(JSON.parse(options.body).tablePrice)");fs.writeFileSync('tests/Frontend.cjs',test);
