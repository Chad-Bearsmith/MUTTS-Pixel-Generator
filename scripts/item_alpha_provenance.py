import json,mmap,struct,numpy as np,collections,hashlib
from pathlib import Path
root=Path('/mnt/data/phm-v81-work/unity-assets')
all=[]
for filename in ['sharedassets0.assets','resources.assets']:
 f=open(root/filename,'rb');b=mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ)
 off=struct.unpack_from('>Q',b,32)[0]
 for e in json.load(open(root/(filename+'.index.json'))):
  if e.get('cl')!=28:continue
  p=off+e['offset'];n=struct.unpack_from('<I',b,p)[0];data=p+((4+n+3)&~3)+88
  if e['size']<2_138_112:continue
  try:
   pixels=np.frombuffer(b,dtype=np.uint8,count=576*928*4,offset=data).reshape(928,576,4)
  except: continue
  tile=np.flipud(pixels)[64:128,:64].copy(); mask=tile[:,:,3]>0
  if not mask.any():continue
  key=hashlib.sha256(np.packbits(mask.reshape(-1),bitorder='little').tobytes()).hexdigest()[:16]
  all.append({'name':e['name'],'pathid':e['pathid'],'file':filename,'count':int(mask.sum()),'key':key,'mask':mask})
 groups=collections.defaultdict(list)
 for e in all: groups[e['key']].append(e)
print('TOTAL',len(all),'DIFFERENT MASKS',len(groups))
for name in ['Merman','FireLizard','Furry','Werewolf','Lizard','Apache','Angel','Alien','Dracula','Cape','Hellsing','SnowRider','Human','Astronaut']:
 print('\n',name)
 for e in all:
  if e['name'].lower()==name.lower():
   users=groups[e['key']]
   print(e['file'],e['pathid'],'alpha',e['count'],'key',e['key'],'shared by',len(users),[(u['name'],u['file'].replace('.assets',''),u['pathid']) for u in users[:10]])
Path('/mnt/data/phm-v88-work/item-source-alpha-index.json').write_text(json.dumps([{k:v for k,v in e.items() if k!='mask'} for e in all],indent=2))
