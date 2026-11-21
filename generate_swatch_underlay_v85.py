"""Generate v85 palette-invariant corrective fallback from accepted v84 templates.

The v84 exact RGB paths are retained byte-for-byte in the generated C.
This fallback recognizes item appearance by alpha + neighboring equal-color
boundaries, not RGB literals. Ambiguous pairs have alpha provenance guards.
It never uses a guess for item color except the one Dracula highlight shade,
whose exact swatch transform is unknown; it derives a ranked-channel shade
from the current live dark-red sample, and is explicitly experimental.
"""
from pathlib import Path
import base64, json
import numpy as np
R=Path(__file__).resolve().parent
DATA=json.loads((R/'firearms/fixtures-v84.json').read_text())
cases=DATA['cases']
assert len(cases)==12 and len(DATA['weapons'])==25
union=np.zeros((64,64), dtype=np.bool_)
for w in DATA['weapons']:
    gun=np.frombuffer(base64.b64decode(w['rgba']),np.uint8).reshape(64,64,4)
    union |= gun[:,:,3]!=0
assert int(union.sum())==255
FNV=2166136261
def swatch_hash(img):
    # Equality relationships, not shade or hue; alpha normalized to visible/invisible.
    h=FNV
    for y in range(64):
        for x in range(64):
            if union[y,x]:continue
            c=img[y,x]
            v=int(c[3]!=0)
            if v:
                if x and not union[y,x-1] and img[y,x-1,3] and np.array_equal(c[:3],img[y,x-1,:3]):v|=2
                if y and not union[y-1,x] and img[y-1,x,3] and np.array_equal(c[:3],img[y-1,x,:3]):v|=4
            h=((h^v)*16777619)&0xffffffff
    return h
pairs={}
for c in cases:
    img=np.frombuffer(base64.b64decode(c['current']),np.uint8).reshape(64,64,4)
    h=swatch_hash(img)
    pairs.setdefault(h,[]).append(c)
    c['swatchSignature']=f'0x{h:08x}'
print('Computed palette-invariant appearance signatures:')
for h,group in pairs.items():print(f' {h:#010x}',[(x['id'],x['name']) for x in group])
assert {tuple(c['id'] for c in group) for group in pairs.values() if len(group)>1}=={(1,6),(3,4)}
# Cross-gun dynamic-sample rule: every item has fixed alpha geometry;
# the current RGB values are drawn exclusively from selected, active sources.
src=[]
src.append('''
/* Swatch-aware fallback: structural appearance signature.  Never keyed to
   fixed item RGB values.  Exclude every known firearm silhouette pixel,
   then hash alpha + the equality of left/top adjacent *character* colors.
   Palette recolors preserve these boundaries when they preserve shade classes.
   Unsupported or ambiguous states fail closed. */
__attribute__((always_inline)) static inline u32 swatch_signature(u32* slots,u32 n){
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
 u32 sig=swatch_signature(slots,n);
 int item=0;
''')
for h,group in pairs.items():
    if len(group)==1:src.append(f' if(sig==0x{h:08x}u)item={group[0]["id"]}; /* {group[0]["name"]} */\n')
    elif tuple(c['id'] for c in group)==(1,6):
        src.append(f' if(sig==0x{h:08x}u){{ /* Cape vs Dracula: unarmed-side garment alpha */\n'
                   '   u32 a=under_character(slots,n,index_for(27,18))>>24;\n'
                   '   item=a?1:6;\n }\n')
    elif tuple(c['id'] for c in group)==(3,4):
        src.append(f' if(sig==0x{h:08x}u){{ /* Apache vs Alien: target outline alpha */\n'
                   '   u32 a=under_character(slots,n,index_for(27,17))>>24;\n'
                   '   item=a?3:4;\n }\n')
src.append(''' if(!item)return -3; /* unknown structural appearance */
 int visible=0;
 /* Complete validation occurs BEFORE any layer is written. */
''')
for c in cases:
    src.append(f' if(item=={c["id"]}){{ /* {c["name"]} */\n')
    for p in c['patches']:
        x,y=p['x'],p['y']
        alpha=p['before'][3]
        src.append(f'  if((gp[index_for({x},{y})]>>24)==0u){{\n'
                   f'   visible++;\n   if((under_character(slots,n,index_for({x},{y}))>>24)!={alpha}u)return -7;\n')
        if p['after'][3]!=0:
            if p['sample'] is not None:
                sx,sy=p['sample']
            else:
                assert c['name']=='Dracula Armor' and p['after'][:3]==[234,50,60]
                sx,sy=27,22
            src.append(f'   if((under_character(slots,n,index_for({sx},{sy}))>>24)!=255u)return -4;\n')
        src.append('  }\n')
    src.append(' }\n')
