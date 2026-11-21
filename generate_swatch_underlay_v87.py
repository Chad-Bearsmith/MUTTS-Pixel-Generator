"""v87 native palette guards: narrowly permit exactly real observed swatch-boundary changes.

All preexisting v86 matching/occlusion/underlay behavior is untouched. This
is not a helmet compatibility fix: a helmet changes native layer composition.
"""
from pathlib import Path
import numpy as np,hashlib,base64,json
from PIL import Image
P=Path(__file__).resolve().parent
D=json.loads((P/'firearms/fixtures-v84.json').read_text())
source=(P/'prototype/native_underlay_v86.c').read_text()
union=np.zeros((64,64),bool)
for w in D['weapons']:
 a=np.frombuffer(base64.b64decode(w['rgba']),np.uint8).reshape(64,64,4)
 union|=a[:,:,3]>0
assert union.sum()==255
# This is the FULL set of observed changes in RGB equality with immediate left/
# above pixels in the FOUR user PNGs, not an open-ended alpha-only recognition.
sites={2:{(32,12),(32,13)},8:{(33,13)},10:{(29,9),(31,12),(31,13),(35,13),(36,13)}}
assert all(not union[y,x] for s in sites.values() for x,y in s)

def struct_hash(a,which):
 h=2166136261
 for y in range(64):
  for x in range(64):
   if union[y,x]:continue
   c=a[y,x];k=1 if c[3] else 0
   if k:
    if x>0 and not union[y,x-1] and a[y,x-1,3] and np.array_equal(c[:3],a[y,x-1,:3]):k|=2
    if y>0 and not union[y-1,x] and a[y-1,x,3] and np.array_equal(c[:3],a[y-1,x,:3]):k|=4
   if (x,y) in sites[which]:k&=1
   h=((h^k)*16777619)&0xffffffff
 return h
fingerprints={}
for item in sites:
 hashes={}
 for case in D['cases']:
  A=np.frombuffer(base64.b64decode(case['current']),np.uint8).reshape(64,64,4)
  hashes[case['id']]=struct_hash(A,item)
 fingerprints[item]=hashes[item]
 assert [i for i,h in hashes.items() if h==hashes[item]]==[item],(item,hashes)
# Re-check original user exports (and their crop offsets) against immutable Bolt.
bolt=next(w for w in D['weapons'] if w['name']=='Bolt')
B=np.frombuffer(base64.b64decode(bolt['rgba']),np.uint8).reshape(64,64,4)
bmask=B[:,:,3]==255
for i,item in [(0,2),(1,8),(2,10),(3,10)]:
 p=P/'real-v86-examples'/('SpriteSheet'+('' if i==0 else f' ({i})')+'.png')
 im=np.asarray(Image.open(p).convert('RGBA'))
 assert im.shape[0]%20==0 and im.shape[1]%20==0
 sm=im[::20,::20,:]
 assert np.array_equal(im,np.repeat(np.repeat(sm,20,0),20,1))
 h,w=sm.shape[:2]
 found=[(x,y) for y in range(65-h) for x in range(65-w) if int(bmask[y:y+h,x:x+w].sum())==54 and np.array_equal(sm[bmask[y:y+h,x:x+w]],B[y:y+h,x:x+w][bmask[y:y+h,x:x+w]])]
 assert len(found)==1,(i,found)
 x,y=found[0];live=np.zeros((64,64,4),np.uint8);live[y:y+h,x:x+w]=sm
 assert struct_hash(live,item)==fingerprints[item],(i,item)
 np.save(P/'real-v86-examples'/f'frame-{i}.npy',live)
 print('PASS live example',i,'native recognized item',item,'image offset',(x,y))
