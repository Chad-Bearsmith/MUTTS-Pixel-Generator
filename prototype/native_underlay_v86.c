/* MUTTS Pixel Generator v.86 experimental first-idle corrective underlay.
   This function replaces v85 helper 71935 in the game Wasm module and is called
   after the two original hand-color routines but BEFORE Unity's native final
   layer merge. It is restricted to exact v.81-accepted naked Human + Bolt first-idle
   references supplied by the user. Other states fail closed (no modifications).
   This is intentionally NOT a universal outfit/swatch solution.

   Verified in standalone tests: managed Color32[] = len at +12, data at +16;
   List<Color32[]> = count at +12, element pointers at +16.
   Actual Unity gameplay must independently establish these conditions.
 */
#include <stdint.h>
typedef uint32_t u32;
#define ATLAS_LENGTH (576 * 928)
#define SIDE 64
#define FNV_INIT ((u32)2166136261u)
#define FNV_PRIME ((u32)16777619u)
#define BOLT_ALPHA_FNV ((u32)0x3dbe5bbdu)
#define CAPE_FNV ((u32)0x851e5dc5u)
#define FIRE_LIZARD_FNV ((u32)0xc8432bdfu)
#define APACHE_FNV ((u32)0x94e70373u)
#define MAX_LAYERS 24
/* Atlas source Color32[] is bottom-up; the first idle tile is top-down
   (x in 0..63, y in 64..127) after visual inversion. */
static inline u32 index_for(int x, int y) { return (u32)((927 - (64 + y)) * 576 + x); }
static inline u32* pixels(u32 arr) { return (u32*)(uintptr_t)(arr + 16); }
static inline u32 length(u32 arr) { return *(u32*)(uintptr_t)(arr + 12); }
static inline u32 composite(u32* slots, u32 n, u32 p) {
    u32 out=0;
    for(u32 j=0; j<n; ++j){
        u32 c=pixels(slots[j])[p];
        if((c >> 24) != 0)out=c; /* Unity native last nonzero alpha wins */
    }
    return out;
}
static inline u32 hashbyte(u32 h, u32 v) {return (h ^ (v & 255u))*FNV_PRIME;}
static inline int clean_source(u32 color){return (color >> 24)==255u;}
/* Exported test signature (i32,i32,i32)->i32; ctx reserved for compatibility.
   Returns 1..12 if a patch was made, -1 invalid managed provenance,
   -2 non-Bolt alpha, -3 reference does not match, -4 source unavailable,
   -5 firearm overlaps a site. */

/* v83: non-Bolt-only guarded corrective underlay. The following mask is the
   union of all recognized Unity firearm alpha silhouettes (not a rectangle).
   It ensures a reference fingerprint is insensitive to the weapon art. */
static inline int occupied_by_any_gun(int x,int y){
  u32 lo=0u,hi=0u;
  lo|=((u32)-(int)(y==9)&0x1c000000u); hi|=((u32)-(int)(y==9)&0x00000000u);
  lo|=((u32)-(int)(y==10)&0x1c000000u); hi|=((u32)-(int)(y==10)&0x00000000u);
  lo|=((u32)-(int)(y==11)&0x1e000000u); hi|=((u32)-(int)(y==11)&0x00000000u);
  lo|=((u32)-(int)(y==12)&0x1c000000u); hi|=((u32)-(int)(y==12)&0x00000000u);
  lo|=((u32)-(int)(y==13)&0x3e000000u); hi|=((u32)-(int)(y==13)&0x00000000u);
  lo|=((u32)-(int)(y==14)&0xfc000000u); hi|=((u32)-(int)(y==14)&0x000005ffu);
  lo|=((u32)-(int)(y==15)&0xffc00000u); hi|=((u32)-(int)(y==15)&0x00006fffu);
  lo|=((u32)-(int)(y==16)&0xffc00000u); hi|=((u32)-(int)(y==16)&0x0003ffffu);
  lo|=((u32)-(int)(y==17)&0xffc00000u); hi|=((u32)-(int)(y==17)&0x000fffffu);
  lo|=((u32)-(int)(y==18)&0xffc00000u); hi|=((u32)-(int)(y==18)&0x000fffffu);
  lo|=((u32)-(int)(y==19)&0xffc00000u); hi|=((u32)-(int)(y==19)&0x0007ffffu);
  lo|=((u32)-(int)(y==20)&0xffc00000u); hi|=((u32)-(int)(y==20)&0x0001ffffu);
  lo|=((u32)-(int)(y==21)&0xff800000u); hi|=((u32)-(int)(y==21)&0x00003fffu);
  lo|=((u32)-(int)(y==22)&0xc1800000u); hi|=((u32)-(int)(y==22)&0x00007fffu);
  lo|=((u32)-(int)(y==23)&0x00000000u); hi|=((u32)-(int)(y==23)&0x00003ff8u);
  return (x<32)?((lo>>x)&1u):((hi>>(x-32))&1u);
}

__attribute__((always_inline)) static inline u32 under_character(u32* slots,u32 n,u32 p){
 u32 out=0;
 for(u32 i=0;i<n-1;++i){
  u32 c=pixels(slots[i])[p];
  if((c>>24)!=0u)out=c;
 }
 return out;
}

/* Swatch-aware fallback: structural appearance signature.  Never keyed to
   fixed item RGB values.  Exclude every known firearm silhouette pixel,
   then hash alpha + the equality of left/top adjacent *character* colors.
   Palette recolors preserve these boundaries when they preserve shade classes.
   Unsupported or ambiguous states fail closed. */
__attribute__((always_inline)) static inline u32 swatch_signature(u32* slots,u32 n,u32* relaxed){
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
}
/* Dracula's brighter red highlight is absent from the armed visible layer;
   reproduce the known palette shade relationship using current live color.
   This is experimental for non-default swatches and needs live validation. */
