from PIL import Image, ImageOps, ImageDraw
from pathlib import Path
files=list(Path('wwwroot/images/hotels').glob('*'))
out=Image.new('RGB',(1000,((len(files)+3)//4)*170),'white');d=ImageDraw.Draw(out)
for i,f in enumerate(files):
 try:
  im=Image.open(f); im=ImageOps.fit(im.convert('RGB'),(240,140));x=(i%4)*250;y=(i//4)*170;out.paste(im,(x,y));d.text((x+5,y+143),f.stem,fill='black')
 except Exception as e: print(f,e)
out.save('scripts/photo-review.jpg')
