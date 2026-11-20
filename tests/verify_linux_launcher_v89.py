"""Linux equivalent of the Windows Go launcher; confirms identical embedded Web bytes.
Not a native Windows GUI test.
"""
import os,subprocess,re,time,urllib.request,hashlib,signal
from pathlib import Path
root=Path(__file__).resolve().parent.parent
exe=root/'phm-linux-smoke-v89'
subprocess.run(['go','build','-trimpath','-ldflags=-s -w','-o',str(exe),'.'],cwd=root,env={**os.environ,'GOOS':'linux','GOARCH':'amd64'},check=True)
proc=subprocess.Popen([str(exe)],cwd=root,env={**os.environ,'PHM_DISABLE_BROWSER':'1'},stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
try:
 text=''
 for i in range(10):
  s=proc.stdout.readline();text+=s
  if 'http://' in s:break
 link=re.search(r'http://127\.0\.0\.1:\d+/',text)
 assert link,f'No listening loopback URL: {text}'
 url=link.group(0); count=0
 for p in sorted((root/'game').rglob('*')):
  if not p.is_file():continue
  name=p.relative_to(root/'game').as_posix()
  req=urllib.request.Request(url+name)
  with urllib.request.urlopen(req,timeout=10) as r:response=r.read()
  assert response==p.read_bytes(),f'mismatch: {name}'
  count+=1
 print('PASS Linux smoke launcher served',count,'files byte-identical to the Web ZIP staging game; localhost server working')
except Exception as e:
 print('FAIL',repr(e)); raise
finally:
 proc.terminate()
 try:proc.wait(timeout=6)
 except subprocess.TimeoutExpired:proc.kill()