__attribute__((always_inline)) static inline u32 dracula_bright_from_dark(u32 dark){
 u32 r=dark&255u,g=(dark>>8)&255u,b=(dark>>16)&255u;
 u32 mx=r; if(g>mx)mx=g; if(b>mx)mx=b;
 u32 mn=r; if(g<mn)mn=g; if(b<mn)mn=b;
 u32 cr=r, cg=g, cb=b;
 /* Rank-preserving channel ratios; exact for original (196,36,48) => (234,50,60). */
 cr=(r==mx)?((r*234u+98u)/196u):((r==mn)?((r*50u+18u)/36u):((r*60u+24u)/48u));
 cg=(g==mx)?((g*234u+98u)/196u):((g==mn)?((g*50u+18u)/36u):((g*60u+24u)/48u));
 cb=(b==mx)?((b*234u+98u)/196u):((b==mn)?((b*50u+18u)/36u):((b*60u+24u)/48u));
 if(cr>255u)cr=255u; if(cg>255u)cg=255u; if(cb>255u)cb=255u;
 return 0xff000000u | (cb<<16) | (cg<<8) | cr;
}
__attribute__((always_inline)) static inline int swatch_underlay(u32* slots,u32 n,u32* gp,int gun_id){
 u32 relaxed=0u;
 u32 sig=swatch_signature(slots,n,&relaxed);
 int item=0;
 if(sig==0x2a6325e3u){ /* Cape vs Dracula: unarmed-side garment alpha */
   u32 a=under_character(slots,n,index_for(27,18))>>24;
   item=a?1:6;
 }
 if(sig==0x6778b015u)item=2; /* Fire Lizard */
 if(sig==0xf3289fecu){ /* Apache vs Alien: target outline alpha */
   u32 a=under_character(slots,n,index_for(27,17))>>24;
   item=a?3:4;
 }
 if(sig==0xd1d77612u)item=5; /* Angel Armor */
 if(sig==0xb7cf5b66u)item=7; /* Furry Body */
 if(sig==0xe77ead65u)item=8; /* Lizard Body */
 if(sig==0x92c317b0u)item=9; /* Merman Body */
 if(sig==0x95994762u)item=10; /* Werewolf Body */
 if(sig==0xe8f12230u)item=11; /* Hellsing Helmet */
 if(sig==0xdd34eeb4u)item=12; /* Snow Rider Helmet */
 if(!item){ /* narrow native-swatches fallback; never alter other items */
   if(relaxed==0x8c47b2b6u)item=7;
   else if(relaxed==0x31102402u)item=10;
 }
 if(!item)return -3; /* unknown structural appearance */
 int visible=0;
 /* Complete validation occurs BEFORE any layer is written. */
 if(item==1){ /* Cape */
  if((gp[index_for(27,17)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(27,17))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(27,19))>>24)!=255u)return -4;
  }
 }
 if(item==2){ /* Fire Lizard */
  if((gp[index_for(27,18)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(27,18))>>24)!=255u)return -7;
   if((under_character(slots,n,index_for(25,20))>>24)!=255u)return -4;
  }
  if((gp[index_for(26,19)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(26,19))>>24)!=255u)return -7;
   if((under_character(slots,n,index_for(25,20))>>24)!=255u)return -4;
  }
  if((gp[index_for(27,19)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(27,19))>>24)!=255u)return -7;
   if((under_character(slots,n,index_for(29,19))>>24)!=255u)return -4;
  }
  if((gp[index_for(26,20)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(26,20))>>24)!=255u)return -7;
   if((under_character(slots,n,index_for(29,19))>>24)!=255u)return -4;
  }
  if((gp[index_for(27,20)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(27,20))>>24)!=255u)return -7;
   if((under_character(slots,n,index_for(29,19))>>24)!=255u)return -4;
  }
 }
 if(item==3){ /* Apache Armor */
  if((gp[index_for(27,17)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(27,17))>>24)!=255u)return -7;
  }
 }
 if(item==4){ /* Alien Armor */
  if((gp[index_for(27,18)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(27,18))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(28,19))>>24)!=255u)return -4;
  }
  if((gp[index_for(27,19)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(27,19))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(26,19))>>24)!=255u)return -4;
  }
  if((gp[index_for(27,20)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(27,20))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(26,19))>>24)!=255u)return -4;
  }
  if((gp[index_for(27,21)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(27,21))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(28,19))>>24)!=255u)return -4;
  }
 }
 if(item==5){ /* Angel Armor */
  if((gp[index_for(27,17)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(27,17))>>24)!=255u)return -7;
   if((under_character(slots,n,index_for(25,19))>>24)!=255u)return -4;
  }
  if((gp[index_for(26,18)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(26,18))>>24)!=255u)return -7;
   if((under_character(slots,n,index_for(25,19))>>24)!=255u)return -4;
  }
  if((gp[index_for(27,18)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(27,18))>>24)!=255u)return -7;
   if((under_character(slots,n,index_for(25,19))>>24)!=255u)return -4;
  }
  if((gp[index_for(26,19)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(26,19))>>24)!=255u)return -7;
   if((under_character(slots,n,index_for(25,19))>>24)!=255u)return -4;
  }
  if((gp[index_for(27,19)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(27,19))>>24)!=255u)return -7;
   if((under_character(slots,n,index_for(25,19))>>24)!=255u)return -4;
  }
  if((gp[index_for(26,20)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(26,20))>>24)!=255u)return -7;
   if((under_character(slots,n,index_for(25,19))>>24)!=255u)return -4;
  }
  if((gp[index_for(27,20)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(27,20))>>24)!=255u)return -7;
   if((under_character(slots,n,index_for(25,19))>>24)!=255u)return -4;
  }
 }
 if(item==6){ /* Dracula Armor */
  if((gp[index_for(26,14)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(26,14))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(28,19))>>24)!=255u)return -4;
  }
  if((gp[index_for(37,14)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(37,14))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(28,19))>>24)!=255u)return -4;
  }
  if((gp[index_for(25,15)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(25,15))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(28,19))>>24)!=255u)return -4;
  }
  if((gp[index_for(26,15)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(26,15))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(27,22))>>24)!=255u)return -4;
  }
  if((gp[index_for(37,15)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(37,15))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(27,22))>>24)!=255u)return -4;
  }
  if((gp[index_for(38,15)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(38,15))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(28,19))>>24)!=255u)return -4;
  }
  if((gp[index_for(25,16)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(25,16))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(28,19))>>24)!=255u)return -4;
  }
  if((gp[index_for(26,16)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(26,16))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(27,22))>>24)!=255u)return -4;
  }
  if((gp[index_for(27,16)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(27,16))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(27,22))>>24)!=255u)return -4;
  }
  if((gp[index_for(37,16)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(37,16))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(27,22))>>24)!=255u)return -4;
  }
  if((gp[index_for(38,16)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(38,16))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(28,19))>>24)!=255u)return -4;
  }
  if((gp[index_for(27,17)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(27,17))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(28,19))>>24)!=255u)return -4;
  }
  if((gp[index_for(27,18)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(27,18))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(27,22))>>24)!=255u)return -4;
  }
  if((gp[index_for(27,19)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(27,19))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(27,22))>>24)!=255u)return -4;
  }
  if((gp[index_for(27,20)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(27,20))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(27,22))>>24)!=255u)return -4;
  }
  if((gp[index_for(27,21)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(27,21))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(27,22))>>24)!=255u)return -4;
  }
 }
 if(item==7){ /* Furry Body */
  if((gp[index_for(27,18)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(27,18))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(28,19))>>24)!=255u)return -4;
  }
  if((gp[index_for(26,19)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(26,19))>>24)!=255u)return -7;
   if((under_character(slots,n,index_for(25,19))>>24)!=255u)return -4;
  }
  if((gp[index_for(27,19)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(27,19))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(25,19))>>24)!=255u)return -4;
  }
  if((gp[index_for(27,20)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(27,20))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(28,19))>>24)!=255u)return -4;
  }
 }
 if(item==8){ /* Lizard Body */
  if((gp[index_for(27,18)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(27,18))>>24)!=255u)return -7;
   if((under_character(slots,n,index_for(25,20))>>24)!=255u)return -4;
  }
  if((gp[index_for(26,19)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(26,19))>>24)!=255u)return -7;
   if((under_character(slots,n,index_for(25,20))>>24)!=255u)return -4;
  }
  if((gp[index_for(27,19)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(27,19))>>24)!=255u)return -7;
   if((under_character(slots,n,index_for(29,19))>>24)!=255u)return -4;
  }
  if((gp[index_for(26,20)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(26,20))>>24)!=255u)return -7;
   if((under_character(slots,n,index_for(29,19))>>24)!=255u)return -4;
  }
  if((gp[index_for(27,20)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(27,20))>>24)!=255u)return -7;
   if((under_character(slots,n,index_for(29,19))>>24)!=255u)return -4;
  }
 }
 if(item==9){ /* Merman Body */
  if((gp[index_for(27,19)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(27,19))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(28,19))>>24)!=255u)return -4;
  }
  if((gp[index_for(26,20)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(26,20))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(28,19))>>24)!=255u)return -4;
  }
  if((gp[index_for(27,20)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(27,20))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(26,21))>>24)!=255u)return -4;
  }
  if((gp[index_for(27,21)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(27,21))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(28,19))>>24)!=255u)return -4;
  }
 }
 if(item==10){ /* Werewolf Body */
  if((gp[index_for(26,18)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(26,18))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(28,19))>>24)!=255u)return -4;
  }
  if((gp[index_for(27,18)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(27,18))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(28,19))>>24)!=255u)return -4;
  }
  if((gp[index_for(26,19)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(26,19))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(25,19))>>24)!=255u)return -4;
  }
  if((gp[index_for(27,19)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(27,19))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(25,19))>>24)!=255u)return -4;
  }
  if((gp[index_for(26,20)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(26,20))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(28,19))>>24)!=255u)return -4;
  }
  if((gp[index_for(27,20)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(27,20))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(28,19))>>24)!=255u)return -4;
  }
 }
 if(item==11){ /* Hellsing Helmet */
  if((gp[index_for(27,17)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(27,17))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(28,19))>>24)!=255u)return -4;
  }
 }
 if(item==12){ /* Snow Rider Helmet */
  if((gp[index_for(27,17)]>>24)==0u){
   visible++;
   if((under_character(slots,n,index_for(27,17))>>24)!=0u)return -7;
   if((under_character(slots,n,index_for(28,19))>>24)!=255u)return -4;
  }
 }
 if(!visible)return -6; /* weapon covers all corrections */
 if(item==1){ /* Cape */
  if((gp[index_for(27,17)]>>24)==0u){
   pixels(slots[n-2])[index_for(27,17)]=under_character(slots,n,index_for(27,19));
  }
 }
 if(item==2){ /* Fire Lizard */
  if((gp[index_for(27,18)]>>24)==0u){
   pixels(slots[n-2])[index_for(27,18)]=under_character(slots,n,index_for(25,20));
  }
  if((gp[index_for(26,19)]>>24)==0u){
   pixels(slots[n-2])[index_for(26,19)]=under_character(slots,n,index_for(25,20));
  }
  if((gp[index_for(27,19)]>>24)==0u){
   pixels(slots[n-2])[index_for(27,19)]=under_character(slots,n,index_for(29,19));
  }
  if((gp[index_for(26,20)]>>24)==0u){
   pixels(slots[n-2])[index_for(26,20)]=under_character(slots,n,index_for(29,19));
  }
  if((gp[index_for(27,20)]>>24)==0u){
   pixels(slots[n-2])[index_for(27,20)]=under_character(slots,n,index_for(29,19));
  }
 }
 if(item==3){ /* Apache Armor */
  if((gp[index_for(27,17)]>>24)==0u){
   for(u32 j=0;j<n-1;++j)pixels(slots[j])[index_for(27,17)]=0u;
  }
 }
 if(item==4){ /* Alien Armor */
  if((gp[index_for(27,18)]>>24)==0u){
   pixels(slots[n-2])[index_for(27,18)]=under_character(slots,n,index_for(28,19));
  }
  if((gp[index_for(27,19)]>>24)==0u){
   pixels(slots[n-2])[index_for(27,19)]=under_character(slots,n,index_for(26,19));
  }
  if((gp[index_for(27,20)]>>24)==0u){
   pixels(slots[n-2])[index_for(27,20)]=under_character(slots,n,index_for(26,19));
  }
  if((gp[index_for(27,21)]>>24)==0u){
   pixels(slots[n-2])[index_for(27,21)]=under_character(slots,n,index_for(28,19));
  }
 }
 if(item==5){ /* Angel Armor */
  if((gp[index_for(27,17)]>>24)==0u){
   pixels(slots[n-2])[index_for(27,17)]=under_character(slots,n,index_for(25,19));
  }
  if((gp[index_for(26,18)]>>24)==0u){
   pixels(slots[n-2])[index_for(26,18)]=under_character(slots,n,index_for(25,19));
  }
  if((gp[index_for(27,18)]>>24)==0u){
   pixels(slots[n-2])[index_for(27,18)]=under_character(slots,n,index_for(25,19));
  }
  if((gp[index_for(26,19)]>>24)==0u){
   pixels(slots[n-2])[index_for(26,19)]=under_character(slots,n,index_for(25,19));
  }
  if((gp[index_for(27,19)]>>24)==0u){
   pixels(slots[n-2])[index_for(27,19)]=under_character(slots,n,index_for(25,19));
  }
  if((gp[index_for(26,20)]>>24)==0u){
   pixels(slots[n-2])[index_for(26,20)]=under_character(slots,n,index_for(25,19));
  }
  if((gp[index_for(27,20)]>>24)==0u){
   pixels(slots[n-2])[index_for(27,20)]=under_character(slots,n,index_for(25,19));
  }
 }
 if(item==6){ /* Dracula Armor */
  if((gp[index_for(26,14)]>>24)==0u){
   pixels(slots[n-2])[index_for(26,14)]=under_character(slots,n,index_for(28,19));
  }
  if((gp[index_for(37,14)]>>24)==0u){
   pixels(slots[n-2])[index_for(37,14)]=under_character(slots,n,index_for(28,19));
  }
  if((gp[index_for(25,15)]>>24)==0u){
   pixels(slots[n-2])[index_for(25,15)]=under_character(slots,n,index_for(28,19));
  }
  if((gp[index_for(26,15)]>>24)==0u){
   pixels(slots[n-2])[index_for(26,15)]=dracula_bright_from_dark(under_character(slots,n,index_for(27,22)));
  }
  if((gp[index_for(37,15)]>>24)==0u){
   pixels(slots[n-2])[index_for(37,15)]=under_character(slots,n,index_for(27,22));
  }
  if((gp[index_for(38,15)]>>24)==0u){
   pixels(slots[n-2])[index_for(38,15)]=under_character(slots,n,index_for(28,19));
  }
  if((gp[index_for(25,16)]>>24)==0u){
   pixels(slots[n-2])[index_for(25,16)]=under_character(slots,n,index_for(28,19));
  }
  if((gp[index_for(26,16)]>>24)==0u){
   pixels(slots[n-2])[index_for(26,16)]=under_character(slots,n,index_for(27,22));
  }
  if((gp[index_for(27,16)]>>24)==0u){
   pixels(slots[n-2])[index_for(27,16)]=under_character(slots,n,index_for(27,22));
  }
  if((gp[index_for(37,16)]>>24)==0u){
   pixels(slots[n-2])[index_for(37,16)]=under_character(slots,n,index_for(27,22));
  }
  if((gp[index_for(38,16)]>>24)==0u){
   pixels(slots[n-2])[index_for(38,16)]=under_character(slots,n,index_for(28,19));
  }
  if((gp[index_for(27,17)]>>24)==0u){
   pixels(slots[n-2])[index_for(27,17)]=under_character(slots,n,index_for(28,19));
  }
  if((gp[index_for(27,18)]>>24)==0u){
   pixels(slots[n-2])[index_for(27,18)]=under_character(slots,n,index_for(27,22));
  }
  if((gp[index_for(27,19)]>>24)==0u){
   pixels(slots[n-2])[index_for(27,19)]=under_character(slots,n,index_for(27,22));
  }
  if((gp[index_for(27,20)]>>24)==0u){
   pixels(slots[n-2])[index_for(27,20)]=under_character(slots,n,index_for(27,22));
  }
  if((gp[index_for(27,21)]>>24)==0u){
   pixels(slots[n-2])[index_for(27,21)]=under_character(slots,n,index_for(27,22));
  }
 }
 if(item==7){ /* Furry Body */
  if((gp[index_for(27,18)]>>24)==0u){
   pixels(slots[n-2])[index_for(27,18)]=under_character(slots,n,index_for(28,19));
  }
  if((gp[index_for(26,19)]>>24)==0u){
   pixels(slots[n-2])[index_for(26,19)]=under_character(slots,n,index_for(25,19));
  }
  if((gp[index_for(27,19)]>>24)==0u){
   pixels(slots[n-2])[index_for(27,19)]=under_character(slots,n,index_for(25,19));
  }
  if((gp[index_for(27,20)]>>24)==0u){
   pixels(slots[n-2])[index_for(27,20)]=under_character(slots,n,index_for(28,19));
  }
 }
 if(item==8){ /* Lizard Body */
  if((gp[index_for(27,18)]>>24)==0u){
   pixels(slots[n-2])[index_for(27,18)]=under_character(slots,n,index_for(25,20));
  }
  if((gp[index_for(26,19)]>>24)==0u){
   pixels(slots[n-2])[index_for(26,19)]=under_character(slots,n,index_for(25,20));
  }
  if((gp[index_for(27,19)]>>24)==0u){
   pixels(slots[n-2])[index_for(27,19)]=under_character(slots,n,index_for(29,19));
  }
  if((gp[index_for(26,20)]>>24)==0u){
   pixels(slots[n-2])[index_for(26,20)]=under_character(slots,n,index_for(29,19));
  }
  if((gp[index_for(27,20)]>>24)==0u){
   pixels(slots[n-2])[index_for(27,20)]=under_character(slots,n,index_for(29,19));
  }
 }
 if(item==9){ /* Merman Body */
  if((gp[index_for(27,19)]>>24)==0u){
   pixels(slots[n-2])[index_for(27,19)]=under_character(slots,n,index_for(28,19));
  }
  if((gp[index_for(26,20)]>>24)==0u){
   pixels(slots[n-2])[index_for(26,20)]=under_character(slots,n,index_for(28,19));
  }
  if((gp[index_for(27,20)]>>24)==0u){
   pixels(slots[n-2])[index_for(27,20)]=under_character(slots,n,index_for(26,21));
  }
  if((gp[index_for(27,21)]>>24)==0u){
   pixels(slots[n-2])[index_for(27,21)]=under_character(slots,n,index_for(28,19));
  }
 }
 if(item==10){ /* Werewolf Body */
  if((gp[index_for(26,18)]>>24)==0u){
   pixels(slots[n-2])[index_for(26,18)]=under_character(slots,n,index_for(28,19));
  }
  if((gp[index_for(27,18)]>>24)==0u){
   pixels(slots[n-2])[index_for(27,18)]=under_character(slots,n,index_for(28,19));
  }
  if((gp[index_for(26,19)]>>24)==0u){
   pixels(slots[n-2])[index_for(26,19)]=under_character(slots,n,index_for(25,19));
  }
  if((gp[index_for(27,19)]>>24)==0u){
   pixels(slots[n-2])[index_for(27,19)]=under_character(slots,n,index_for(25,19));
  }
  if((gp[index_for(26,20)]>>24)==0u){
   pixels(slots[n-2])[index_for(26,20)]=under_character(slots,n,index_for(28,19));
  }
  if((gp[index_for(27,20)]>>24)==0u){
   pixels(slots[n-2])[index_for(27,20)]=under_character(slots,n,index_for(28,19));
  }
 }
 if(item==11){ /* Hellsing Helmet */
  if((gp[index_for(27,17)]>>24)==0u){
   pixels(slots[n-2])[index_for(27,17)]=under_character(slots,n,index_for(28,19));
  }
 }
 if(item==12){ /* Snow Rider Helmet */
  if((gp[index_for(27,17)]>>24)==0u){
   pixels(slots[n-2])[index_for(27,17)]=under_character(slots,n,index_for(28,19));
  }
 }
 return 5000+gun_id*100+item; /* swatch-aware path, distinct diagnostic status */
}

