"""v86: narrow recovery for real Furry/Werewolf body-palette edits.

Source: exact v85 helper; preserve its exact-color path, every other item,
firearm identity and correction. Only FIVE verified structural comparison sites
are normalized for a secondary signature, and only two item IDs may use it.
The native per-patch source/alpha guards remain unchanged.
"""
from pathlib import Path
import hashlib, base64, json
import numpy as np
from PIL import Image
R=Path(__file__).resolve().parent
SOURCE=R/'prototype/native_underlay_v85.c'
DEST=R/'prototype/native_underlay_v86.c'
D=json.loads((R/'firearms/fixtures-v84.json').read_text())
source=SOURCE.read_text()
expected='e29a'*0 # actual source sha supplied in generated audit

# All historical source items must remain unique in the restricted fallback.
union=np.zeros((64,64),bool)
for w in D['weapons']:
    array=np.frombuffer(base64.b64decode(w['rgba']),np.uint8).reshape(64,64,4)
    union|=array[:,:,3]!=0
assert int(union.sum())==255
sites={(30,10),(35,10),(30,11),(35,11),(29,9)}
assert all(not union[y,x] for x,y in sites)

def structural_hash(array, relaxed=False):
    h=2166136261
    for y in range(64):
        for x in range(64):
            if union[y,x]: continue
            c=array[y,x]
            k=int(c[3]!=0)
            if k and (not relaxed or (x,y) not in sites):
                if x and not union[y,x-1] and array[y,x-1,3] and np.array_equal(c[:3],array[y,x-1,:3]):k|=2
                if y and not union[y-1,x] and array[y-1,x,3] and np.array_equal(c[:3],array[y-1,x,:3]):k|=4
            h=((h^k)*16777619)&0xffffffff
    return h
hashes={}
for c in D['cases']:
    im=np.frombuffer(base64.b64decode(c['current']),np.uint8).reshape(64,64,4)
    h=structural_hash(im,True)
    hashes.setdefault(h,[]).append(c['id'])
    if c['id'] in (7,10):print('Fixture relaxed hash',c['name'],hex(h))
furry_hash=next(h for h,ids in hashes.items() if ids==[7])
were_hash=next(h for h,ids in hashes.items() if ids==[10])
assert furry_hash!=were_hash

# Validate against actual live v85 user exports, aligned to the native idle
# frame using the known cropped export offsets (from original v82 refs).
repros=[('SpriteSheet.png',7,(22,5)),('SpriteSheet (1).png',10,(22,4))]
for filename,item,offset in repros:
    p=R/'swatch-repros'/filename
    a=np.asarray(Image.open(p).convert('RGBA'))
    assert a.shape[0]%20==0 and a.shape[1]%20==0
    small=a[::20,::20]
    assert np.array_equal(a,np.repeat(np.repeat(small,20,axis=0),20,axis=1))
    out=np.zeros((64,64,4),dtype=np.uint8)
    x,y=offset;out[y:y+small.shape[0],x:x+small.shape[1]]=small
    fixture=next(c for c in D['cases'] if c['id']==item)
    old=np.frombuffer(base64.b64decode(fixture['current']),np.uint8).reshape(64,64,4)
    assert np.array_equal((out[:,:,3]>0)[~union],(old[:,:,3]>0)[~union])
    assert structural_hash(out,True)==(furry_hash if item==7 else were_hash)
    assert structural_hash(out,False)!=structural_hash(old,False)
    print('PASS real v85 swatch export:',filename,'item',item, 'relaxed',hex(structural_hash(out,True)))

