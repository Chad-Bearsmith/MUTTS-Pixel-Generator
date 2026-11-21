"""Generate fail-closed source-identity corrective stage from original Unity texture masks.
No texture bytes are inserted into wasm; only two independent per-layer alpha
signatures and named source-specific sample coordinates are compared.
"""
from pathlib import Path
import json,mmap,struct,numpy as np
R=Path(__file__).resolve().parents[1]
old=(R/'prototype/native_underlay_v87.c').read_text()
ref=json.load(open(R/'prototype/fixtures_v82.json'))['cases']
root=Path('/mnt/data/phm-v81-work/unity-assets')
textures={}
for filename in ['sharedassets0.assets','resources.assets']:
 f=open(root/filename,'rb');b=mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ);d=struct.unpack_from('>Q',b,32)[0]
 for e in json.load(open(root/(filename+'.index.json'))):
  if e.get('cl')!=28 or e['size']<2_138_112:continue
  p=d+e['offset'];n=struct.unpack_from('<I',b,p)[0];start=p+((4+n+3)&~3)+88
  a=np.flipud(np.frombuffer(b,dtype=np.uint8,count=576*928*4,offset=start).reshape(928,576,4))[64:128,:64].copy()
  textures[(filename,e['pathid'])]=a

def h(arr):
 s=(arr[:,:,3]>0).astype('u1');v=2166136261
 for pixel in s.reshape(-1):v=((v^int(pixel))*16777619)&0xffffffff
 return v
A=lambda id:('sharedassets0.assets',id)
B=lambda id:('resources.assets',id)
# Primary item identity uses an alpha mask UNIQUE among the 564 original source textures.
# Donor is the item's actual current swatch-adjusted array, not a sampled finished character.
CFG={
 1:dict(sentinel=[A(203)],donor=A(203)),
 2:dict(sentinel=[A(35)],donor=A(86)),
 3:dict(sentinel=[A(325),A(358)],donor=A(325)),
 4:dict(sentinel=[B(166),B(238)],donor=B(166)),
 5:dict(sentinel=[A(16)],donor=A(16)),
 6:dict(sentinel=[A(147),A(205)],donor=A(147)),
 7:dict(sentinel=[A(64)],donor=A(157)),
 8:dict(sentinel=[A(303)],donor=A(50)),
 9:dict(sentinel=[A(74)],donor=A(74)),
10:dict(sentinel=[A(40)],donor=A(66)),
11:dict(sentinel=[A(383)],donor=A(212)),
12:dict(sentinel=[B(236)],donor=B(15))}
assert len(CFG)==12
for id,c in CFG.items():
 assert c['donor'] in textures
 for s in c['sentinel']:assert s in textures
 print(id,ref[id-1]['name'],'identity',[f'{h(textures[s]):08x}' for s in c['sentinel']], 'donor',f'{h(textures[c["donor"]]):08x}')

lib=[]
lib.append(r'''
/* v88: SOURCE-IDENTIFIED corrective stage, behind foreground equipment and firearm.
   Source alpha shapes derive from the original compiled Unity texture atlases.
   We require an item-unique sentinel and the palette-adjusted donor source
   within the same *fresh* native builder layer list. We never infer item type
   from the completed character, which can be obscured by helmets/capes.
   All copy/erase writes target that item's original array, NOT slots[n-2]. */
__attribute__((always_inline)) static inline u32 v88_alpha_shape(u32 layer){
  u32 h=FNV_INIT;u32 *p=pixels(layer);
  for(int y=0;y<64;++y)for(int x=0;x<64;++x)
    h=hashbyte(h,(p[index_for(x,y)]>>24)?1u:0u);
  return h;
}
__attribute__((always_inline)) static inline int v88_find(u32 *hashes,u32 n,u32 expected){
 int found=-1;
 for(u32 j=0;j<n-1;++j)if(hashes[j]==expected){
  if(found>=0)return -2; /* ambiguous duplicate layers, fail closed */
  found=(int)j;
 }
 return found;
}
typedef struct {u32* dst;u32 p;u32 color;} V88Patch;
__attribute__((always_inline)) static inline int v88_independent_sources(u32 *slots,u32 n,u32 *gp,int gun_id){
 u32 hashes[MAX_LAYERS];
 for(u32 i=0;i<n-1;++i)hashes[i]=v88_alpha_shape(slots[i]);
 V88Patch jobs[96];int jobsCount=0,seen=0,confirmed=0;u32 matchedItems=0u;
''')
for case in ref:
 id=case['item'];cfg=CFG[id];dhash=h(textures[cfg['donor']]);checks=[h(textures[x]) for x in cfg['sentinel']]
 var=f'd{id}';lib.append(f' {{ /* {id}: {case["name"]} */\n')
 lib.append(f'  const int {var}=v88_find(hashes,n,0x{dhash:08x}u);\n')
 for i,sh in enumerate(checks):
  lib.append(f'  const int s{id}_{i}=v88_find(hashes,n,0x{sh:08x}u);\n')
 expression=f'{var}>=0'+''.join(f' && s{id}_{i}>=0' for i in range(len(checks)))
 lib.append(f'  if({expression}){{\n    seen++;matchedItems|=(1u<<({id}-1));\n')
 # For Apache, target erasure is from any uniquely recognized Apache asset sources.
 if id==3:
  p=case['changed'][0];x,y=p['x'],p['y']
  lib.append(f'    const u32 at=index_for({x},{y});\n')
  lib.append('    if((gp[at]>>24)==0u){\n')
  for i in range(len(checks)):
   lib.append(f'     if((pixels(slots[s{id}_{i}])[at]>>24)!=0u){{ if(jobsCount>=96)return -10; jobs[jobsCount++]=(V88Patch){{pixels(slots[s{id}_{i}]),at,0u}};confirmed++; }}\n')
  lib.append('    }\n')
 else:
  anchors={}
  for p in case['changed']:
   if p['sample'] is not None:
    key=tuple(p['sample']);anchors[key]=f'c{id}_{len(anchors)}' if key not in anchors else anchors[key]
  # Validate anchor source rgba if occupied in exact texture; fail closed otherwise. Include swatches via LIVE source.
  for key,variable in anchors.items():
   x,y=key;aa=textures[cfg['donor']][y,x]
   if aa[3]==0:print('WARN anchor transparent in donor',case['name'],key)
   lib.append(f'    const u32 {variable}=pixels(slots[{var}])[index_for({x},{y})];\n')
  lib.append('    int valid=1;\n')
  for variable in anchors.values():lib.append(f'    if(({variable}>>24)!=255u)valid=0;\n')
  lib.append('    if(valid){\n')
  for p in case['changed']:
   x,y=p['x'],p['y'];src=p['sample'];after=p['after']
   if src is not None:val=anchors[tuple(src)]
   elif id==6:val=f'dracula_bright_from_dark(pixels(slots[{var}])[index_for(27,22)])'
   else:raise ValueError((id,p))
   lib.append(f'     {{const u32 at=index_for({x},{y});if((gp[at]>>24)==0u){{if(jobsCount>=96)return -10; jobs[jobsCount++]=(V88Patch){{pixels(slots[{var}]),at,{val}}};confirmed++;}}}}\n')
  lib.append('    }\n')
 lib.append('  }\n }\n')
