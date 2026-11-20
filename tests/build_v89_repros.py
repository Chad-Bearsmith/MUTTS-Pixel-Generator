from pathlib import Path
import json,base64,numpy as np
R=Path(__file__).resolve().parent.parent
from pathlib import Path
root=Path('/mnt/data')
files=['PixelHero-v88-IdleAutoHandTrace (1).json','PixelHero-v88-IdleAutoHandTrace (2).json','PixelHero-v88-IdleAutoHandTrace (3).json','PixelHero-v88-IdleAutoHandTrace (4).json','PixelHero-v88-IdleAutoHandTrace.json']
# The actual supplied per-layer full alpha masks and sampled RGBA values are exact;
# unsampled RGB channels are synthetic, NOT certified as native RGB state.
cases=[]
for f in files:
 d=json.loads((root/f).read_text())['result']; ls=d['underlaySourceLayers']['layers']
 layers=[]
 for l in ls:
  mask=np.unpackbits(np.frombuffer(bytes.fromhex(l['alphaMask64x64Hex']),dtype='u1'),bitorder='little').reshape(64,64)>0
  a=np.zeros((64,64,4),dtype=np.uint8)
  a[mask]=[128,128,128,255]
  for t in l['sampleCoordsZeroBased']:
   x,y=t['xy'];a[y,x]=t['rgba']
  if f.endswith('(2).json') and l['slot']==1:
   if a[22,27,3]:a[22,27]=[196,36,48,255]
  layers.append(base64.b64encode(a.tobytes()).decode())
 cases.append(dict(file=f,underlay=d['experimentalUnderlay']['status'],hand=d['status'],layers=layers))
(R/'tests/v89-uploaded-layer-fixtures.json').write_text(json.dumps({'format':'v89-layers-with-exact-native-alpha-and-seven-sample-rgba','description':'Exact uploaded masks+reference-site samples; all other RGB deliberately synthetic','cases':cases},separators=(',',':')))
print('wrote',len(cases),'uploaded test cases')
