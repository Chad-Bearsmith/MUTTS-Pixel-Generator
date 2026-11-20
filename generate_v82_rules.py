"""Generate the 12 user-defined Bolt idle fixture alignments and extension rules.

The (x,y) crop offsets are established from a unique exact match of all 54
opaque Bolt firearm source pixels against each supplied 20x-nearest-neighbor
PNG. Crucially, Dracula's Fix is re-cropped, not an enormous replacement.
"""
from pathlib import Path
from PIL import Image
import numpy as np, json, base64
ROOT=Path(__file__).resolve().parent
REF=ROOT/'references'
BOLT=np.load(ROOT/'prototype/Bolt-idle.npy')
assert BOLT.shape==(64,64,4)
SPECS=[
 (1,'Cape;Cape.png','Cape',(27,8),(27,8)),
 (2,'Body;Fire Lizard.png','Fire Lizard',(23,5),(23,5)),
 (3,'Armor;Apache.png','Apache Armor',(27,8),(27,8)),
 (4,'Armor;Alien.png','Alien Armor',(22,6),(22,6)),
 (5,'Armor;Angel.png','Angel Armor',(21,5),(21,5)),
 (6,'Armor;Dracula.png','Dracula Armor',(27,8),(25,7)),
 (7,'Body;Furry.png','Furry Body',(22,5),(22,5)),
 (8,'Body;Lizard.png','Lizard Body',(23,7),(23,7)),
 (9,'Body;Merman.png','Merman Body',(24,7),(24,7)),
 (10,'Body;Werewolf.png','Werewolf Body',(22,4),(22,4)),
 (11,'Helmet;Hellsing.png','Hellsing Helmet',(22,6),(22,6)),
 (12,'Helmet;Snow Rider.png','Snow Rider Helmet',(23,5),(23,5))
]

def align(sub,name,shift):
    im=np.array(Image.open(REF/sub/name).convert('RGBA'))
    assert im.shape[0]%20==0 and im.shape[1]%20==0
    small=im[::20,::20,:]
    assert np.array_equal(np.repeat(np.repeat(small,20,axis=0),20,axis=1),im)
    x,y=shift
    out=np.zeros((64,64,4),np.uint8)
    out[y:y+small.shape[0],x:x+small.shape[1]]=small
    # cross-check precisely all opaque non-marker selected firearm pixels
    mask=BOLT[:,:,3]==255
    assert np.all(out[mask]==BOLT[mask]),(sub,name,shift,'firearm alignment failed')
    return out

def fnv(curr):
    composite=curr.copy()
    marker=BOLT[:,:,3]==254
    composite[marker]=[0,0,0,255]
    composite[~marker & (composite[:,:,3]>0),3]=255
    composite[~marker & (composite[:,:,3]==0)]=0
    h=2166136261
    for v in composite.tobytes():h=((h^v)*16777619)&0xffffffff
    return h

def find_sample(color, cur, changes):
    if color[3]==0:return None
    ys,xs=np.where(np.all(cur==np.array(color,dtype=np.uint8),axis=2) & ~changes & (BOLT[:,:,3]==0))
    if not len(ys):return None
    ranked=sorted(zip(xs.tolist(),ys.tolist()),key=lambda pos:(abs(pos[0]-27)+abs(pos[1]-19),pos[1],pos[0]))
    return list(ranked[0])

cases=[]; hashes=[]
for index,name,label,cur_shift,fix_shift in SPECS:
    cur=align('Current',name,cur_shift)
    fix=align('Fix',name,fix_shift)
    # Never attempt to mutate firearm markers, including the change in source
    # image PNG alpha for Dracula (254=>255). Keep raw markers byte-exact.
    changes=np.any(cur!=fix,axis=2) & (BOLT[:,:,3]==0)
    assert not np.any(np.any(cur!=fix,axis=2) & (BOLT[:,:,3]==255))
    patches=[]
    for y,x in np.argwhere(changes):
        before=tuple(int(v) for v in cur[y,x]); after=tuple(int(v) for v in fix[y,x])
        anchor=find_sample(after,cur,changes)
        patches.append(dict(x=int(x),y=int(y),before=before,after=after,sample=anchor))
    h=fnv(cur)
    hashes.append(h)
    cases.append(dict(item=index,name=label,sourceFile=name,shiftCurrent=cur_shift,shiftFix=fix_shift,
                      fingerprint=f'0x{h:08x}',changed=patches,
                      current=base64.b64encode(cur.tobytes()).decode(),
                      fix=base64.b64encode(fix.tobytes()).decode()))
    print(f'{index:2d} {label:20s} {len(patches):2d} patches FNV 0x{h:08x} anchors {sum(p["sample"] is not None for p in patches)}/{len(patches)}')