lib.append(r'''
 if(!seen)return -3;
 if(!confirmed)return -6;
 /* Check for conflicting operations on the same underlying array/pixel. */
 for(int a=0;a<jobsCount;++a)for(int b=a+1;b<jobsCount;++b)
  if(jobs[a].dst==jobs[b].dst && jobs[a].p==jobs[b].p && jobs[a].color!=jobs[b].color)return -9;
 for(int a=0;a<jobsCount;++a)jobs[a].dst[jobs[a].p]=jobs[a].color;
 int reported=99;
 if(seen==1){for(int id=1;id<=12;++id)if(matchedItems==(1u<<(id-1)))reported=id;}
 return 8000 + (gun_id*100) + reported;
}
__attribute__((always_inline)) static inline int v88_try_original_first(int previous,u32 *slots,u32 n,u32 *gp,u32 weapon_hash){
 if(previous!=-3&&previous!=-7)return previous;
 int gun_id=0;
 /* All 25 original masks are checked by the unchanged v87 helper first.
    We reach this branch only for its known skip statuses. */
 if(weapon_hash==BOLT_ALPHA_FNV)gun_id=0;
 else if(weapon_hash==0x0175df7au)gun_id=23;
 else if(weapon_hash==0xcc087534u || weapon_hash==0x8b4dc278u)gun_id=19;
 else gun_id=24; /* recognized other source variant; don't invent a weapon name */
 const int newer=v88_independent_sources(slots,n,gp,gun_id);
 return newer>0?newer:previous;
}
''')
src=old
needle='__attribute__((export_name("phm_native_underlay")))';assert src.count(needle)==1
src=src.replace(needle,'\n'.join(lib)+'\n'+needle)
needle='if(weapon_hash!=BOLT_ALPHA_FNV) return cross_gun_underlay(slots,n,gp,weapon_hash);';assert src.count(needle)==1
src=src.replace(needle,'if(weapon_hash!=BOLT_ALPHA_FNV) return v88_try_original_first(cross_gun_underlay(slots,n,gp,weapon_hash),slots,n,gp,weapon_hash);')
needle='else return cross_gun_underlay(slots,n,gp,weapon_hash); /* original Bolt exact-match guard failed: try recolor */';assert src.count(needle)==1
src=src.replace(needle,'else return v88_try_original_first(cross_gun_underlay(slots,n,gp,weapon_hash),slots,n,gp,weapon_hash); /* v88: source identity after strict legacy match */')
src=src.replace('v.87 experimental','v.88 experimental',1)
(R/'prototype/native_underlay_v88.c').write_text(src)
(R/'firearms/v88-source-layer-selection.json').write_text(json.dumps({'format':'v88-alpha-source-item-provenance','source':'Original Unity compiled texture source atlas first idle alpha mask; no RGB guessing','items':{str(i):{'name':ref[i-1]['name'],'sentinel':list(map(lambda j:hex(h(textures[j])),CFG[i]['sentinel'])),'donor':hex(h(textures[CFG[i]['donor']])), 'sentinelTex':[[x[0],x[1]] for x in CFG[i]['sentinel']],'donorTex':[CFG[i]['donor'][0],CFG[i]['donor'][1]],'changes':ref[i-1]['changed']} for i in CFG}},indent=2)+'\n')
print('Created source-aware code for all 12 items')
