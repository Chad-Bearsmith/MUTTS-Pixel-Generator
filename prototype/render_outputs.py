from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np,json
root=Path(__file__).resolve().parent
ref=root.parent/'references'
fixture=json.loads((root/'fixtures.json').read_text())
rows=[]
for case in fixture['cases']:
 atlas=np.fromfile(root/'examples'/f"{case['name'].replace(' ','-')}.rgba",dtype=np.uint8).reshape(64,64,4)
 current=np.array(Image.open(ref/'Current'/case['sourceFile']).convert('RGBA'))
 fixed=np.array(Image.open(ref/'Fix'/case['sourceFile']).convert('RGBA'))
 h,w= current.shape[:2];x,y=case['shift']
 native=atlas[y:y+h//20,x:x+w//20]
 rendered=Image.fromarray(native).resize((w,h),Image.Resampling.NEAREST)
 expected=np.asarray(Image.fromarray(fixed))
 assert np.array_equal(np.array(rendered),expected),case['name']
 filename=case['name'].replace(' ','-')+'-Native-Proof.png'
 rendered.save(root/'examples'/filename)
 print('PASS',case['name'],'exact enlarged PNG',w,h)
 # visual comparison row
 unit=Image.new('RGBA',(w*3,h+38),(22,22,22,255))
 for i,img in enumerate([Image.fromarray(current),rendered,Image.fromarray(fixed)]):
  unit.paste(img,(w*i,38),img)
 d=ImageDraw.Draw(unit)
 for i,title in enumerate(['Current', 'WASM corrective layer', 'Reference Fix']):
  d.text((i*w+5,8),title,fill=(255,255,255,255))
 rows.append(unit)
width=max(img.width for img in rows)
out=Image.new('RGBA',(width,sum(img.height for img in rows)),(22,22,22,255))
y=0
for img in rows:out.paste(img,(0,y),img);y+=img.height
out.convert('RGB').save(root/'examples/three-case-comparison.png')