func='''/* v87: third-stage, per-item structural signatures for four REAL failed swatches.
   Uses original alpha and all RGB class boundaries except the listed verified
   shade-equality sites, and still excludes every known firearm silhouette.
   Do NOT treat this as proof of helmet/outfit identity: those remain guarded. */
__attribute__((always_inline)) static inline void v87_palette_signatures(u32* slots,u32 n,u32* fire,u32* lizard,u32* werewolf){
 u32 h2=FNV_INIT,h8=FNV_INIT,h10=FNV_INIT;
 for(int y=0;y<64;++y)for(int x=0;x<64;++x){
  if(occupied_by_any_gun(x,y))continue;
  u32 c=under_character(slots,n,index_for(x,y));
  u32 k=(c>>24)?1u:0u;
  if(k){
   if(x>0&&!occupied_by_any_gun(x-1,y)){
    u32 left=under_character(slots,n,index_for(x-1,y));
    if((left>>24)&&((c&0x00ffffffu)==(left&0x00ffffffu)))k|=2u;
   }
   if(y>0&&!occupied_by_any_gun(x,y-1)){
    u32 above=under_character(slots,n,index_for(x,y-1));
    if((above>>24)&&((c&0x00ffffffu)==(above&0x00ffffffu)))k|=4u;
   }
  }
  u32 k2=k,k8=k,k10=k;
  if(x==32&&(y==12||y==13))k2&=1u; /* Fire Lizard palette 12 */
  if(x==33&&y==13)k8&=1u;          /* Lizard palette 12 */
  if((x==29&&y==9)||(x==31&&(y==12||y==13))||(x==35&&y==13)||(x==36&&y==13))k10&=1u; /* Werewolf palettes 4 and 19 */
  h2=hashbyte(h2,k2);h8=hashbyte(h8,k8);h10=hashbyte(h10,k10);
 }
 *fire=h2;*lizard=h8;*werewolf=h10;
}
'''
needle='__attribute__((always_inline)) static inline int swatch_underlay(u32* slots,u32 n,u32* gp,int gun_id){'
assert source.count(needle)==1
source=source.replace(needle,func+needle)
needle=' if(!item)return -3; /* unknown structural appearance */'
assert source.count(needle)==1
source=source.replace(needle,''' if(!item){ /* Narrow tested swatch variants only; source/target guards unchanged */
  u32 fire=0,lizard=0,werewolf=0;
  v87_palette_signatures(slots,n,&fire,&lizard,&werewolf);
'''+f'''  if(fire==0x{fingerprints[2]:08x}u)item=2;
  else if(lizard==0x{fingerprints[8]:08x}u)item=8;
  else if(werewolf==0x{fingerprints[10]:08x}u)item=10;
'''+''' }
'''+needle)
source=source.replace('MUTTS Pixel Generator v.86 experimental','MUTTS Pixel Generator v.87 experimental')
(P/'prototype/native_underlay_v87.c').write_text(source)
(P/'firearms/swatch-signatures-v87.json').write_text(json.dumps({
 'format':'PixelHero-v87-PerItemGuardedSwatchSignatures-1',
 'previousNativeSourceSHA256':hashlib.sha256((P/'prototype/native_underlay_v86.c').read_bytes()).hexdigest(),
 'recognizedCases':{str(k):{'name':next(c['name'] for c in D['cases'] if c['id']==k),'fingerprint':f'0x{fingerprints[k]:08x}','relaxedSitesXY':sorted([list(p) for p in sites[k]])} for k in sites},
 'realExports':[{'file':'SpriteSheet'+('' if not i else f' ({i})')+'.png','item':item} for i,item in [(0,2),(1,8),(2,10),(3,10)]],
 'firearmUnionPixelsExcluded':255,
 'helmetCompatibility':'NOT CLAIMED; source-layer native provenance is needed to identify selected items underneath helmets',
 'originalPath':'unchanged v86 exact/strict/relaxed and all original correction templates/alpha guards',
},indent=2)+'\n')
print('PASS v87 native item-specific guarded fingerprints:',{k:hex(v) for k,v in fingerprints.items()})
