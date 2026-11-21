"""Build v89 player ZIPs and developer archive with canonical names and exact embedded Web revision."""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
import hashlib,json,subprocess,os
R=Path(__file__).resolve().parent; OUT=R.parent; G=R/'game'
VERSION='v.89';TITLE=f'MUTTS Pixel Generator [{VERSION}]'
WINZIP=OUT/(TITLE+'.zip'); WEBZIP=OUT/(TITLE+' (Web).zip'); DEVZIP=OUT/'MUTTS-v89-Development-Source.zip'

def sha(p):
 h=hashlib.sha256()
 with open(p,'rb') as f:
  for b in iter(lambda:f.read(1<<20),b''):h.update(b)
 return h.hexdigest()

def make_zip(path,members):
 assert len(members)==len(set(name for name,p in members)),f'duplicate members {path}'
 with ZipFile(path,'w',compression=ZIP_DEFLATED,compresslevel=6,allowZip64=True) as z:
  for name,p in members:
   assert not name.startswith('/') and '..' not in Path(name).parts,name
   assert p.is_file(),p
   z.write(p,name)
 with ZipFile(path) as z:assert z.testzip() is None
 print('PASS ZIP',repr(path.name),len(members),'members',path.stat().st_size)

def build():
 assert f'<title>{TITLE}</title>' in (G/'index.html').read_text(), 'Use the v.89 checkout to package v.89'
 js=['offline-ui.js','phm-compositor-probe.js','phm-diagnostics-ui.js','phm-preview-inline.js','phm-static-idle.js','phm-v76-layer-provenance.js']
 css=['phm-diagnostics-ui.css','phm-static-idle.css']
 assets=['Build/WebGL.wasm','Build/WebGL.data','Build/WebGL.framework.js','Build/WebGL.loader.js']
 data=json.loads((R/'firearms/fixtures-v84.json').read_text())
 manifest={
  'format':'PixelHero-v89-BuildManifest-1','version':VERSION,
  'baseline':'Exact v88 game baseline, four unique-donor optional companion fallback; native game SHA256 anchored',
  'nativeChange':'Only function 71935 modified: four uniquely identified primary donors (Apache, Alien, Dracula, Furry) can correct absent optional companion layouts. All existing operations/guards preserved.',
  'sourceV88WasmSHA256':sha(R/'previous-v88.wasm'),
  'newNativeWasmSHA256':sha(G/'Build/WebGL.wasm'),
  'weaponMasks':[{'id':w['id'],'name':w['name'],'alphaHash':w['alphaHash'],'variant':w.get('variant','resources.assets')} for w in data['weapons']],
  'uniqueWeaponIds':data['weaponCountDistinct'],'verifiedSourceMaskVariants':data['knownMaskCount'],
  'itemStatuses':{str(c['id']):c['name'] for c in data['cases']},
  'guard':'Original exact and swatch-aware behavior first; 4-item unique primary source fallback only after -3/-7. Preserve firearm and overlapping equipment. Other combinations fail closed.',
  'newDiagnostics':{'underlaySourceCodeOffset':8000,'nativeArmSourceEvidence':'Read-only source104/108 freshness, reference and neighboring samples, selected-but-unavailable overlay flag'},
  'limitations':['Selected arm overlay source108 status2 in Armor+Cape/Back combinations is NOT repaired; no guessed color fallback','Live v89 Unity exports NOT TESTED','Nonunique source masks continue to skip','Dracula unusual swatch highlight inference from inherited v85 logic remains experimental'],
  'unityAssets':{n:sha(G/n) for n in assets},
  'activeScripts':{n:sha(G/n) for n in js},
  'activeCss':{n:sha(G/n) for n in css},
  'entryHTMLSHA256':sha(G/'index.html'),
  'validation':{'nativeOriginalItemFixtureAssertions':126,'nativeUserTraceEquippedCases':8,'nativeV88NewUploadedCases':5,
      'nativeInheritedRealExports':54,'nativeInheritedSwatchChecks':1802,'nativeInheritedCrossFirearm':305,
      'nativeHandPipelineCases':6,'nativeCapeBackCases':17,'readOnlyNativeLayerJSFixture':'PASS','readOnlyArmSourceJSFixture':'PASS',
      'nativeWebAssembly':'PASS','liveV88Unity':'NOT TESTED','handStatus2Fix':'NOT FIXED',
      'nativeWindowsLiveExecution':'NOT TESTED','browserSavedZipBasename':'NOT TESTED'}
 }
 (G/'MUTTS-v89-Build-Manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 exe=R/(TITLE+'.exe')
 subprocess.run(['go','build','-trimpath','-ldflags=-s -w','-o',str(exe),'.'],cwd=R,env={**os.environ,'GOOS':'windows','GOARCH':'amd64','CGO_ENABLED':'0'},check=True)
 assert exe.read_bytes()[:2]==b'MZ'
 game_members=[(p.relative_to(G).as_posix(),p) for p in sorted(G.rglob('*')) if p.is_file()]
 make_zip(WEBZIP,game_members)
 docs=['README-START-HERE.txt','Changelog.txt','MUTTS-v89-Technical-Reference.md','MUTTS-v89-Build-Manifest.json']
 make_zip(WINZIP,[(TITLE+'.exe',exe)]+[(n,G/n) for n in docs])
 source_files=['main.go','console_windows.go','console_other.go','go.mod','README-DEVELOPER.txt','MUTTS_PIXEL_GENERATOR_PROJECT_RELEASE_RULES.md','Items-For-Fix.zip',
    'previous-v88.wasm','previous-v87.wasm','previous-v86.wasm','previous-v85.wasm','previous-v84.wasm','previous-v83.wasm','previous-v82.wasm','previous-v81.wasm','previous-v80.wasm',
    'patch_source_companions_v89.py','patch_native_underlay_v89.py','generate_source_layer_underlay_v88.py','update_v89_release.py','build_release_v89.py','verify_release_v89.py',
    'build_release_v87.py','verify_release_v87.py','patch_native_underlay_v87.py','generate_swatch_underlay_v87.py',
    'patch_native_underlay_v86.py','generate_swatch_underlay_v86.py','patch_native_underlay_v85.py','generate_swatch_underlay_v85.py',
    'patch_native_underlay_v84.py','generate_weapon_variants_v84.py','patch_native_underlay_v83.py','generate_cross_firearm_v83.py','generate_v82_rules.py',
    'add_source_aware_v88.py','check_targets.py','item_alpha_provenance.py','source_layer_crosscheck.py',
    'test-native-pair.wasm','test-native-helper.wasm','item-source-alpha-index.json','item-alpha-results.txt','source-layer-match-results.txt']
 source_members=[(n,R/n) for n in source_files]
 for folder in ['tests','prototype','references','firearms','swatch-repros','real-v86-examples']:
  for p in sorted((R/folder).rglob('*')):
   if p.is_file() and p.suffix!='.pyc' and '__pycache__' not in p.parts:
    source_members.append((p.relative_to(R).as_posix(),p))
 source_members.extend(('game/'+n,p) for n,p in game_members)
 make_zip(DEVZIP,source_members)
 for p in [WINZIP,WEBZIP,DEVZIP]:print('OUTPUT',repr(p.name),sha(p))
if __name__=='__main__':build()
