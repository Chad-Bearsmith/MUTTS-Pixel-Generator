"""Build v87 player ZIPs + reproducible developer source; preserve exact names."""
from pathlib import Path
import json,hashlib,zipfile,subprocess,os
R=Path(__file__).resolve().parent;OUT=R.parent;G=R/'game'
VERSION='v.87';TITLE=f'MUTTS Pixel Generator [{VERSION}]'
WINZIP=OUT/(TITLE+'.zip');WEBZIP=OUT/(TITLE+' (Web).zip');DEVZIP=OUT/'MUTTS-v87-Development-Source.zip'
def sha(p):
 h=hashlib.sha256()
 with open(p,'rb') as f:
  for b in iter(lambda:f.read(1<<20),b''):h.update(b)
 return h.hexdigest()
def make_zip(path,members):
 with zipfile.ZipFile(path,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as z:
  for name,p in members:
   assert not name.startswith('/') and '..' not in Path(name).parts,name
   z.write(p,name)
 with zipfile.ZipFile(path) as z:assert z.testzip() is None
 print('PASS ZIP',repr(path.name),len(members),'files',path.stat().st_size)
def build():
 js=['offline-ui.js','phm-compositor-probe.js','phm-diagnostics-ui.js','phm-preview-inline.js','phm-static-idle.js','phm-v76-layer-provenance.js']
 css=['phm-diagnostics-ui.css','phm-static-idle.css']
 assets=['Build/WebGL.wasm','Build/WebGL.data','Build/WebGL.framework.js','Build/WebGL.loader.js']
 data=json.loads((R/'firearms/fixtures-v84.json').read_text())
 manifest={
  'format':'PixelHero-v87-BuildManifest-1','version':VERSION,
  'baseline':'Exact v86 native module; four additional real v86 failed Body swatches reported',
  'codeChange':'Only native function 71935 changes: tiny verified additional shade-boundary relaxations for Fire Lizard/Lizard/Werewolf. Browser phm-v76-layer-provenance.js adds read-only source layer snapshot to idle trace.',
  'sourceV86WasmSHA256':sha(R/'previous-v86.wasm'),
  'newNativeWasmSHA256':sha(G/'Build/WebGL.wasm'),
  'weaponMasks':[{'id':w['id'],'name':w['name'],'alphaHash':w['alphaHash'],'variant':w.get('variant','resources.assets')} for w in data['weapons']],
  'uniqueWeaponIds':data['weaponCountDistinct'], 'verifiedSourceMaskVariants':data['knownMaskCount'],
  'itemStatuses':{str(c['id']):c['name'] for c in data['cases']},
  'guard':'v86 original exact/structural/Furry/Werewolf paths preserved; third stage item-specific structural signatures exempt exactly 2 FireLizard, 1 Lizard, 5 Werewolf sites; all original source/target alpha and firearm guards unchanged',
  'newDiagnostics':{'status5000Offset':'swatch-aware fallback applied','matchMode':'swatch-aware|exact-reference|null','underlaySourceLayers':'read-only per-native-array first idle alpha masks, append-site identities, sample colors; helmet research only'},
  'limitations':['Helmet combinations with underlying Body/Armor frequently skip; current release does not fix helmet recognition','Four specific actual v86 exported swatch cases tested in compiled native fixtures, but v87 Unity gameplay not live verified','Dracula recolor highlight estimate remains experimental'],
  'unityAssets':{n:sha(G/n) for n in assets},'activeScripts':{n:sha(G/n) for n in js},'activeCss':{n:sha(G/n) for n in css},
  'entryHTMLSHA256':sha(G/'index.html'),
  'validation':{'realV86ExportChecks':54,'nativeInheritedSwatchChecks':1802,'nativeInheritedCrossFirearmChecks':305,'nativeHandPipelineFixtures':6,'nativeCapeBackFixtures':17,
      'layerSnapshotReadOnlyJSFixture':'PASS', 'nativeWebAssembly':'PASS',
      'actualV87UnityFourSwatches':'NOT TESTED','helmetCombinations':'NOT FIXED / NOT TESTED',
      'nativeWindowsLiveExecution':'NOT TESTED','browserSavedZipBasename':'NOT TESTED'}
 }
 (G/'MUTTS-v87-Build-Manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 exe=R/(TITLE+'.exe')
 subprocess.run(['go','build','-trimpath','-ldflags=-s -w','-o',str(exe),'.'],cwd=R,env={**os.environ,'GOOS':'windows','GOARCH':'amd64','CGO_ENABLED':'0'},check=True)
 assert exe.read_bytes()[:2]==b'MZ'
 game_members=[(p.relative_to(G).as_posix(),p) for p in sorted(G.rglob('*')) if p.is_file()]
 make_zip(WEBZIP,game_members)
 win_docs=['README-START-HERE.txt','Changelog.txt','MUTTS-v87-Technical-Reference.md','MUTTS-v87-Build-Manifest.json']
 make_zip(WINZIP,[(TITLE+'.exe',exe)]+[(n,G/n) for n in win_docs])
 source_files=['main.go','console_windows.go','console_other.go','go.mod','README-DEVELOPER.txt','MUTTS_PIXEL_GENERATOR_PROJECT_RELEASE_RULES.md',
      'previous-v86.wasm','previous-v85.wasm','previous-v84.wasm','previous-v83.wasm','previous-v82.wasm','previous-v81.wasm','previous-v80.wasm',
      'patch_native_underlay_v87.py','generate_swatch_underlay_v87.py','patch_native_underlay_v86.py','generate_swatch_underlay_v86.py',
      'patch_native_underlay_v85.py','generate_swatch_underlay_v85.py',
      'patch_native_underlay_v84.py','generate_weapon_variants_v84.py',
      'patch_native_underlay_v83.py','generate_cross_firearm_v83.py','generate_v82_rules.py',
      'update_v87_release.py','build_release_v87.py','verify_release_v87.py','test-native-pair.wasm','test-native-helper.wasm']
 source_members=[(n,R/n) for n in source_files]
 source_members.append(('Items-For-Fix.zip',OUT/'Items-For-Fix.zip'))
 for folder in ['tests','prototype','references','firearms','swatch-repros','real-v86-examples']:
  for p in sorted((R/folder).rglob('*')):
   if p.is_file() and '.pyc' not in p.name and '__pycache__' not in p.parts:
    source_members.append((p.relative_to(R).as_posix(),p))
 source_members.extend(('game/'+n,p) for n,p in game_members)
 make_zip(DEVZIP,source_members)
 for p in [WINZIP,WEBZIP,DEVZIP]:print('OUTPUT',repr(p.name),sha(p))
if __name__=='__main__':build()
