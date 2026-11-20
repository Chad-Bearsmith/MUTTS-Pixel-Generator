"""Generate conservative cross-firearm helper extension from Unity source alpha masks.

Keep v82's accepted Bolt branch untouched. Do not pretend the Bolt Current/Fix
reference artwork independently proves what every other firearm should look like.
All new firearm cases are guarded, first-idle, and experimental.
"""
from pathlib import Path
import json,base64,hashlib
import numpy as np
ROOT=Path(__file__).resolve().parent
FIX=json.loads((ROOT/'prototype/fixtures_v82.json').read_text())
W=np.load(ROOT/'firearms/source-idle.npz')
weapons=['Bolt']+sorted(n for n in W.files if n!='Bolt')
assert len(weapons)==23
union=np.zeros((64,64),bool)
weapon_records=[]
FNV=2166136261
for idx,name in enumerate(weapons):
 src=W[name]
 assert src.shape==(64,64,4)
 aa=src[:,:,3]
 union|=aa>0
 h=FNV
 for v in aa.reshape(-1):h=((h^int(v))*16777619)&0xffffffff
 weapon_records.append(dict(id=idx,name=name,alphaHash=f'0x{h:08x}',sourceSHA256=hashlib.sha256(src.tobytes()).hexdigest(),rgba=base64.b64encode(src.tobytes()).decode()))
assert len({x['alphaHash'] for x in weapon_records})==23,'gun alpha masks are ambiguous'
assert weapon_records[0]['alphaHash']=='0x3dbe5bbd','Bolt hash changed'
assert not np.any(union[24:,:])
# Build a gun-independent signature from only pixels guaranteed transparent in
# all 23 known source masks. This is NOT a selectable-item identity lookup.
def signature(frame):
 h=FNV
 for y in range(64):
  for x in range(64):
   if union[y,x]:continue
   color=frame[y,x].copy()
   if color[3]==0:color[:]=0
   else:color[3]=255
   for byte in color:h=((h^int(byte))*16777619)&0xffffffff
 return h
cases=[]
for c in FIX['cases']:
 current=np.frombuffer(base64.b64decode(c['current']),np.uint8).reshape(64,64,4)
 sign=signature(current)
 cases.append(dict(id=c['item'],name=c['name'],signature=f'0x{sign:08x}',patches=c['changed'],current=c['current'],fix=c['fix']))
assert len({c['signature'] for c in cases})==12
# 255 exact positions covered by at least one of the source firearms.
assert union.sum()==255,union.sum()
print('23 weapons, union exclusions',int(union.sum()),'distinct user reference fingerprints',len(cases))
for c in cases:print(' ',c['id'],c['name'],c['signature'],len(c['patches']))
( ROOT/'firearms/fixtures-v83.json').write_text(json.dumps(dict(format='PHM-v83-CrossGun-Fixtures-1',source='Unity Build/WebGL.data / resources.assets Texture2D first idle',weapons=weapon_records,cases=cases,unionMaskedPixels=int(union.sum())),indent=2)+'\n')
# Use generated expressions, never a data section. Replacing an existing Wasm
# method body cannot introduce read-only data segments or new helper functions.
rows=[]
for y in range(64):
 lo=sum((1<<x) for x in range(32) if union[y,x]);hi=sum((1<<(x-32)) for x in range(32,64) if union[y,x])
 if lo or hi:rows.append((y,lo,hi))
assert len(rows)==15
helper='''
/* v83: non-Bolt-only guarded corrective underlay. The following mask is the
   union of all recognized Unity firearm alpha silhouettes (not a rectangle).
   It ensures a reference fingerprint is insensitive to the weapon art. */
static inline int occupied_by_any_gun(int x,int y){
  u32 lo=0u,hi=0u;
'''
for y,lo,hi in rows:
 helper+=f'  lo|=((u32)-(int)(y=={y})&0x{lo:08x}u); hi|=((u32)-(int)(y=={y})&0x{hi:08x}u);\n'
