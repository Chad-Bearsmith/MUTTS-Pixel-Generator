from pathlib import Path
import json,mmap,struct,numpy as np,base64
R=Path(__file__).resolve().parent.parent
cfg=json.load(open(R/'firearms/v88-source-layer-selection.json'))['items']
root=Path('/mnt/data/phm-v81-work/unity-assets')
arrays={}
for f in ['sharedassets0.assets','resources.assets']:
 src=open(root/f,'rb');b=mmap.mmap(src.fileno(),0,access=mmap.ACCESS_READ);off=struct.unpack_from('>Q',b,32)[0]
 for e in json.load(open(root/(f+'.index.json'))):
  if e.get('cl')!=28 or e['size']<2_138_112:continue
  pos=off+e['offset'];n=struct.unpack_from('<I',b,pos)[0];start=pos+((4+n+3)&~3)+88
  arrays[(f,e['pathid'])]=np.flipud(np.frombuffer(b,dtype='u1',count=576*928*4,offset=start).reshape(928,576,4))[64:128,:64].copy()
rows=[]
for item,rec in cfg.items():
 sources=[];keys=set()
 for key in [rec['donorTex']]+rec['sentinelTex']:
  f,id=key;k=(f,id)
  if k in keys:continue
  keys.add(k)
  a=arrays[k];sources.append({'asset':f+':'+str(id),'rgba':base64.b64encode(a.tobytes()).decode()})
 rows.append({'item':int(item),'name':rec['name'],'sources':sources,'changes':rec['changes']})
(R/'tests/v88-item-layer-fixtures.json').write_text(json.dumps({'format':'v88-user-item-source-asset-fixtures','boltRGBA':base64.b64encode(np.load(R/'prototype/Bolt-idle.npy').tobytes()).decode(),'cases':rows},separators=(',',':')))
print('wrote',len(rows),'item tests')
