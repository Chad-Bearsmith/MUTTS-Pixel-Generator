#!/usr/bin/env python3
"""Read-only initial import verification of immutable Unity binaries and key source files."""
from pathlib import Path
import hashlib,json,sys
R=Path(__file__).resolve().parents[1]
H=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
EXPECTED={
  'previous-v87.wasm':'0c47dc29fec0446fa5e8',
  'previous-v88.wasm':'12e3640b5f08041ed6fc',
  'game/Build/WebGL.wasm':'7472d295f8b917c1c445',
  'game/Build/WebGL.data':'4f5ca8b0a0fa4fc894ae',
}
for name,prefix in EXPECTED.items():
 p=R/name
 assert p.is_file(),f'Missing {name}'
 actual=H(p)
 assert actual.startswith(prefix),f'Imported baseline mismatch {name}: {actual}'
 print('PASS pinned',name,actual[:20])
for name in ['AGENTS.md','PIXEL_HERO_MAKER_PROJECT_RELEASE_RULES.md','docs/CODEX_HANDOFF.md','docs/GITHUB_SETUP.md','prototype/native_underlay_v89.c','prototype/native_underlay_v89.wasm','tests/v89-uploaded-layer-fixtures.json','references/Fix/Armor;Dracula.png','game/index.html','game/Changelog.txt']:
 assert (R/name).is_file(),f'Missing {name}'
m=json.loads((R/'game/PixelHero-v89-Build-Manifest.json').read_text())
assert m['sourceV88WasmSHA256']==H(R/'previous-v88.wasm')
assert m['newNativeWasmSHA256']==H(R/'game/Build/WebGL.wasm')
for group in ('unityAssets','activeScripts','activeCss'):
 for n,h in m[group].items():
  assert H(R/'game'/n)==h,f'Manifest mismatch {n}'
assert H(R/'game/index.html')==m['entryHTMLSHA256']
assert 'Pixel Hero Maker [v.89]' in (R/'game/index.html').read_text()
assert (R/'game/Changelog.txt').read_text().startswith('Pixel Hero Maker [v.89]')
for f in (R/'diagnostics/v88').glob('PixelHero-v88-IdleAutoHandTrace*.json'):
 assert json.loads(f.read_text())['result']['build']=='Pixel Hero Maker [v.88]'
print('PASS v89 Web manifest, source references, and diagnostics')
print('NOTE: no user/gameplay or Windows GUI testing performed by this script')
