from pathlib import Path
import json,mmap,struct,numpy as np,base64,glob
R=Path(__file__).resolve().parent.parent
assets=Path('/mnt/data/phm-v81-work/unity-assets')
source=[]
for filename in ['sharedassets0.assets','resources.assets']:
 f=open(assets/filename,'rb');buf=mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ);base=struct.unpack_from('>Q',buf,32)[0]
 for e in json.load(open(assets/(filename+'.index.json'))):
  if e.get('cl')!=28 or e['size']<2_138_112:continue
  loc=base+e['offset'];n=struct.unpack_from('<I',buf,loc)[0];pos=loc+((4+n+3)&~3)+88
  frame=np.flipud(np.frombuffer(buf,dtype='u1',count=576*928*4,offset=pos).reshape(928,576,4))[64:128,:64].copy()
  if np.any(frame[:,:,3]):source.append((e['name'],filename,e['pathid'],frame))
source.sort(key=lambda e:0 if e[1]=='sharedassets0.assets' else 1)
# Raw original native Bolt material/hand markers, not just a binary mask.
bolt=np.load(R/'prototype/Bolt-idle.npy')
assert bolt.shape==(64,64,4)
outs=[]
for p in sorted(glob.glob('/mnt/data/PixelHero-v87-IdleAutoHandTrace*.json')):
 d=json.load(open(p))['result'];u=d.get('underlaySourceLayers') or {}
 if not u.get('available'):continue
 layers=[]
 for l in u['layers']:
  if l['firearm']: continue
  expected=np.unpackbits(np.frombuffer(bytes.fromhex(l['alphaMask64x64Hex']),dtype='u1'),bitorder='little').reshape(64,64)>0
  matched=[(name,file,id,t) for name,file,id,t in source if np.array_equal(t[:,:,3]>0,expected)]
  if matched:
   name,file,id,t=matched[0];t=t.copy()
  else:
   name='unknown';id=None;t=np.zeros((64,64,4),dtype='u1');t[:,:,3]=np.where(expected,255,0).astype('u1')
  # Force the observed native source coordinates to match the user's trace.
  # This does not change alpha shapes and is a fidelity check for matching sources.
  for sample in l['sampleCoordsZeroBased']:
   x,y=sample['xy'];v=sample['rgba'];assert int(t[y,x,3]>0)==int(v[3]>0)
   t[y,x]=v
  layers.append({'slot':l['slot'],'source':f'{name}:{id}','rgba':base64.b64encode(t.tobytes()).decode('ascii')})
 outs.append({'trace':Path(p).name,'originalUnderlayStatus':d['experimentalUnderlay']['status'], 'handStatus':d['status'], 'layers':layers,
              'expectedMerman':any(q['source'].startswith('Merman:74') for q in layers) and any(q['source'].startswith('Merman:257') for q in layers),
              'expectedCape':any(q['source'].startswith('Cape:203') for q in layers)})
(R/'tests/v88-native-trace-fixtures.json').write_text(json.dumps({'format':'v88-user-native-layer-trace-fixtures','source':'Exact user v87 native alpha masks and reported sampled RGBA, other pixels filled from matching Unity source assets, not live complete RGBA arrays','boltRGBA':base64.b64encode(bolt.tobytes()).decode('ascii'),'cases':outs},separators=(',',':')))
for t in outs:print(t['trace'],'layers',[(x['slot'],x['source']) for x in t['layers']],'Merman',t['expectedMerman'],'Cape',t['expectedCape'])
