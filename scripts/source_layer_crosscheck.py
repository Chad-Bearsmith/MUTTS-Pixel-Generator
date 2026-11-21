import json,mmap,struct,numpy as np,glob,os
from pathlib import Path
root=Path('/mnt/data/phm-v81-work/unity-assets')
idx=json.load(open(root/'texture-index.json'))
f=open(root/'sharedassets0.assets','rb');b=mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ)
dataoff=struct.unpack_from('>Q',b,32)[0]

def maskfromhex(h):return np.unpackbits(np.frombuffer(bytes.fromhex(h),dtype=np.uint8),bitorder='little').astype(bool)
textures=[]
for e in idx:
 if e['typeid']!=2:continue
 off=dataoff+e['offset'];n=struct.unpack_from('<I',b,off)[0];pixoff=((4+n+3)&~3)+84+4
 try: frame=np.flipud(np.frombuffer(b,dtype=np.uint8,count=576*928*4,offset=off+pixoff).reshape(928,576,4))[64:128,:64].copy()
 except:continue
 mask=(frame[:,:,3]>0).reshape(-1)
 if mask.sum()>0:
  textures.append((e['pathid'],e['name'],mask,frame))
print('source textures',len(textures))
for p in sorted(glob.glob('/mnt/data/PixelHero-v87-IdleAutoHandTrace*.json')):
 d=json.load(open(p))['result'];sl=d.get('underlaySourceLayers',{});layers=sl.get('layers',[])
 if not layers:continue
 print('\n',Path(p).name)
 for l in layers:
  if l['firearm']:continue
  mask=maskfromhex(l['alphaMask64x64Hex']);n=mask.sum()
  r=[]
  for tid,name,tex,tframe in textures:
   intersection=(mask&tex).sum()
   total=(mask|tex).sum()
   if not intersection: continue
   score=intersection / total
   if score>0.18:r.append((score,int(intersection),int(tex.sum()),name,tid))
  r.sort(reverse=True)
  print(' slot',l['slot'],'total',n,'matches',r[:5])
