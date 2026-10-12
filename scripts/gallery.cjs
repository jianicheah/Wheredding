const fs=require('node:fs');
(async()=>{const h=await (await fetch('https://ghotel.com.my/hotels/g-hotel-gurney/gallery/')).text();console.log([...new Set([...h.matchAll(/["']([^"']+\.(?:jpg|png|webp))(?=["'])/gi)].map(m=>m[1]))].filter(x=>! /logo|icon|flag/i.test(x)).slice(0,35));fs.writeFileSync('scripts/gurney-gallery.html',h);})();
