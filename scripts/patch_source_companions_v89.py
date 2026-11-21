"""Narrow v89 source identity correction: unique primary donor is sufficient for
Apache, Alien, Dracula, Furry. Companion can be absent in normal Unity builds.
Other 8 rules unchanged. Never relax Snow Rider (donor shared by 64 items)."""
from pathlib import Path
R=Path(__file__).resolve().parents[1]
p=R/'prototype/native_underlay_v88.c'
s=p.read_text()
for number in (3,4,6,7):
    before={3:'if(d3>=0 && s3_0>=0 && s3_1>=0)',4:'if(d4>=0 && s4_0>=0 && s4_1>=0)',6:'if(d6>=0 && s6_0>=0 && s6_1>=0)',7:'if(d7>=0 && s7_0>=0)'}[number]
    after=f'if(d{number}>=0)' # unique original source masks validated in index
    assert s.count(before)==1,(number,before)
    s=s.replace(before,after,1)
# Do not index a missing Apache companion; erasure occurs only on verified, present item layers.
old='if((pixels(slots[s3_1])[at]>>24)!=0u){ if(jobsCount>=96)return -10; jobs[jobsCount++]=(V88Patch){pixels(slots[s3_1]),at,0u};confirmed++; }'
assert s.count(old)==1
s=s.replace(old, 'if(s3_1>=0 && (pixels(slots[s3_1])[at]>>24)!=0u){ if(jobsCount>=96)return -10; jobs[jobsCount++]=(V88Patch){pixels(slots[s3_1]),at,0u};confirmed++; }',1)
s=s.replace('MUTTS Pixel Generator v.88 experimental first-idle corrective underlay','MUTTS Pixel Generator v.89 experimental first-idle corrective underlay',1)
(R/'prototype/native_underlay_v89.c').write_text(s)
print('patched four unique source identities, Apache optional layer safely guarded')
