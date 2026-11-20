#!/usr/bin/env python3
"""Verify pinned Unity assets and the reproducible native development build."""
from pathlib import Path
import hashlib,json,sys
sys.dont_write_bytecode=True
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import patch_native_alien_tail_v90 as tail
import patch_native_player_v90 as player
R=Path(__file__).resolve().parents[1]
H=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
EXPECTED={
  'previous-v87.wasm':'0c47dc29fec0446fa5e8',
  'previous-v88.wasm':'12e3640b5f08041ed6fc',
  'game/Build/WebGL.wasm':'95c4ec1e0d6d187868c',
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
old=json.loads((R/'game/PixelHero-v89-Build-Manifest.json').read_text())
assert old['sourceV88WasmSHA256']==H(R/'previous-v88.wasm')
baseline=tail.v89_baseline()
assert old['newNativeWasmSHA256']==tail.sha256(baseline)
candidate=tail.build()
active=(R/'game/Build/WebGL.wasm').read_bytes()
assert tail.sha256(candidate)==player.PINNED_V90
assert active==player.build()
candidate_sections=dict(tail.v89.sections(candidate))
active_sections=dict(tail.v89.sections(active))
assert candidate_sections.keys()==active_sections.keys()
assert all(candidate_sections[sid]==active_sections[sid] for sid in candidate_sections if sid not in (7,10))
old_bodies=tail.v89.code_bodies(candidate_sections[10])
new_bodies=tail.v89.code_bodies(active_sections[10])
v87_sections=dict(tail.v89.sections((R/'previous-v87.wasm').read_bytes()))
v87_bodies=tail.v89.code_bodies(v87_sections[10])
assert len(new_bodies)==len(old_bodies)
assert [i+tail.v89.DEF_FUNCS for i,(a,b) in enumerate(zip(old_bodies,new_bodies)) if a!=b]==[5031,71935]
assert new_bodies[71935-tail.v89.DEF_FUNCS]==v87_bodies[71935-tail.v89.DEF_FUNCS]
assert active_sections[7]==player.player_exports(candidate_sections[7])
print('PASS pinned v89 and v90 reconstruction, v87 underlay, and player function/export diff')
m=json.loads((R/'game/PixelHero-v90-Build-Manifest.json').read_text())
assert m['sourceV89WasmSHA256']==tail.sha256(baseline)
assert m['sourceV90CandidateWasmSHA256']==tail.sha256(candidate)
assert m['underlayV87WasmSHA256']==H(R/'previous-v87.wasm')
assert m['newNativeWasmSHA256']==H(R/'game/Build/WebGL.wasm')
assert set(m['activeScripts'])=={p.name for p in (R/'game').glob('*.js')}
assert set(m['activeCss'])=={p.relative_to(R/'game').as_posix() for p in (R/'game').rglob('*.css')}
for group in ('unityAssets','activeScripts','activeCss'):
 for n,h in m[group].items():
  assert H(R/'game'/n)==h,f'Manifest mismatch {n}'
assert H(R/'game/index.html')==m['entryHTMLSHA256']
assert 'Pixel Hero Maker [v.90]' in (R/'game/index.html').read_text()
assert (R/'game/Changelog.txt').read_text().startswith('Pixel Hero Maker [v.90]')
for f in (R/'diagnostics/v88').glob('PixelHero-v88-IdleAutoHandTrace*.json'):
 assert json.loads(f.read_text())['result']['build']=='Pixel Hero Maker [v.88]'
print('PASS v90 Web manifest, source references, and diagnostics')
print('NOTE: no user/gameplay or Windows GUI testing performed by this script')
