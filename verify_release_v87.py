"""Validate actual release archives and exact native method delta."""
from pathlib import Path
from zipfile import ZipFile
import hashlib,json,sys
R=Path(__file__).resolve().parent;G=R/'game';D=R.parent
TITLE='MUTTS Pixel Generator [v.87]';WIN=D/(TITLE+'.zip');WEB=D/(TITLE+' (Web).zip');DEV=D/'PixelHero-v87-Development-Source.zip'
for p in [WIN,WEB,DEV]:
 assert p.is_file(),p
 assert not any(k in p.name for k in ['%20','%5b','%5B','_']),p
 with ZipFile(p) as z:
  assert z.testzip() is None
  names=z.namelist()
  assert all(n and not n.startswith('/') and '..' not in Path(n).parts and '%20' not in n for n in names)
  assert not any(n.startswith(TITLE+'/') or n.startswith(TITLE+' (Web)/') for n in names)
  print('PASS filename/root/CRC',repr(p.name),len(names))
with ZipFile(WEB) as z:
 files={p.relative_to(G).as_posix():p for p in G.rglob('*') if p.is_file()}
 assert set(z.namelist())==set(files)
 for n,p in files.items():assert z.read(n)==p.read_bytes(),n
 assert {'index.html','Changelog.txt','Build/WebGL.data','Build/WebGL.wasm','Build/WebGL.framework.js','Build/WebGL.loader.js'}<=set(z.namelist())
 print('PASS Web ZIP matches source game exactly',len(files),'files')
with ZipFile(WIN) as z:
 assert z.read(TITLE+'.exe')[:2]==b'MZ'
 for n in ['README-START-HERE.txt','Changelog.txt','MUTTS-v87-Technical-Reference.md','MUTTS-v87-Build-Manifest.json']:
  assert z.read(n)==(G/n).read_bytes()
 print('PASS Windows executable and current docs at ZIP root')
with ZipFile(DEV) as z:
 for n in ['previous-v86.wasm','prototype/native_underlay_v87.c','prototype/test_native_v87_swatches.js','prototype/test_native_v86_live_swatches.js','real-v86-examples/SpriteSheet.png','real-v86-examples/SpriteSheet (1).png','real-v86-examples/SpriteSheet (2).png','real-v86-examples/SpriteSheet (3).png','prototype/test_native_v87_real_exports.js','tests/test_v87_layer_snapshot.js','firearms/source-idle.npz','firearms/fixtures-v84.json','firearms/swatch-signatures-v87.json','game/Build/WebGL.wasm','generate_swatch_underlay_v87.py']:
  assert n in z.namelist(),n
 print('PASS developer source self-contained')
assert f'<title>{TITLE}</title>' in (G/'index.html').read_text()
assert 'productVersion: "v.87"' in (G/'index.html').read_text()
assert TITLE in (R/'main.go').read_text()
assert 'SpriteSheet.png' in (G/'phm-static-idle.js').read_text()
assert (G/'Changelog.txt').read_text().startswith(TITLE)
manifest=json.loads((G/'MUTTS-v87-Build-Manifest.json').read_text())
assert len(manifest['weaponMasks'])==25 and manifest['uniqueWeaponIds']==24 and len(manifest['itemStatuses'])==12
for k in ['unityAssets','activeScripts','activeCss']:
 for n,digest in manifest[k].items():assert hashlib.sha256((G/n).read_bytes()).hexdigest()==digest,n
assert manifest['sourceV86WasmSHA256']==hashlib.sha256((R/'previous-v86.wasm').read_bytes()).hexdigest()
assert manifest['newNativeWasmSHA256']==hashlib.sha256((G/'Build/WebGL.wasm').read_bytes()).hexdigest()
assert hashlib.sha256((G/'Build/WebGL.data').read_bytes()).hexdigest()=='4f5ca8b0a0fa4fc894ae25c434bf31c821da4360d6f3ff9e93d1b7e8bd8cfc62'
print('PASS manifest hashes and frozen original Unity data')
sys.path.insert(0,str(R));from patch_native_underlay_v87 import sections,code_bodies
old=code_bodies(next(b for i,b in sections((R/'previous-v86.wasm').read_bytes()) if i==10))
new=code_bodies(next(b for i,b in sections((G/'Build/WebGL.wasm').read_bytes()) if i==10))
assert len(old)==len(new)
assert [j+471 for j,(a,b) in enumerate(zip(old,new)) if a!=b]==[71935]
for f in [5031,71933,71934]:assert old[f-471]==new[f-471]
print('PASS only method 71935 changed from v86; native hand and builder unchanged')
