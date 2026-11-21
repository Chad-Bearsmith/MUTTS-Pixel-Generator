"""Add the exact Unity Crossbow and marked Shotgun first-idle masks to v83.

Based on live v83 traces showing unknown gun status -2 for both names. These
variants come from sharedassets0.assets rather than the previous source
registry built exclusively from resources.assets. No fuzzy matching or changes
to any accepted geometry rule / hand writer / weapon alpha coverage.
"""
from pathlib import Path
import json,base64,hashlib
import numpy as np
R=Path(__file__).resolve().parent
weapons=json.loads((R/'firearms/fixtures-v83.json').read_text())
assert len(weapons['weapons'])==23 and len(weapons['cases'])==12
FNV=2166136261

def maskhash(a):
 h=FNV
 for v in a[:,:,3].flat:h=((h^int(v))*16777619)&0xffffffff
 return f'0x{h:08x}'

cross=np.load(R/'firearms/Crossbow-sharedassets0-idle.npy')
marked=np.load(R/'firearms/Shotgun-marked-sharedassets0-idle.npy')
assert cross.shape==marked.shape==(64,64,4)
assert maskhash(cross)=='0x0175df7a'
assert maskhash(marked)=='0xcc087534'
orig=json.loads((R/'firearms/fixtures-v83.json').read_text())
shot=next(w for w in orig['weapons'] if w['name']=='Shotgun')
assert shot['id']==19 and shot['alphaHash']=='0x8b4dc278'
oldshot=np.frombuffer(base64.b64decode(shot['rgba']),np.uint8).reshape(64,64,4)
assert np.array_equal(oldshot[:,:,:3],marked[:,:,:3]),'Shotgun material colors must match'
changed=np.argwhere(oldshot[:,:,3]!=marked[:,:,3]);assert len(changed)==8
assert sorted([int(marked[y,x,3]) for y,x in changed])==[252]+[254]*7
union=np.zeros((64,64),bool)
for w in orig['weapons']:
 src=np.frombuffer(base64.b64decode(w['rgba']),np.uint8).reshape(64,64,4)
 union|=(src[:,:,3]>0)
assert int(union.sum())==255
assert not np.any((cross[:,:,3]>0)&~union)
assert not np.any((marked[:,:,3]>0)&~union)

variants=[
 dict(id=23,name='Crossbow',variant='sharedassets0.assets/Сrossbow (Cyrillic capital Es)',alphaHash=maskhash(cross),sourceSHA256=hashlib.sha256(cross.tobytes()).hexdigest(),rgba=base64.b64encode(cross.tobytes()).decode()),
 dict(id=19,name='Shotgun',variant='sharedassets0.assets/Shotgun, marked live variant',alphaHash=maskhash(marked),sourceSHA256=hashlib.sha256(marked.tobytes()).hexdigest(),rgba=base64.b64encode(marked.tobytes()).decode())
]
oldhashes={w['alphaHash'] for w in orig['weapons']}
assert len(oldhashes | {v['alphaHash'] for v in variants})==25
new={**orig,'format':'PHM-v84-CrossGun-Fixtures-1', 'source':'Original resources.assets 23-mask registry plus exact sharedassets0.assets Crossbow and marked Shotgun first-idle masks', 'weapons':orig['weapons']+variants,'additionalVariants':variants,'weaponCountDistinct':24, 'knownMaskCount':25}
(R/'firearms/fixtures-v84.json').write_text(json.dumps(new,indent=2)+'\n')
src=(R/'prototype/native_underlay_v83.c').read_text()
needle='  if(!gun_id)return -2; /* unsupported firearm */'
assert src.count(needle)==1
insert='''  /* v84: exact Unity sharedassets0 masks missing from the v83 resource registry. */
  if(alpha_hash==0x0175df7au)gun_id=23; /* Crossbow, Unity source name begins U+0421 */
  if(alpha_hash==0xcc087534u)gun_id=19; /* Shotgun: marked alpha254/252 source variant */
'''
src=src.replace(needle,insert+needle)
src=src.replace('MUTTS Pixel Generator v.83 experimental','MUTTS Pixel Generator v.84 experimental')
src=src.replace('replaces v82 helper 71935','replaces v83 helper 71935')
(R/'prototype/native_underlay_v84.c').write_text(src)
print('PASS 23 original masks unchanged; added two exact Unity source variants')
print('PASS unchanged 255-pixel union and all 12 correction rules')
print('PASS Shotgun RGB identical; only 7 hand-marker alpha and 1 material alpha differ')
for v in variants:print('  ',v['name'],v['variant'],v['alphaHash'])
