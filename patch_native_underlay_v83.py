"""Advance the accepted v.82 module by replacing ONLY function 71935 body.

Preserves exact CharacterBuilder.Rebuild call site, export/global indices, both
hand-color helpers, and all other original functions/assets.
"""
from pathlib import Path
import hashlib
ROOT=Path(__file__).resolve().parent
BASE=ROOT/'previous-v82.wasm'
HELPER=ROOT/'prototype/native_underlay_v83.wasm'
OUTPUT=ROOT/'game/Build/WebGL.wasm'
BASE_HASH='c0f31dba2a77be97ccc30a678ea07261705e0ab379bd6d9356a109d402e54747'
DEF_FUNCS=471
FUNC=71935

def uleb(n):
 b=bytearray()
 while 1:
  v=n&127;n>>=7;b.append(v|(128 if n else 0))
  if not n:return bytes(b)

def ul(b,p):
 v=0;sh=0
 while 1:
  t=b[p];p+=1;v|=(t&127)<<sh;sh+=7
  if t<128:return v,p

def sections(data):
 assert data[:8]==b'\0asm\1\0\0\0'
 pos=8;out=[]
 while pos<len(data):
  sid=data[pos];ln,p=ul(data,pos+1);end=p+ln
  assert end<=len(data)
  out.append((sid,data[p:end]));pos=end
 assert pos==len(data)
 return out

def body_from_helper():
 w=HELPER.read_bytes();ss=sections(w)
 for sid,value in ss:
  if sid in [9,11]:
   n,_=ul(value,0);assert n==0,'No data or element segments allowed'
 code=next(value for sid,value in ss if sid==10)
 n,p=ul(code,0);assert n==1
 ln,p=ul(code,p)
 assert p+ln==len(code)
 return code[p:]

def code_bodies(code):
 n,p=ul(code,0);out=[]
 for _ in range(n):
  sz,q=ul(code,p);out.append(code[q:q+sz]);p=q+sz
 assert p==len(code)
 return out

def patch():
 raw=BASE.read_bytes();assert hashlib.sha256(raw).hexdigest()==BASE_HASH
 sec=sections(raw)
 original=next(b for sid,b in sec if sid==10)
 funcs=code_bodies(original)
 assert len(funcs)==71465
 orig=funcs[FUNC-DEF_FUNCS]
 replacement=body_from_helper()
 assert orig!=replacement
 funcs[FUNC-DEF_FUNCS]=replacement
 outcode=uleb(len(funcs))+b''.join(uleb(len(f))+f for f in funcs)
 blob=b'\0asm\1\0\0\0'+b''.join(bytes([sid])+uleb(len(outcode if sid==10 else b))+(outcode if sid==10 else b) for sid,b in sec)
 OUTPUT.write_bytes(blob)
 # Check all original methods except the v82 corrector unchanged in raw section.
 diffs=[idx+DEF_FUNCS for idx,(a,b) in enumerate(zip(code_bodies(original),code_bodies(outcode))) if a!=b]
 assert diffs==[FUNC],diffs
 assert len(sections(raw))==len(sections(blob))
 print('PASS SHA-pinned v82 source',BASE_HASH)
 print('PASS only function',FUNC,'native helper changed; original builder, hand color routines unchanged')
 print('PASS original export/globals/types/data sections unchanged')
 print('v83 SHA256',hashlib.sha256(blob).hexdigest(),'size',len(blob),'native helper delta',len(replacement)-len(orig))
 return blob
if __name__=='__main__':patch()
