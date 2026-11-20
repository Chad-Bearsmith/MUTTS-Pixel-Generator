/* Pixel Hero Maker v.82 experimental first-idle corrective underlay.
   This function is injected into the v.80 WebGL Wasm module and is called
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
    if(weapon_hash!=BOLT_ALPHA_FNV) return -2;
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
    else return -3;
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
