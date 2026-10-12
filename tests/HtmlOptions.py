from html.parser import HTMLParser
from pathlib import Path
class Options(HTMLParser):
 def __init__(self):
  super().__init__(); self.select=None; self.option=False; self.options={}; self.errors=[]
 def handle_starttag(self,tag,attrs):
  attrs=dict(attrs)
  if tag=='select': self.select=attrs.get('id'); self.options[self.select]=[]
  if tag=='option':
   if self.option: self.errors.append('Nested option')
   self.option=True; self.options[self.select].append(attrs.get('value'))
 def handle_endtag(self,tag):
  if tag=='option':
   if not self.option: self.errors.append('Unmatched closing option')
   self.option=False
  if tag=='select':
   if self.option: self.errors.append('Unclosed option')
   self.select=None
 def handle_data(self,text):
  if self.select and not self.option and text.strip(): self.errors.append('Text outside option: '+text.strip())
p=Options();p.feed(Path('wwwroot/index.html').read_text(encoding='utf-8-sig'))
assert not p.errors,p.errors
assert p.options['area']==['','Island','Mainland','Butterworth'],p.options['area']
assert p.options['budget']==['0','1500','2000','2500'],p.options['budget']
assert p.options['sort']==['name','price']
print('PASS: All static dropdowns have valid option tags and expected choices')
