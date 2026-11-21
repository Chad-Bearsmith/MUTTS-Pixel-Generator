import json,mmap,struct,numpy as np,base64
from pathlib import Path
root=Path('/mnt/data/phm-v81-work/unity-assets');fixture=json.load(open('/mnt/data/phm-v88-work/prototype/fixtures_v82.json'))
arr=[]
for filename in ['sharedassets0.assets','resources.assets']:
 f=open(root/filename,'rb');b=mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ);dataoff=struct.unpack_from('>Q',b,32)[0]
 for e in json.load(open(root/(filename+'.index.json'))):
  if e.get('cl')!=28 or e['size']<2_138_112:continue
  n=struct.unpack_from('<I',b,dataoff+e['offset'])[0];off=dataoff+e['offset']+((4+n+3)&~3)+88
  t=np.flipud(np.frombuffer(b,dtype=np.uint8,count=576*928*4,offset=off).reshape(928,576,4))[64:128,:64].copy()
  arr.append((e['name'],filename,e['pathid'],t))
for case in fixture['cases']:
 name=case['name'];names={'Alien Armor':'Alien','Snow Rider Helmet':'SnowRider','Angel Armor':'Angel','Apache Armor':'Apache','Dracula Armor':'Dracula','Merman Body':'Merman','Fire Lizard':'FireLizard','Furry Body':'Furry','Lizard Body':'Lizard','Werewolf Body':'Werewolf','Hellsing Helmet':'Hellsing','Cape':'Cape'}
 key=names[name]
 coords=[(p['x'],p['y']) for p in case['changed']]
 print('\n',case['item'],name, 'targets',coords)
 for n,file,id,t in arr:
  if n!=key:continue
  pix=[tuple(t[y,x].tolist()) for x,y in coords]
  print('  ',file.replace('.assets',''),id,'alpha total',int((t[:,:,3]>0).sum()),'targets',[p if p[3] else '-' for p in pix])