src.append(' if(!visible)return -6; /* weapon covers all corrections */\n')
for c in cases:
    src.append(f' if(item=={c["id"]}){{ /* {c["name"]} */\n')
    for p in c['patches']:
        x,y=p['x'],p['y']
        src.append(f'  if((gp[index_for({x},{y})]>>24)==0u){{\n')
        if p['after'][3]==0:
            src.append(f'   for(u32 j=0;j<n-1;++j)pixels(slots[j])[index_for({x},{y})]=0u;\n')
        elif p['sample'] is not None:
            sx,sy=p['sample']
            src.append(f'   pixels(slots[n-2])[index_for({x},{y})]=under_character(slots,n,index_for({sx},{sy}));\n')
        else:
            src.append(f'   pixels(slots[n-2])[index_for({x},{y})]=dracula_bright_from_dark(under_character(slots,n,index_for(27,22)));\n')
        src.append('  }\n')
    src.append(' }\n')
src.append(' return 5000+gun_id*100+item; /* swatch-aware path, distinct diagnostic status */\n}\n')

old=(R/'prototype/native_underlay_v84.c').read_text()
needle='__attribute__((always_inline)) static inline int cross_gun_underlay'
assert old.count(needle)==1
old=old.replace(needle,''.join(src)+'\n'+needle)
old=old.replace('  if(!gun_id)return -2; /* unsupported firearm */',
                '  if(!gun_id && alpha_hash!=BOLT_ALPHA_FNV)return -2; /* unsupported firearm */')
old=old.replace('  if(!item)return -3; /* not exact reference character */',
                '  if(!item)goto palette_fallback; /* guarded color-change fallback */')
old=old.replace('    if(weapon_hash!=BOLT_ALPHA_FNV) return cross_gun_underlay(slots,n,gp,weapon_hash);',
                '    if(weapon_hash!=BOLT_ALPHA_FNV) return cross_gun_underlay(slots,n,gp,weapon_hash);')
# Once the exact appearance matched, palette edits confined to the weapon-
# excluded area can still make v84's literal target/source RGB checks fail.
# Retest through the complete structural guard before making ANY writes.
start=old.index('__attribute__((always_inline)) static inline int cross_gun_underlay')
end=old.index('__attribute__((export_name("phm_native_underlay"))',start)
section=old[start:end]
section=section.replace('return -4;', 'goto palette_fallback;')
section=section.replace('return -7;', 'goto palette_fallback;')
needle_end='  return gun_id*100+item; /* Bolt remains 1..12; other guns identify both */\n}\n'
assert section.count(needle_end)==1
section=section.replace(needle_end,'  return gun_id*100+item; /* original v84 exact path */\npalette_fallback:\n  return swatch_underlay(slots,n,gp,gun_id);\n}\n')
old=old[:start]+section+old[end:]
old=old.replace('    else return -3;\n    /* Guard ALL modified target sites',
                '    else return cross_gun_underlay(slots,n,gp,weapon_hash); /* original Bolt exact-match guard failed: try recolor */\n    /* Guard ALL modified target sites')
old=old.replace('MUTTS Pixel Generator v.84 experimental','MUTTS Pixel Generator v.85 experimental')
old=old.replace('replaces v83 helper 71935','replaces v84 helper 71935')
assert 'return swatch_underlay' in old and 'else return cross_gun_underlay' in old
(R/'prototype/native_underlay_v85.c').write_text(old)
(R/'firearms/swatch-signatures-v85.json').write_text(json.dumps({'format':'PixelHero-v85-PaletteInvariantAppearances-1','signatures':[{'id':c['id'],'name':c['name'],'hash':c['swatchSignature']} for c in cases], 'ambiguousPairs':[['Cape','Dracula Armor'],['Apache Armor','Alien Armor']], 'algorithm':'Alpha and immediate left/top RGB equality, excluding 255 union firearm pixels','draculaHighlight':'Rank-based adjustment from current dark-red source: synthetic only, live unverified'},indent=2)+'\n')
print('Generated',len(old),'bytes C')