assert len(set(hashes))==12
assert hashes[:3]==[0x851e5dc5,0xc8432bdf,0x94e70373], 'accepted v81 signatures cannot change'
assert len(cases[5]['changed'])==16
assert all(int(BOLT[p['y'],p['x'],3])==0 for c in cases for p in c['changed'])
( ROOT/'prototype/fixtures_v82.json').write_text(json.dumps(dict(format='PHM-v82-12Case-Native-Fixtures',caseCount=12,frameSize=[64,64],firearm='Bolt',boltMask=base64.b64encode(BOLT.tobytes()).decode(),cases=cases),indent=2)+'\n')
# Extend the accepted v81 native helper exactly, preserving the three accepted
# branches and the v81 weapon/fingerprint/safety validation.
src=(ROOT/'prototype/native_underlay_v81.c').read_text()
needle='    else return -3;\n'
assert src.count(needle)==1
src=src.replace(needle,''.join(f'    else if(whole==((u32){c["fingerprint"]}u))which={c["item"]};\n' for c in cases[3:])+needle)
needle='    } else {\n       if((gp[p0]>>24)!=0) return -5;\n       for(u32 j=0;j<n-1;++j)pixels(slots[j])[p0]=0;\n    }\n    return which;'
assert src.count(needle)==1
branches=[]
for c in cases[3:]:
    p=c['changed']; ss=[]
    ss.append(f'    }} else if(which=={c["item"]}){{ /* {c["name"]} */')
    occ=' || '.join(f'((gp[index_for({t["x"]},{t["y"]})]>>24)!=0)' for t in p)
    ss.append(f'       if({occ}) return -5;')
    color_to_var={}; color_to_anchor={}
    for t in p:
        col=tuple(t['after'])
        if t['sample'] is not None and col not in color_to_var:
            var=f'v{len(color_to_var)}'
            color_to_var[col]=var
            color_to_anchor[col]=tuple(t['sample'])
    for color,var in color_to_var.items():
        x,y=color_to_anchor[color]
        ss.append(f'       const u32 {var}=composite(slots,n,index_for({x},{y}));')
        ss.append(f'       if(!clean_source({var}))return -4;')
    ss.append('       u32* dst=pixels(slots[n-2]);')
    for t in p:
        col=tuple(t['after']);var=color_to_var.get(col)
        if col[3]==0:val='0u'
        elif var is not None:val=var
        else:val=f'0x{(col[0]|col[1]<<8|col[2]<<16|col[3]<<24):08x}u'
        ss.append(f'       dst[index_for({t["x"]},{t["y"]})]={val};')
    branches.extend(ss)
replacement='    } else if(which==3){\n       if((gp[p0]>>24)!=0) return -5;\n       for(u32 j=0;j<n-1;++j)pixels(slots[j])[p0]=0;\n'+ '\n'.join(branches)+'\n    }\n    return which;'
src=src.replace(needle,replacement)
src=src.replace('v.81 experimental','v.82 experimental')
src=src.replace('restricted to exact v.80 naked Human + Bolt first-idle\n   references supplied by the user','restricted to exact v.81-accepted naked Human + Bolt first-idle\n   references supplied by the user')
src=src.replace('Returns 1/2/3 if a patch was made','Returns 1..12 if a patch was made')
(ROOT/'prototype/native_underlay_v82.c').write_text(src)
print('Wrote C source',len(src),'bytes')
