from pathlib import Path
from PIL import Image
import numpy as np, json,base64
root=Path(__file__).resolve().parent.parent
ref=root/'references'
items=[('Cape;Cape.png','Cape',1,27,8),('Body;Fire Lizard.png','Fire Lizard',2,23,5),('Armor;Apache.png','Apache Armor',3,27,8)]
bolt=np.load(root/'unity-assets/Bolt-idle.npy')
all_cases=[]
for fname,label,item,shiftx,shifty in items:
 def atlas(f):
  im=np.asarray(Image.open(ref/fname.replace('/', 'XYZ') if False else f'{ref}/{f}/{fname}').convert('RGBA'))
  assert im.shape[0]%20==0 and im.shape[1]%20==0
  small=im[::20,::20]
  assert all(np.array_equal(im[y:y+20,x:x+20],np.tile(small[y//20,x//20],(20,20,1))) for y in range(0,im.shape[0],20) for x in range(0,im.shape[1],20)),fname
  r=np.zeros((64,64,4),dtype=np.uint8)
  r[shifty:shifty+small.shape[0],shiftx:shiftx+small.shape[1]]=small
  return r,small
 current,sc=atlas('Current');fixed,sf=atlas('Fix')
 diff=np.any(current!=fixed,axis=2)
 changed=[{'x':int(x),'y':int(y),'before':list(map(int,current[y,x])),'after':list(map(int,fixed[y,x]))} for y,x in np.argwhere(diff)]
 assert len(changed)=={'Cape':1,'Fire Lizard':5,'Apache Armor':1}[label]
 all_cases.append({'item':item,'name':label,'sourceFile':fname,'shift':[shiftx,shifty],'changed':changed,
    'current':base64.b64encode(current.tobytes()).decode(),'fix':base64.b64encode(fixed.tobytes()).decode()})
 print(label,'changes',changed)
path=root/'prototype/fixtures.json'
path.write_text(json.dumps({'format':'PHM-Native-Underlay-Prototype-Fixtures-1','frameSize':[64,64],
    'firearm':'Bolt','firearmSourceTexturePathID':49,'occlusionMask':base64.b64encode(bolt.tobytes()).decode(),
    'cases':all_cases},indent=2))
print(path)
