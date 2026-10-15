import json
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
jobs=json.loads(Path('output/venue-research/photo-downloads.json').read_text())
for batch in range((len(jobs)+23)//24):
 part=jobs[batch*24:(batch+1)*24]
 out=Image.new('RGB',(1200,((len(part)+3)//4)*205),'white'); draw=ImageDraw.Draw(out)
 for i,j in enumerate(part):
  x=(i%4)*300;y=(i//4)*205
  try:
   with Image.open(j['file']) as im:
    size=im.size;out.paste(ImageOps.contain(im.convert('RGB'),(290,170)),(x,y))
   draw.text((x+3,y+173),f"{j['id']} {j['index']} {size}",fill='black')
  except Exception:
   draw.text((x+3,y+50),f"{j['id']} {j['index']} unavailable",fill='red')
 out.save(f'output/venue-research/contact-sheet-{batch}.jpg')