__attribute__((always_inline)) static inline int cross_gun_underlay(u32* slots,u32 n,u32* gp,u32 alpha_hash){
 int gun_id=0;
  if(alpha_hash==0xb739dd6bu)gun_id=1;
  if(alpha_hash==0xb53b9051u)gun_id=2;
  if(alpha_hash==0xbb38ddadu)gun_id=3;
  if(alpha_hash==0x6482d900u)gun_id=4;
  if(alpha_hash==0x34316c13u)gun_id=5;
  if(alpha_hash==0x65ebb6c2u)gun_id=6;
  if(alpha_hash==0xeac21292u)gun_id=7;
  if(alpha_hash==0xb92bc587u)gun_id=8;
  if(alpha_hash==0xb0995dc5u)gun_id=9;
  if(alpha_hash==0x0b9ac9b1u)gun_id=10;
  if(alpha_hash==0x1e1f366cu)gun_id=11;
  if(alpha_hash==0x5fe65d47u)gun_id=12;
  if(alpha_hash==0x3ac28527u)gun_id=13;
  if(alpha_hash==0x894c19cbu)gun_id=14;
  if(alpha_hash==0x58f03ba8u)gun_id=15;
  if(alpha_hash==0x026236c2u)gun_id=16;
  if(alpha_hash==0x55389cbcu)gun_id=17;
  if(alpha_hash==0xd19e7a37u)gun_id=18;
  if(alpha_hash==0x8b4dc278u)gun_id=19;
  if(alpha_hash==0x4d812c43u)gun_id=20;
  if(alpha_hash==0x3f01d93bu)gun_id=21;
  if(alpha_hash==0x379133d2u)gun_id=22;
  /* v84: exact Unity sharedassets0 masks missing from the v83 resource registry. */
  if(alpha_hash==0x0175df7au)gun_id=23; /* Crossbow, Unity source name begins U+0421 */
  if(alpha_hash==0xcc087534u)gun_id=19; /* Shotgun: marked alpha254/252 source variant */
  if(!gun_id && alpha_hash!=BOLT_ALPHA_FNV)return -2; /* unsupported firearm */
  u32 whole=FNV_INIT;
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
  if(whole==0x7568b169u)item=1;
  if(whole==0xf7089d45u)item=2;
  if(whole==0x655fbde3u)item=3;
  if(whole==0xfc956592u)item=4;
  if(whole==0x340b9821u)item=5;
  if(whole==0x6f09e08du)item=6;
  if(whole==0xf8305558u)item=7;
  if(whole==0x1cbe3b53u)item=8;
  if(whole==0x7e1ff16fu)item=9;
  if(whole==0x0a7c4a11u)item=10;
  if(whole==0x5f745573u)item=11;
  if(whole==0x01d2a664u)item=12;
  if(!item)goto palette_fallback; /* guarded color-change fallback */
  /* Prevalidate all visible corrections and their color samples BEFORE
     writing any managed array, ensuring a failed case cannot partially edit. */
  int visible=0;
  if(item==1){ /* Cape */
    if((gp[index_for(27,17)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(27,17))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(27,19))!=0xff3c32eau)goto palette_fallback;
    }
  }
  if(item==2){ /* Fire Lizard */
    if((gp[index_for(27,18)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(27,18))!=0xff2445c6u)goto palette_fallback;
      if(under_character(slots,n,index_for(25,20))!=0xff25c8ffu)goto palette_fallback;
    }
    if((gp[index_for(26,19)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(26,19))!=0xff000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(25,20))!=0xff25c8ffu)goto palette_fallback;
    }
    if((gp[index_for(27,19)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(27,19))!=0xff25c8ffu)goto palette_fallback;
      if(under_character(slots,n,index_for(29,19))!=0xff1476edu)goto palette_fallback;
    }
    if((gp[index_for(26,20)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(26,20))!=0xff000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(29,19))!=0xff1476edu)goto palette_fallback;
    }
    if((gp[index_for(27,20)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(27,20))!=0xff25c8ffu)goto palette_fallback;
      if(under_character(slots,n,index_for(29,19))!=0xff1476edu)goto palette_fallback;
    }
  }
  if(item==3){ /* Apache Armor */
    if((gp[index_for(27,17)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(27,17))!=0xff000000u)goto palette_fallback;
    }
  }
  if(item==4){ /* Alien Armor */
    if((gp[index_for(27,18)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(27,18))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(28,19))!=0xff000000u)goto palette_fallback;
    }
    if((gp[index_for(27,19)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(27,19))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(26,19))!=0xff4e2f2au)goto palette_fallback;
    }
    if((gp[index_for(27,20)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(27,20))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(26,19))!=0xff4e2f2au)goto palette_fallback;
    }
    if((gp[index_for(27,21)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(27,21))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(28,19))!=0xff000000u)goto palette_fallback;
    }
  }
  if(item==5){ /* Angel Armor */
    if((gp[index_for(27,17)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(27,17))!=0xff000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(25,19))!=0xffb9a192u)goto palette_fallback;
    }
    if((gp[index_for(26,18)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(26,18))!=0xff000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(25,19))!=0xffb9a192u)goto palette_fallback;
    }
    if((gp[index_for(27,18)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(27,18))!=0xffddcfc7u)goto palette_fallback;
      if(under_character(slots,n,index_for(25,19))!=0xffb9a192u)goto palette_fallback;
    }
    if((gp[index_for(26,19)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(26,19))!=0xff000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(25,19))!=0xffb9a192u)goto palette_fallback;
    }
    if((gp[index_for(27,19)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(27,19))!=0xff9fcaf6u)goto palette_fallback;
      if(under_character(slots,n,index_for(25,19))!=0xffb9a192u)goto palette_fallback;
    }
    if((gp[index_for(26,20)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(26,20))!=0xff000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(25,19))!=0xffb9a192u)goto palette_fallback;
    }
    if((gp[index_for(27,20)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(27,20))!=0xff9fcaf6u)goto palette_fallback;
      if(under_character(slots,n,index_for(25,19))!=0xffb9a192u)goto palette_fallback;
    }
  }
  if(item==6){ /* Dracula Armor */
    if((gp[index_for(26,14)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(26,14))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(28,19))!=0xff000000u)goto palette_fallback;
    }
    if((gp[index_for(37,14)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(37,14))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(28,19))!=0xff000000u)goto palette_fallback;
    }
    if((gp[index_for(25,15)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(25,15))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(28,19))!=0xff000000u)goto palette_fallback;
    }
    if((gp[index_for(26,15)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(26,15))!=0x00000000u)goto palette_fallback;
    }
    if((gp[index_for(37,15)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(37,15))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(27,22))!=0xff3024c4u)goto palette_fallback;
    }
    if((gp[index_for(38,15)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(38,15))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(28,19))!=0xff000000u)goto palette_fallback;
    }
    if((gp[index_for(25,16)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(25,16))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(28,19))!=0xff000000u)goto palette_fallback;
    }
    if((gp[index_for(26,16)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(26,16))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(27,22))!=0xff3024c4u)goto palette_fallback;
    }
    if((gp[index_for(27,16)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(27,16))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(27,22))!=0xff3024c4u)goto palette_fallback;
    }
    if((gp[index_for(37,16)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(37,16))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(27,22))!=0xff3024c4u)goto palette_fallback;
    }
    if((gp[index_for(38,16)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(38,16))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(28,19))!=0xff000000u)goto palette_fallback;
    }
    if((gp[index_for(27,17)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(27,17))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(28,19))!=0xff000000u)goto palette_fallback;
    }
    if((gp[index_for(27,18)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(27,18))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(27,22))!=0xff3024c4u)goto palette_fallback;
    }
    if((gp[index_for(27,19)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(27,19))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(27,22))!=0xff3024c4u)goto palette_fallback;
    }
    if((gp[index_for(27,20)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(27,20))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(27,22))!=0xff3024c4u)goto palette_fallback;
    }
    if((gp[index_for(27,21)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(27,21))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(27,22))!=0xff3024c4u)goto palette_fallback;
    }
  }
  if(item==7){ /* Furry Body */
    if((gp[index_for(27,18)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(27,18))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(28,19))!=0xff000000u)goto palette_fallback;
    }
    if((gp[index_for(26,19)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(26,19))!=0xff000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(25,19))!=0xff6e4c42u)goto palette_fallback;
    }
    if((gp[index_for(27,19)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(27,19))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(25,19))!=0xff6e4c42u)goto palette_fallback;
    }
    if((gp[index_for(27,20)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(27,20))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(28,19))!=0xff000000u)goto palette_fallback;
    }
  }
  if(item==8){ /* Lizard Body */
    if((gp[index_for(27,18)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(27,18))!=0xff4c4c13u)goto palette_fallback;
      if(under_character(slots,n,index_for(25,20))!=0xff4b9833u)goto palette_fallback;
    }
    if((gp[index_for(26,19)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(26,19))!=0xff000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(25,20))!=0xff4b9833u)goto palette_fallback;
    }
    if((gp[index_for(27,19)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(27,19))!=0xff4b9833u)goto palette_fallback;
      if(under_character(slots,n,index_for(29,19))!=0xff506f1eu)goto palette_fallback;
    }
    if((gp[index_for(26,20)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(26,20))!=0xff000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(29,19))!=0xff506f1eu)goto palette_fallback;
    }
    if((gp[index_for(27,20)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(27,20))!=0xff4b9833u)goto palette_fallback;
      if(under_character(slots,n,index_for(29,19))!=0xff506f1eu)goto palette_fallback;
    }
  }
  if(item==9){ /* Merman Body */
    if((gp[index_for(27,19)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(27,19))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(28,19))!=0xff000000u)goto palette_fallback;
    }
    if((gp[index_for(26,20)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(26,20))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(28,19))!=0xff000000u)goto palette_fallback;
    }
    if((gp[index_for(27,20)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(27,20))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(26,21))!=0xffdc9800u)goto palette_fallback;
    }
    if((gp[index_for(27,21)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(27,21))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(28,19))!=0xff000000u)goto palette_fallback;
    }
  }
  if(item==10){ /* Werewolf Body */
    if((gp[index_for(26,18)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(26,18))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(28,19))!=0xff000000u)goto palette_fallback;
    }
    if((gp[index_for(27,18)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(27,18))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(28,19))!=0xff000000u)goto palette_fallback;
    }
    if((gp[index_for(26,19)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(26,19))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(25,19))!=0xff6e4c42u)goto palette_fallback;
    }
    if((gp[index_for(27,19)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(27,19))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(25,19))!=0xff6e4c42u)goto palette_fallback;
    }
    if((gp[index_for(26,20)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(26,20))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(28,19))!=0xff000000u)goto palette_fallback;
    }
    if((gp[index_for(27,20)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(27,20))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(28,19))!=0xff000000u)goto palette_fallback;
    }
  }
  if(item==11){ /* Hellsing Helmet */
    if((gp[index_for(27,17)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(27,17))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(28,19))!=0xff000000u)goto palette_fallback;
    }
  }
  if(item==12){ /* Snow Rider Helmet */
    if((gp[index_for(27,17)]>>24)==0u){
      visible++;
      if(under_character(slots,n,index_for(27,17))!=0x00000000u)goto palette_fallback;
      if(under_character(slots,n,index_for(28,19))!=0xff000000u)goto palette_fallback;
    }
  }
  if(!visible)return -6; /* all correction sites hidden by firearm */
  if(item==1){
    if((gp[index_for(27,17)]>>24)==0u){
      pixels(slots[n-2])[index_for(27,17)]=under_character(slots,n,index_for(27,19));
    }
  }
  if(item==2){
    if((gp[index_for(27,18)]>>24)==0u){
      pixels(slots[n-2])[index_for(27,18)]=under_character(slots,n,index_for(25,20));
    }
    if((gp[index_for(26,19)]>>24)==0u){
      pixels(slots[n-2])[index_for(26,19)]=under_character(slots,n,index_for(25,20));
    }
    if((gp[index_for(27,19)]>>24)==0u){
      pixels(slots[n-2])[index_for(27,19)]=under_character(slots,n,index_for(29,19));
    }
    if((gp[index_for(26,20)]>>24)==0u){
      pixels(slots[n-2])[index_for(26,20)]=under_character(slots,n,index_for(29,19));
    }
    if((gp[index_for(27,20)]>>24)==0u){
      pixels(slots[n-2])[index_for(27,20)]=under_character(slots,n,index_for(29,19));
    }
  }
  if(item==3){
    if((gp[index_for(27,17)]>>24)==0u){
      for(u32 j=0;j<n-1;++j)pixels(slots[j])[index_for(27,17)]=0u;
    }
  }
  if(item==4){
    if((gp[index_for(27,18)]>>24)==0u){
      pixels(slots[n-2])[index_for(27,18)]=under_character(slots,n,index_for(28,19));
    }
    if((gp[index_for(27,19)]>>24)==0u){
      pixels(slots[n-2])[index_for(27,19)]=under_character(slots,n,index_for(26,19));
    }
    if((gp[index_for(27,20)]>>24)==0u){
      pixels(slots[n-2])[index_for(27,20)]=under_character(slots,n,index_for(26,19));
    }
    if((gp[index_for(27,21)]>>24)==0u){
      pixels(slots[n-2])[index_for(27,21)]=under_character(slots,n,index_for(28,19));
    }
  }
  if(item==5){
    if((gp[index_for(27,17)]>>24)==0u){
      pixels(slots[n-2])[index_for(27,17)]=under_character(slots,n,index_for(25,19));
    }
    if((gp[index_for(26,18)]>>24)==0u){
      pixels(slots[n-2])[index_for(26,18)]=under_character(slots,n,index_for(25,19));
    }
    if((gp[index_for(27,18)]>>24)==0u){
      pixels(slots[n-2])[index_for(27,18)]=under_character(slots,n,index_for(25,19));
    }
    if((gp[index_for(26,19)]>>24)==0u){
      pixels(slots[n-2])[index_for(26,19)]=under_character(slots,n,index_for(25,19));
    }
    if((gp[index_for(27,19)]>>24)==0u){
      pixels(slots[n-2])[index_for(27,19)]=under_character(slots,n,index_for(25,19));
    }
    if((gp[index_for(26,20)]>>24)==0u){
      pixels(slots[n-2])[index_for(26,20)]=under_character(slots,n,index_for(25,19));
    }
    if((gp[index_for(27,20)]>>24)==0u){
      pixels(slots[n-2])[index_for(27,20)]=under_character(slots,n,index_for(25,19));
    }
  }
  if(item==6){
    if((gp[index_for(26,14)]>>24)==0u){
      pixels(slots[n-2])[index_for(26,14)]=under_character(slots,n,index_for(28,19));
    }
    if((gp[index_for(37,14)]>>24)==0u){
      pixels(slots[n-2])[index_for(37,14)]=under_character(slots,n,index_for(28,19));
    }
    if((gp[index_for(25,15)]>>24)==0u){
      pixels(slots[n-2])[index_for(25,15)]=under_character(slots,n,index_for(28,19));
    }
    if((gp[index_for(26,15)]>>24)==0u){
      pixels(slots[n-2])[index_for(26,15)]=0xff3c32eau;
    }
    if((gp[index_for(37,15)]>>24)==0u){
      pixels(slots[n-2])[index_for(37,15)]=under_character(slots,n,index_for(27,22));
    }
    if((gp[index_for(38,15)]>>24)==0u){
      pixels(slots[n-2])[index_for(38,15)]=under_character(slots,n,index_for(28,19));
    }
    if((gp[index_for(25,16)]>>24)==0u){
      pixels(slots[n-2])[index_for(25,16)]=under_character(slots,n,index_for(28,19));
    }
    if((gp[index_for(26,16)]>>24)==0u){
      pixels(slots[n-2])[index_for(26,16)]=under_character(slots,n,index_for(27,22));
    }
    if((gp[index_for(27,16)]>>24)==0u){
      pixels(slots[n-2])[index_for(27,16)]=under_character(slots,n,index_for(27,22));
    }
    if((gp[index_for(37,16)]>>24)==0u){
      pixels(slots[n-2])[index_for(37,16)]=under_character(slots,n,index_for(27,22));
    }
    if((gp[index_for(38,16)]>>24)==0u){
      pixels(slots[n-2])[index_for(38,16)]=under_character(slots,n,index_for(28,19));
    }
    if((gp[index_for(27,17)]>>24)==0u){
      pixels(slots[n-2])[index_for(27,17)]=under_character(slots,n,index_for(28,19));
    }
    if((gp[index_for(27,18)]>>24)==0u){
      pixels(slots[n-2])[index_for(27,18)]=under_character(slots,n,index_for(27,22));
    }
    if((gp[index_for(27,19)]>>24)==0u){
      pixels(slots[n-2])[index_for(27,19)]=under_character(slots,n,index_for(27,22));
    }
    if((gp[index_for(27,20)]>>24)==0u){
      pixels(slots[n-2])[index_for(27,20)]=under_character(slots,n,index_for(27,22));
    }
    if((gp[index_for(27,21)]>>24)==0u){
      pixels(slots[n-2])[index_for(27,21)]=under_character(slots,n,index_for(27,22));
    }
  }
  if(item==7){
    if((gp[index_for(27,18)]>>24)==0u){
      pixels(slots[n-2])[index_for(27,18)]=under_character(slots,n,index_for(28,19));
    }
    if((gp[index_for(26,19)]>>24)==0u){
      pixels(slots[n-2])[index_for(26,19)]=under_character(slots,n,index_for(25,19));
    }
    if((gp[index_for(27,19)]>>24)==0u){
      pixels(slots[n-2])[index_for(27,19)]=under_character(slots,n,index_for(25,19));
    }
    if((gp[index_for(27,20)]>>24)==0u){
      pixels(slots[n-2])[index_for(27,20)]=under_character(slots,n,index_for(28,19));
    }
  }
  if(item==8){
    if((gp[index_for(27,18)]>>24)==0u){
      pixels(slots[n-2])[index_for(27,18)]=under_character(slots,n,index_for(25,20));
    }
    if((gp[index_for(26,19)]>>24)==0u){
      pixels(slots[n-2])[index_for(26,19)]=under_character(slots,n,index_for(25,20));
    }
    if((gp[index_for(27,19)]>>24)==0u){
      pixels(slots[n-2])[index_for(27,19)]=under_character(slots,n,index_for(29,19));
    }
    if((gp[index_for(26,20)]>>24)==0u){
      pixels(slots[n-2])[index_for(26,20)]=under_character(slots,n,index_for(29,19));
    }
    if((gp[index_for(27,20)]>>24)==0u){
      pixels(slots[n-2])[index_for(27,20)]=under_character(slots,n,index_for(29,19));
    }
  }
  if(item==9){
    if((gp[index_for(27,19)]>>24)==0u){
      pixels(slots[n-2])[index_for(27,19)]=under_character(slots,n,index_for(28,19));
    }
    if((gp[index_for(26,20)]>>24)==0u){
      pixels(slots[n-2])[index_for(26,20)]=under_character(slots,n,index_for(28,19));
    }
    if((gp[index_for(27,20)]>>24)==0u){
      pixels(slots[n-2])[index_for(27,20)]=under_character(slots,n,index_for(26,21));
    }
    if((gp[index_for(27,21)]>>24)==0u){
      pixels(slots[n-2])[index_for(27,21)]=under_character(slots,n,index_for(28,19));
    }
  }
  if(item==10){
    if((gp[index_for(26,18)]>>24)==0u){
      pixels(slots[n-2])[index_for(26,18)]=under_character(slots,n,index_for(28,19));
    }
    if((gp[index_for(27,18)]>>24)==0u){
      pixels(slots[n-2])[index_for(27,18)]=under_character(slots,n,index_for(28,19));
    }
    if((gp[index_for(26,19)]>>24)==0u){
      pixels(slots[n-2])[index_for(26,19)]=under_character(slots,n,index_for(25,19));
    }
    if((gp[index_for(27,19)]>>24)==0u){
      pixels(slots[n-2])[index_for(27,19)]=under_character(slots,n,index_for(25,19));
    }
    if((gp[index_for(26,20)]>>24)==0u){
      pixels(slots[n-2])[index_for(26,20)]=under_character(slots,n,index_for(28,19));
    }
    if((gp[index_for(27,20)]>>24)==0u){
      pixels(slots[n-2])[index_for(27,20)]=under_character(slots,n,index_for(28,19));
    }
  }
  if(item==11){
    if((gp[index_for(27,17)]>>24)==0u){
      pixels(slots[n-2])[index_for(27,17)]=under_character(slots,n,index_for(28,19));
    }
  }
  if(item==12){
    if((gp[index_for(27,17)]>>24)==0u){
      pixels(slots[n-2])[index_for(27,17)]=under_character(slots,n,index_for(28,19));
    }
  }
  return gun_id*100+item; /* original v84 exact path */
