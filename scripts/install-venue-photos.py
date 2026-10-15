import json
from pathlib import Path
from PIL import Image,ImageOps
root=Path('output/venue-research')
jobs=json.loads((root/'photo-downloads.json').read_text())
venues=json.loads(Path('Data/venues.json').read_text(encoding='utf-8-sig'))
choices={'doubletree':1,'lonepine':0,'prestige':0,'granite':1,'kelawai':0,'seventerraces':0,'fourhands':0,'jazz':2,'eastin':0,'mercure':0,'suffolk':12,'bluemansion':19,'macalister':0,'soori':0,'stjos':0,'peninsula':10,'seaqueen':2,'maplepalace':11,'starview':0,'elitehouse':0,'zhonghua':0,'wworld':2,'xipalace':0,'fuhouse':0}
logos={'fourhands','starview','elitehouse','xipalace','fuhouse'}
descriptions={'doubletree':'resort exterior','lonepine':'pool and garden overlooking the sea','prestige':'hotel exterior','granite':'hotel exterior','kelawai':'hotel exterior at dusk','seventerraces':'heritage courtyard','jazz':'hotel entrance','eastin':'hotel exterior','mercure':'beachfront hotel exterior','suffolk':'garden ceremony setting','bluemansion':'heritage courtyard','macalister':'mansion exterior','soori':'heritage hotel exterior','stjos':'heritage building exterior','peninsula':'restaurant bar interior','seaqueen':'banquet room','maplepalace':'wedding dining room','zhonghua':'restaurant dining service','wworld':'wedding banquet hall'}
manifest=[]
for id,index in choices.items():
 job=next(j for j in jobs if j['id']==id and j['index']==index)
 with Image.open(job['file']) as src:
  im=ImageOps.exif_transpose(src).convert('RGBA')
  bg=Image.new('RGBA',im.size,'white');bg.alpha_composite(im);im=bg.convert('RGB')
  if id in logos:
   logo=ImageOps.contain(im,(660,340));im=Image.new('RGB',(800,450),'white');im.paste(logo,((800-logo.width)//2,(450-logo.height)//2))
  else: im.thumbnail((1400,1000))
  file=Path('wwwroot/images/hotels')/(id+'.jpg');im.save(file,'JPEG',quality=88,optimize=True)
  assert 12<file.stat().st_size<1048576
 venue=next(v for v in venues if v['id']==id)
 credit='Official business profile · brand logo' if id in logos else 'Official venue / operator website · resized'
 alt=venue['name']+' — '+('official brand logo (venue photograph unavailable)' if id in logos else descriptions[id])
 venue.update(photo='/images/hotels/'+id+'.jpg',photoPage=job['source'],photoUrl=job['url'],photoCredit=credit,photoAlt=alt)
 manifest.append({'id':id,'file':file.as_posix(),'source':job['source'],'url':job['url'],'credit':credit,'alt':alt,'kind':'logo' if id in logos else 'photo'})
Path('Data/venues.json').write_text(json.dumps(venues,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(root/'installed-photos.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Installed',len(manifest),'images:',len(manifest)-len(logos),'venue photographs and',len(logos),'official brand logos.')
