"""Validate final v89 archives, live source bytes, title, manifest, and native function boundaries."""
from pathlib import Path
from zipfile import ZipFile
import hashlib,json,sys
R=Path(__file__).resolve().parent;G=R/'game'; D=R.parent
TITLE='Pixel Hero Maker [v.89]';WIN=D/(TITLE+'.zip');WEB=D/(TITLE+' (Web).zip');DEV=D/'PixelHero-v89-Development-Source.zip'
for p in [WIN,WEB,DEV]:
 assert p.is_file(),p
 assert not any(k in p.name.lower() for k in ['%20','%5b','%5d','%28','%29']),p
 if p in (WIN,WEB):assert '_' not in p.name
 with ZipFile(p) as z:
  assert z.testzip() is None
  names=z.namelist()
  assert len(names)==len(set(names))
  assert all(n and not n.startswith('/') and '..' not in Path(n).parts and not any(e in n.lower() for e in ['%20','%5b','%5d','%28','%29']) for n in names)
  assert not any(n.startswith(TITLE+'/') or n.startswith(TITLE+' (Web)/') for n in names)
  print('PASS exact basename/root/CRC',repr(p.name),len(names))
with ZipFile(WEB) as z:
 files={p.relative_to(G).as_posix():p for p in G.rglob('*') if p.is_file()}
 assert set(z.namelist())==set(files)
 for n,p in files.items():assert z.read(n)==p.read_bytes(),n
 assert {'index.html','Changelog.txt','Build/WebGL.data','Build/WebGL.wasm','Build/WebGL.framework.js','Build/WebGL.loader.js'}<=set(z.namelist())
 print('PASS Web ZIP game contents byte-for-byte',len(files))
# The rebuilt Windows executable must contain the exact bytes of every Web game asset.
# Go embed stores the byte payloads in the PE image (verified for this launcher).
import mmap
with (R/(TITLE+'.exe')).open('rb') as executable, mmap.mmap(executable.fileno(),0,access=mmap.ACCESS_READ) as pe:
 for n,p in files.items():
  assert pe.find(p.read_bytes())>=0,f'Windows EXE lacks exact embedded Web file: {n}'
print('PASS 41 exact Web game file payloads present inside the Windows executable')
with ZipFile(WIN) as z:
 assert z.read(TITLE+'.exe')[:2]==b'MZ'
 for n in ['README-START-HERE.txt','Changelog.txt','PixelHero-v89-Technical-Reference.md','PixelHero-v89-Build-Manifest.json']:
  assert z.read(n)==(G/n).read_bytes()
 print('PASS Windows EXE and release documentation at ZIP root')
with ZipFile(DEV) as z:
 needed=['previous-v88.wasm','prototype/native_underlay_v89.c','prototype/native_underlay_v89.wasm','prototype/test_native_v89_layers.js',
  'prototype/test_native_v89_items.js','tests/test_v88_arm_source_evidence.js','tests/v88-native-trace-fixtures.json','tests/v88-item-layer-fixtures.json',
  'firearms/source-idle.npz','firearms/fixtures-v84.json','game/Build/WebGL.wasm','patch_native_underlay_v89.py','patch_source_companions_v89.py']
 assert set(needed)<=set(z.namelist()),set(needed)-set(z.namelist())
 print('PASS developer source reproducible fixtures, patcher, and full game')
assert f'<title>{TITLE}</title>' in (G/'index.html').read_text()
assert 'productVersion: "v.89"' in (G/'index.html').read_text()
assert TITLE in (R/'main.go').read_text()
assert 'SpriteSheet.png' in (G/'phm-static-idle.js').read_text()
assert (G/'Changelog.txt').read_text().startswith(TITLE)
m=json.loads((G/'PixelHero-v89-Build-Manifest.json').read_text())
assert len(m['weaponMasks'])==25 and m['uniqueWeaponIds']==24 and len(m['itemStatuses'])==12
for key in ['unityAssets','activeScripts','activeCss']:
 for n,h in m[key].items():assert hashlib.sha256((G/n).read_bytes()).hexdigest()==h,n
assert m['entryHTMLSHA256']==hashlib.sha256((G/'index.html').read_bytes()).hexdigest()
assert m['sourceV88WasmSHA256']==hashlib.sha256((R/'previous-v88.wasm').read_bytes()).hexdigest()
assert m['newNativeWasmSHA256']==hashlib.sha256((G/'Build/WebGL.wasm').read_bytes()).hexdigest()
assert hashlib.sha256((G/'Build/WebGL.data').read_bytes()).hexdigest()=='4f5ca8b0a0fa4fc894ae25c434bf31c821da4360d6f3ff9e93d1b7e8bd8cfc62'
print('PASS all manifest hashes and frozen original Unity resources')
sys.path.insert(0,str(R));from patch_native_underlay_v89 import sections,code_bodies
before=(R/'previous-v88.wasm').read_bytes(); after=(G/'Build/WebGL.wasm').read_bytes()
a=code_bodies(next(b for i,b in sections(before) if i==10));b=code_bodies(next(b for i,b in sections(after) if i==10))
assert len(a)==len(b)
assert [j+471 for j,(x,y) in enumerate(zip(a,b)) if x!=y]==[71935]
for f in (5031,71933,71934):assert a[f-471]==b[f-471]
before_sections=sections(before);after_sections=sections(after)
assert [s for s,_ in before_sections]==[s for s,_ in after_sections]
for (sid,x),(_,y) in zip(before_sections,after_sections):
 if sid!=10:assert x==y,sid
print('PASS only native 71935 function updated; hand 71933/71934 and all other sections untouched')
print('NOTE Windows GUI/Unity gameplay/downloaded ZIP basenames remain unverified')