palette_fallback:
  return swatch_underlay(slots,n,gp,gun_id);
}

__attribute__((export_name("phm_native_underlay")))
int phm_native_underlay(u32 list, u32 gun, u32 ctx) {
    (void)ctx;
    if (!list || !gun || gun < 0x10000u || list < 0x10000u) return -1;
    const u32 n=*(u32*)(uintptr_t)(list+12);
    if(n<2 || n>MAX_LAYERS || length(gun)!=ATLAS_LENGTH) return -1;
    u32* const slots=(u32*)(uintptr_t)(list+16);
    if(slots[n-1]!=gun) return -1;
    for(u32 j=0;j<n-1;++j)
      if(slots[j]<0x10000u || length(slots[j])!=ATLAS_LENGTH) return -1;
    u32* const gp=pixels(gun);
    u32 weapon_hash=FNV_INIT;
    for(int y=0;y<SIDE;++y)for(int x=0;x<SIDE;++x)
      weapon_hash=hashbyte(weapon_hash,gp[index_for(x,y)]>>24);
    if(weapon_hash!=BOLT_ALPHA_FNV) return cross_gun_underlay(slots,n,gp,weapon_hash);
    u32 whole=FNV_INIT;
    for(int y=0;y<SIDE;++y)for(int x=0;x<SIDE;++x){
      u32 p=index_for(x,y);
      u32 c=composite(slots,n,p),a=c>>24;
      /* Ignore palette-adjusted firearm hand-marker RGB and any alpha-254
         roundtrip differences in the user's cropped 20x PNG references. */
      if((gp[p]>>24)==254u)c=0xff000000u;
      else if(a==0)c=0;
      else c=(c&0x00ffffffu)|0xff000000u;
      whole=hashbyte(whole,c);
      whole=hashbyte(whole,c>>8);
      whole=hashbyte(whole,c>>16);
      whole=hashbyte(whole,c>>24);
    }
    int which=0;
    if(whole==CAPE_FNV)which=1;
    else if(whole==FIRE_LIZARD_FNV)which=2;
    else if(whole==APACHE_FNV)which=3;
    else if(whole==((u32)0xbeb27f6fu))which=4;
    else if(whole==((u32)0x72c71606u))which=5;
    else if(whole==((u32)0x87984b59u))which=6;
    else if(whole==((u32)0xb4374504u))which=7;
    else if(whole==((u32)0xee7e1b5eu))which=8;
    else if(whole==((u32)0xf4a022b7u))which=9;
    else if(whole==((u32)0x0b9614d2u))which=10;
    else if(whole==((u32)0x11f93f66u))which=11;
    else if(whole==((u32)0x1c971062u))which=12;
    else return cross_gun_underlay(slots,n,gp,weapon_hash); /* original Bolt exact-match guard failed: try recolor */
    /* Guard ALL modified target sites using the LIVE selected firearm buffer.
       Prevalidate every source and target BEFORE modifying any layer. */
    const u32 p0=index_for(27,17),p1=index_for(27,18),p2=index_for(26,19),
        p3=index_for(27,19),p4=index_for(26,20),p5=index_for(27,20);
    if(which==1){
       if((gp[p0]>>24)!=0) return -5;
       u32 v=composite(slots,n,index_for(27,18));
       if(!clean_source(v))return -4;
       pixels(slots[n-2])[p0]=v;
    } else if(which==2){
       if((gp[p1]>>24)!=0||(gp[p2]>>24)!=0||(gp[p3]>>24)!=0||
          (gp[p4]>>24)!=0||(gp[p5]>>24)!=0) return -5;
       const u32 s1=composite(slots,n,index_for(25,20));
       const u32 s2=composite(slots,n,index_for(29,19));
       const u32 s3=composite(slots,n,index_for(26,21));
       if(!clean_source(s1)||!clean_source(s2)||!clean_source(s3))return -4;
       u32* dst=pixels(slots[n-2]);
       dst[p1]=s1;dst[p2]=s1;dst[p3]=s2;dst[p4]=s3;dst[p5]=s3;
    } else if(which==3){
       if((gp[p0]>>24)!=0) return -5;
       for(u32 j=0;j<n-1;++j)pixels(slots[j])[p0]=0;
    } else if(which==4){ /* Alien Armor */
       if(((gp[index_for(27,18)]>>24)!=0) || ((gp[index_for(27,19)]>>24)!=0) || ((gp[index_for(27,20)]>>24)!=0) || ((gp[index_for(27,21)]>>24)!=0)) return -5;
       const u32 v0=composite(slots,n,index_for(28,19));
       if(!clean_source(v0))return -4;
       const u32 v1=composite(slots,n,index_for(26,19));
       if(!clean_source(v1))return -4;
       u32* dst=pixels(slots[n-2]);
       dst[index_for(27,18)]=v0;
       dst[index_for(27,19)]=v1;
       dst[index_for(27,20)]=v1;
       dst[index_for(27,21)]=v0;
    } else if(which==5){ /* Angel Armor */
       if(((gp[index_for(27,17)]>>24)!=0) || ((gp[index_for(26,18)]>>24)!=0) || ((gp[index_for(27,18)]>>24)!=0) || ((gp[index_for(26,19)]>>24)!=0) || ((gp[index_for(27,19)]>>24)!=0) || ((gp[index_for(26,20)]>>24)!=0) || ((gp[index_for(27,20)]>>24)!=0)) return -5;
       const u32 v0=composite(slots,n,index_for(25,19));
       if(!clean_source(v0))return -4;
       u32* dst=pixels(slots[n-2]);
       dst[index_for(27,17)]=v0;
       dst[index_for(26,18)]=v0;
       dst[index_for(27,18)]=v0;
       dst[index_for(26,19)]=v0;
       dst[index_for(27,19)]=v0;
       dst[index_for(26,20)]=v0;
       dst[index_for(27,20)]=v0;
    } else if(which==6){ /* Dracula Armor */
       if(((gp[index_for(26,14)]>>24)!=0) || ((gp[index_for(37,14)]>>24)!=0) || ((gp[index_for(25,15)]>>24)!=0) || ((gp[index_for(26,15)]>>24)!=0) || ((gp[index_for(37,15)]>>24)!=0) || ((gp[index_for(38,15)]>>24)!=0) || ((gp[index_for(25,16)]>>24)!=0) || ((gp[index_for(26,16)]>>24)!=0) || ((gp[index_for(27,16)]>>24)!=0) || ((gp[index_for(37,16)]>>24)!=0) || ((gp[index_for(38,16)]>>24)!=0) || ((gp[index_for(27,17)]>>24)!=0) || ((gp[index_for(27,18)]>>24)!=0) || ((gp[index_for(27,19)]>>24)!=0) || ((gp[index_for(27,20)]>>24)!=0) || ((gp[index_for(27,21)]>>24)!=0)) return -5;
       const u32 v0=composite(slots,n,index_for(28,19));
       if(!clean_source(v0))return -4;
       const u32 v1=composite(slots,n,index_for(27,22));
       if(!clean_source(v1))return -4;
       u32* dst=pixels(slots[n-2]);
       dst[index_for(26,14)]=v0;
       dst[index_for(37,14)]=v0;
       dst[index_for(25,15)]=v0;
       dst[index_for(26,15)]=0xff3c32eau;
       dst[index_for(37,15)]=v1;
       dst[index_for(38,15)]=v0;
       dst[index_for(25,16)]=v0;
       dst[index_for(26,16)]=v1;
       dst[index_for(27,16)]=v1;
       dst[index_for(37,16)]=v1;
       dst[index_for(38,16)]=v0;
       dst[index_for(27,17)]=v0;
       dst[index_for(27,18)]=v1;
       dst[index_for(27,19)]=v1;
       dst[index_for(27,20)]=v1;
       dst[index_for(27,21)]=v1;
    } else if(which==7){ /* Furry Body */
       if(((gp[index_for(27,18)]>>24)!=0) || ((gp[index_for(26,19)]>>24)!=0) || ((gp[index_for(27,19)]>>24)!=0) || ((gp[index_for(27,20)]>>24)!=0)) return -5;
       const u32 v0=composite(slots,n,index_for(28,19));
       if(!clean_source(v0))return -4;
       const u32 v1=composite(slots,n,index_for(25,19));
       if(!clean_source(v1))return -4;
       u32* dst=pixels(slots[n-2]);
       dst[index_for(27,18)]=v0;
       dst[index_for(26,19)]=v1;
       dst[index_for(27,19)]=v1;
       dst[index_for(27,20)]=v0;
    } else if(which==8){ /* Lizard Body */
       if(((gp[index_for(27,18)]>>24)!=0) || ((gp[index_for(26,19)]>>24)!=0) || ((gp[index_for(27,19)]>>24)!=0) || ((gp[index_for(26,20)]>>24)!=0) || ((gp[index_for(27,20)]>>24)!=0)) return -5;
       const u32 v0=composite(slots,n,index_for(25,20));
       if(!clean_source(v0))return -4;
       const u32 v1=composite(slots,n,index_for(29,19));
       if(!clean_source(v1))return -4;
       u32* dst=pixels(slots[n-2]);
       dst[index_for(27,18)]=v0;
       dst[index_for(26,19)]=v0;
       dst[index_for(27,19)]=v1;
       dst[index_for(26,20)]=v1;
       dst[index_for(27,20)]=v1;
    } else if(which==9){ /* Merman Body */
       if(((gp[index_for(27,19)]>>24)!=0) || ((gp[index_for(26,20)]>>24)!=0) || ((gp[index_for(27,20)]>>24)!=0) || ((gp[index_for(27,21)]>>24)!=0)) return -5;
       const u32 v0=composite(slots,n,index_for(28,19));
       if(!clean_source(v0))return -4;
       const u32 v1=composite(slots,n,index_for(26,21));
       if(!clean_source(v1))return -4;
       u32* dst=pixels(slots[n-2]);
       dst[index_for(27,19)]=v0;
       dst[index_for(26,20)]=v0;
       dst[index_for(27,20)]=v1;
       dst[index_for(27,21)]=v0;
    } else if(which==10){ /* Werewolf Body */
       if(((gp[index_for(26,18)]>>24)!=0) || ((gp[index_for(27,18)]>>24)!=0) || ((gp[index_for(26,19)]>>24)!=0) || ((gp[index_for(27,19)]>>24)!=0) || ((gp[index_for(26,20)]>>24)!=0) || ((gp[index_for(27,20)]>>24)!=0)) return -5;
       const u32 v0=composite(slots,n,index_for(28,19));
       if(!clean_source(v0))return -4;
       const u32 v1=composite(slots,n,index_for(25,19));
       if(!clean_source(v1))return -4;
       u32* dst=pixels(slots[n-2]);
       dst[index_for(26,18)]=v0;
       dst[index_for(27,18)]=v0;
       dst[index_for(26,19)]=v1;
       dst[index_for(27,19)]=v1;
       dst[index_for(26,20)]=v0;
       dst[index_for(27,20)]=v0;
    } else if(which==11){ /* Hellsing Helmet */
       if(((gp[index_for(27,17)]>>24)!=0)) return -5;
       const u32 v0=composite(slots,n,index_for(28,19));
       if(!clean_source(v0))return -4;
       u32* dst=pixels(slots[n-2]);
       dst[index_for(27,17)]=v0;
    } else if(which==12){ /* Snow Rider Helmet */
       if(((gp[index_for(27,17)]>>24)!=0)) return -5;
       const u32 v0=composite(slots,n,index_for(28,19));
       if(!clean_source(v0))return -4;
       u32* dst=pixels(slots[n-2]);
       dst[index_for(27,17)]=v0;
    }
    return which;
}