helper+='  return (x<32)?((lo>>x)&1u):((hi>>(x-32))&1u);\n}\n'
helper+='''
__attribute__((always_inline)) static inline u32 under_character(u32* slots,u32 n,u32 p){
 u32 out=0;
 for(u32 i=0;i<n-1;++i){
  u32 c=pixels(slots[i])[p];
  if((c>>24)!=0u)out=c;
 }
 return out;
}
__attribute__((always_inline)) static inline int cross_gun_underlay(u32* slots,u32 n,u32* gp,u32 alpha_hash){
 int gun_id=0;
'''
for w in weapon_records[1:]:
 helper+=f'  if(alpha_hash=={w["alphaHash"]}u)gun_id={w["id"]};\n'
helper+='  if(!gun_id)return -2; /* unsupported firearm */\n'
helper+='''  u32 whole=FNV_INIT;
  for(int y=0;y<64;++y)for(int x=0;x<64;++x){
    if(occupied_by_any_gun(x,y))continue;
    u32 c=under_character(slots,n,index_for(x,y));
    if((c>>24)==0)c=0;
    else c=(c&0x00ffffffu)|0xff000000u;
    whole=hashbyte(whole,c);
    whole=hashbyte(whole,c>>8);
    whole=hashbyte(whole,c>>16);
    whole=hashbyte(whole,c>>24);
  }
  int item=0;
'''
for c in cases:
 helper+=f'  if(whole=={c["signature"]}u)item={c["id"]};\n'
helper+='''  if(!item)return -3; /* not exact reference character */
  /* Prevalidate all visible corrections and their color samples BEFORE
     writing any managed array, ensuring a failed case cannot partially edit. */
  int visible=0;
'''
for c in cases:
 helper+=f'  if(item=={c["id"]}){{ /* {c["name"]} */\n'
 for i,p in enumerate(c['patches']):
  x,y=p['x'],p['y']
  before=(p['before'][0] | p['before'][1]<<8 | p['before'][2]<<16 | p['before'][3]<<24)
  aft=(p['after'][0] | p['after'][1]<<8 | p['after'][2]<<16 | p['after'][3]<<24)
  helper+=f'    if((gp[index_for({x},{y})]>>24)==0u){{\n      visible++;\n'
  helper+=f'      if(under_character(slots,n,index_for({x},{y}))!=0x{before:08x}u)return -7;\n'
  if p['after'][3]>0 and p['sample'] is not None:
   sx,sy=p['sample'];helper+=f'      if(under_character(slots,n,index_for({sx},{sy}))!=0x{aft:08x}u)return -4;\n'
  helper+='    }\n'
 helper+='  }\n'
helper+='  if(!visible)return -6; /* all correction sites hidden by firearm */\n'
for c in cases:
 helper+=f'  if(item=={c["id"]}){{\n'
 for p in c['patches']:
  x,y=p['x'],p['y']
  aft=(p['after'][0] | p['after'][1]<<8 | p['after'][2]<<16 | p['after'][3]<<24)
  src=p['sample']
  if p['after'][3]==0:expr='0u'
  elif src is None:expr=f'0x{aft:08x}u'  # one literal Dracula red
  else:expr=f'under_character(slots,n,index_for({src[0]},{src[1]}))'
  helper+=f'    if((gp[index_for({x},{y})]>>24)==0u){{\n'
  if p['after'][3]==0:helper+=f'      for(u32 j=0;j<n-1;++j)pixels(slots[j])[index_for({x},{y})]=0u;\n'
  else:helper+=f'      pixels(slots[n-2])[index_for({x},{y})]={expr};\n'
  helper+='    }\n'
 helper+='  }\n'
helper+='  return gun_id*100+item; /* Bolt remains 1..12; other guns identify both */\n}\n'
src=(ROOT/'prototype/native_underlay_v82.c').read_text()
needle='__attribute__((export_name("phm_native_underlay"))'
assert src.count(needle)==1
src=src.replace(needle,helper+'\n'+needle)
needle='    if(weapon_hash!=BOLT_ALPHA_FNV) return -2;'
assert src.count(needle)==1
src=src.replace(needle,'    if(weapon_hash!=BOLT_ALPHA_FNV) return cross_gun_underlay(slots,n,gp,weapon_hash);')
src=src.replace('Pixel Hero Maker v.82 experimental','Pixel Hero Maker v.83 experimental')
src=src.replace('This function is injected into the v.80 WebGL Wasm module','This function replaces v82 helper 71935 in the game Wasm module')
(ROOT/'prototype/native_underlay_v83.c').write_text(src)
print('Generated',len(src),'C source bytes, v82 Bolt original branch retained')
