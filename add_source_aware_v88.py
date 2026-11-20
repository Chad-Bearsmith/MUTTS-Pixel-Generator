from pathlib import Path
R=Path(__file__).resolve().parent
src=(R/'prototype/native_underlay_v87.c').read_text()
# First release: targets uniquely observed in user-supplied v87 layer captures.
# The first idle alpha mask fingerprints are from exact Unity asset textures
# Merman pathID 74 (body) and 257 (tail/overlay), Cape pathID 203.
source=r'''
/* v88: independent-source evidence under overlapping equipment. These source
   alpha fingerprints are validated against the user's native v87 per-layer
   snapshots AND original Unity texture data. No whole-sprite shape guesses.
   No writes occur unless target and sample pixels pass all guards.
   This stage does not attempt unsafe reconstruction of missing source108. */
static inline u32 alpha_shape(u32 layer){
  u32 h=FNV_INIT;
  u32 *p=pixels(layer);
  for(int y=0;y<64;++y)for(int x=0;x<64;++x)
    h=hashbyte(h,((p[index_for(x,y)]>>24)!=0u)?1u:0u);
  return h;
}
static inline int v88_source_layer_underlay(u32 *slots,u32 n,u32 *gp){
  int mermanBody=-1,mermanTail=-1,cape=-1;
  for(u32 j=0;j<n-1;++j){
    const u32 h=alpha_shape(slots[j]);
    if(h==0xbed8b438u){if(mermanBody>=0)return -3;mermanBody=(int)j;}
    if(h==0xb06f7f9du){if(mermanTail>=0)return -3;mermanTail=(int)j;}
    if(h==0x55c92166u){if(cape>=0)return -3;cape=(int)j;}
  }
  /* Two independent, source-proven masks confirm Merman; only a verified
     Cape mask is allowed for Cape. Never infer from visual armor/helmet. */
  const int merman=(mermanBody>=0 && mermanTail>=0);
  if(!merman&&cape<0)return -3;
  if(!merman && (mermanBody>=0 || mermanTail>=0))return -3;
  u32 enabled=0u;
  const u32 cp=index_for(27,17);
  if(cape>=0 && (gp[cp]>>24)==0u){
    u32 *ca=pixels(slots[cape]);
    const u32 source=ca[index_for(27,18)];
    if((ca[cp]>>24)!=0u || (source>>24)!=255u)return -7;
    /* When an unrelated later equipment layer already covers the target,
       the Cape is still repaired UNDER it at its own original layer depth. */
    enabled|=1u;
  }
  if(merman){
    const u32 q[4]={index_for(27,19),index_for(26,20),index_for(27,20),index_for(27,21)};
    const u32* m=pixels(slots[mermanBody]);
    const u32 black=m[index_for(28,19)];
    const u32 color=m[index_for(26,21)];
    if((black>>24)!=255u||(color>>24)!=255u)return -4;
    const u32 *dest=pixels(slots[mermanTail]);
    for(int i=0;i<4;++i){
      if((gp[q[i]]>>24)!=0u)continue;
      /* Each site was empty in the independently verified user reference.
         Protect any existing, selected native pixels in the destination. */
      if((dest[q[i]]>>24)!=0u)return -7;
      enabled|=2u;
    }
  }
  if(!enabled)return -6;
  /* Commit only after all validations succeed; don't mutate the firearm. */
  if(enabled&1u)pixels(slots[cape])[cp]=pixels(slots[cape])[index_for(27,18)];
  if(enabled&2u){
    u32 *dest=pixels(slots[mermanTail]);
    const u32 *m=pixels(slots[mermanBody]);
    const u32 q[4]={index_for(27,19),index_for(26,20),index_for(27,20),index_for(27,21)};
    const u32 vals[4]={m[index_for(28,19)],m[index_for(28,19)],m[index_for(26,21)],m[index_for(28,19)]};
    for(int i=0;i<4;++i)if((gp[q[i]]>>24)==0u)dest[q[i]]=vals[i];
  }
  return (enabled==3u)?8809:((enabled&2u)?8009:8001);
}
static inline int v88_guarded_source_fallback(int oldStatus,u32 *slots,u32 n,u32 *gp){
  if(oldStatus!=-3&&oldStatus!=-7)return oldStatus;
  const int newer=v88_source_layer_underlay(slots,n,gp);
  return newer>0?newer:oldStatus; /* maintain old fail-closed diagnostics */
}
'''
needle='__attribute__((export_name("phm_native_underlay")))'
assert src.count(needle)==1
src=src.replace(needle,source+'\n'+needle)
needle='if(weapon_hash!=BOLT_ALPHA_FNV) return cross_gun_underlay(slots,n,gp,weapon_hash);'
assert src.count(needle)==1
src=src.replace(needle,'if(weapon_hash!=BOLT_ALPHA_FNV) return v88_guarded_source_fallback(cross_gun_underlay(slots,n,gp,weapon_hash),slots,n,gp);')
needle='else return cross_gun_underlay(slots,n,gp,weapon_hash); /* original Bolt exact-match guard failed: try recolor */'
assert src.count(needle)==1
src=src.replace(needle,'else return v88_guarded_source_fallback(cross_gun_underlay(slots,n,gp,weapon_hash),slots,n,gp); /* v88 source evidence when whole-character guards skip */')
src=src.replace('v.87 experimental','v.88 experimental',1)
(R/'prototype/native_underlay_v88.c').write_text(src)
print('v88 Merman/Cape source-evidence fallback generated; v87 original helper branches preserved')