# One-pass dual hash; compute k once, relaxed hash normalizes only five
# historically swatch-sensitive neighboring RGB comparisons. Alpha retained.
old='''__attribute__((always_inline)) static inline u32 swatch_signature(u32* slots,u32 n){
 u32 h=FNV_INIT;
 for(int y=0;y<64;++y)for(int x=0;x<64;++x){
  if(occupied_by_any_gun(x,y))continue;
  u32 c=under_character(slots,n,index_for(x,y));
  u32 k=(c>>24)?1u:0u;
  if(k){
   if(x>0 && !occupied_by_any_gun(x-1,y)){
     u32 left=under_character(slots,n,index_for(x-1,y));
     if((left>>24) && ((c&0x00ffffffu)==(left&0x00ffffffu))) k|=2u;
   }
   if(y>0 && !occupied_by_any_gun(x,y-1)){
     u32 above=under_character(slots,n,index_for(x,y-1));
     if((above>>24) && ((c&0x00ffffffu)==(above&0x00ffffffu))) k|=4u;
   }
  }
  h=hashbyte(h,k);
 }
 return h;
}'''
new='''__attribute__((always_inline)) static inline u32 swatch_signature(u32* slots,u32 n,u32* relaxed){
 u32 h=FNV_INIT, hr=FNV_INIT;
 for(int y=0;y<64;++y)for(int x=0;x<64;++x){
  if(occupied_by_any_gun(x,y))continue;
  u32 c=under_character(slots,n,index_for(x,y));
  u32 k=(c>>24)?1u:0u;
  if(k){
   if(x>0 && !occupied_by_any_gun(x-1,y)){
     u32 left=under_character(slots,n,index_for(x-1,y));
     if((left>>24) && ((c&0x00ffffffu)==(left&0x00ffffffu))) k|=2u;
   }
   if(y>0 && !occupied_by_any_gun(x,y-1)){
     u32 above=under_character(slots,n,index_for(x,y-1));
     if((above>>24) && ((c&0x00ffffffu)==(above&0x00ffffffu))) k|=4u;
   }
  }
  h=hashbyte(h,k); /* exact v85 structural fingerprint unchanged */
  /* Body swatches can split what were identical upper-fur shade boundaries.
     Relax ONLY the verified four Furry / one Werewolf positions, retaining
     the silhouette and all other shape/color-boundary comparisons. */
  if((x==30 && (y==10 || y==11)) || (x==35 && (y==10 || y==11)) || (x==29 && y==9)) k&=1u;
  hr=hashbyte(hr,k);
 }
 *relaxed=hr;
 return h;
}'''
assert source.count(old)==1
source=source.replace(old,new)
assert source.count(' u32 sig=swatch_signature(slots,n);')==1
source=source.replace(' u32 sig=swatch_signature(slots,n);',' u32 relaxed=0u;\n u32 sig=swatch_signature(slots,n,&relaxed);')
assert source.count(' if(!item)return -3; /* unknown structural appearance */')==1
source=source.replace(' if(!item)return -3; /* unknown structural appearance */',
                      f''' if(!item){{ /* narrow native-swatches fallback; never alter other items */
   if(relaxed==0x{furry_hash:08x}u)item=7;
   else if(relaxed==0x{were_hash:08x}u)item=10;
 }}
 if(!item)return -3; /* unknown structural appearance */''')
source=source.replace('Pixel Hero Maker v.85 experimental','Pixel Hero Maker v.86 experimental')
source=source.replace('replaces v84 helper 71935','replaces v85 helper 71935')
DEST.write_text(source)
(R/'firearms/swatch-signatures-v86.json').write_text(json.dumps({
 'format':'PixelHero-v86-SwatchFurryWerewolf-1',
 'previousHelperC_SHA256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
 'relaxedSitesXY':sorted([list(x) for x in sites]),
 'relaxedFingerprints':{'7 Furry Body':f'0x{furry_hash:08x}','10 Werewolf Body':f'0x{were_hash:08x}'},
 'collisionsAmong12':{f'0x{h:08x}':ids for h,ids in hashes.items() if len(ids)>1},
 'liveReproductions':[{'file':name,'item':i,'offsetXY':list(off)} for name,i,off in repros],
 'unchanged':'All original exact/swatch paths, target/source alpha and firearm tests',
 'limitations':'Only 5 confirmed swatch-sensitive equality sites relaxed for Furry/Werewolf; other unsupported combinations still fail closed'
},indent=2)+'\n')
print('PASS generated v86 helper',len(source),'bytes; only the two known exception identities use relaxed fingerprint')
