#!/usr/bin/env python3
"""Verify pinned Unity assets and the reproducible native development build."""
from pathlib import Path
import hashlib,json,sys
sys.dont_write_bytecode=True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import patch_native_alien_tail_v90 as tail
import patch_native_player_v91 as player
import patch_native_player_v93 as backpack
import patch_native_player_v95 as randomize
import patch_native_player_v96 as native_button
import patch_native_player_v97 as hand_fallback
import patch_native_player_v98 as body_mask
import patch_native_player_v99 as armed_body
import patch_native_player_v100 as hide_presets
import patch_native_player_v101 as reset_editor
import patch_native_player_v103 as remove_presets
import patch_native_player_v105 as export_button
R=Path(__file__).resolve().parents[1]
H=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
EXPECTED={
  'baselines/previous-v87.wasm':'0c47dc29fec0446fa5e8',
  'baselines/previous-v88.wasm':'12e3640b5f08041ed6fc',
  'game/Build/WebGL.wasm':'77710564f08b5e00',
  'game/Build/WebGL.data':'4f5ca8b0a0fa4fc894ae',
}
for name,prefix in EXPECTED.items():
 p=R/name
 assert p.is_file(),f'Missing {name}'
 actual=H(p)
 assert actual.startswith(prefix),f'Imported baseline mismatch {name}: {actual}'
 print('PASS pinned',name,actual[:20])
for name in ['AGENTS.md','docs/MUTTS_PIXEL_GENERATOR_PROJECT_RELEASE_RULES.md','docs/CODEX_HANDOFF.md','docs/GITHUB_SETUP.md','prototype/native_underlay_v89.c','prototype/native_underlay_v89.wasm','tests/v89-uploaded-layer-fixtures.json','references/Fix/Armor;Dracula.png','game/index.html','game/Changelog.txt']:
 assert (R/name).is_file(),f'Missing {name}'
old=json.loads((R/'game/MUTTS-v89-Build-Manifest.json').read_text())
assert old['sourceV88WasmSHA256']==H(R/'baselines/previous-v88.wasm')
baseline=tail.v89_baseline()
assert old['newNativeWasmSHA256']==tail.sha256(baseline)
baseline=player.v90.build()
v92_native=player.build()
assert tail.sha256(baseline)==player.PINNED_PLAYER_V90
baseline_sections=dict(tail.v89.sections(baseline))
v92_sections=dict(tail.v89.sections(v92_native))
assert baseline_sections.keys()==v92_sections.keys()
assert all(baseline_sections[sid]==v92_sections[sid] for sid in baseline_sections if sid not in (3,10))
old_bodies=tail.v89.code_bodies(baseline_sections[10])
new_bodies=tail.v89.code_bodies(v92_sections[10])
assert len(new_bodies)==len(old_bodies)+1
assert [i+tail.v89.DEF_FUNCS for i,(a,b) in enumerate(zip(old_bodies,new_bodies)) if a!=b]==[5031,71935]
assert new_bodies[71935-tail.v89.DEF_FUNCS]==tail.v89.body_from_helper(player.UNDERLAY_HELPER)
assert new_bodies[-1]==player.optional_overlay_lookup(old_bodies[player.LOOKUP-tail.v89.DEF_FUNCS])
print('PASS pinned v90 player, v91 underlay, and native function diff')
v94_native=backpack.build()
v94_sections=dict(tail.v89.sections(v94_native))
assert v94_sections.keys()==v92_sections.keys()
assert all(v94_sections[sid]==v92_sections[sid] for sid in v92_sections if sid!=10)
v94_bodies=tail.v89.code_bodies(v94_sections[10])
assert len(v94_bodies)==len(new_bodies)
assert [i+tail.v89.DEF_FUNCS for i,(a,b) in enumerate(zip(new_bodies,v94_bodies)) if a!=b]==[71935]
print('PASS v93 changes only the native underlay function')
v95_native=randomize.build()
v95_sections=dict(tail.v89.sections(v95_native))
assert v95_sections.keys()==v94_sections.keys()
assert all(v95_sections[sid]==v94_sections[sid] for sid in v94_sections if sid not in (3,6,7,10))
v95_bodies=tail.v89.code_bodies(v95_sections[10])
assert len(v95_bodies)==len(v94_bodies)+1
assert [i+tail.v89.DEF_FUNCS for i,(a,b) in enumerate(zip(v94_bodies,v95_bodies)) if a!=b]==[5032,50008]
print('PASS v95 adds one palette accessor and changes only CharacterEditor.Start and CharacterEditor.Rebuild')
v96_native=native_button.build()
v96_sections=dict(tail.v89.sections(v96_native))
assert v96_sections.keys()==v95_sections.keys()
assert all(v96_sections[sid]==v95_sections[sid] for sid in v95_sections if sid not in (6,7,10))
v96_bodies=tail.v89.code_bodies(v96_sections[10])
assert len(v96_bodies)==len(v95_bodies)
assert [i+tail.v89.DEF_FUNCS for i,(a,b) in enumerate(zip(v95_bodies,v96_bodies)) if a!=b]==[17081]
print('PASS v96 only modifies the native Button.Press body and adds UI exports and globals')
v97_native=hand_fallback.build()
v97_sections=dict(tail.v89.sections(v97_native))
assert v97_sections.keys()==v96_sections.keys()
assert all(v97_sections[sid]==v96_sections[sid] for sid in v96_sections if sid not in (3,10))
v97_bodies=tail.v89.code_bodies(v97_sections[10])
assert len(v97_bodies)==len(v96_bodies)+1
assert [i+tail.v89.DEF_FUNCS for i,(a,b) in enumerate(zip(v96_bodies,v97_bodies)) if a!=b]==[5031]
assert v97_bodies[-1]==tail.v89.body_from_helper(hand_fallback.HELPER)
print('PASS v97 adds one hand fallback at the existing native builder call site')
v98_native=body_mask.build()
v98_sections=dict(tail.v89.sections(v98_native))
assert v98_sections.keys()==v97_sections.keys()
assert all(v98_sections[sid]==v97_sections[sid] for sid in v97_sections if sid!=10)
v98_bodies=tail.v89.code_bodies(v98_sections[10])
assert len(v98_bodies)==len(v97_bodies)
assert [i+tail.v89.DEF_FUNCS for i,(a,b) in enumerate(zip(v97_bodies,v98_bodies)) if a!=b]==[5031,71936]
assert v98_bodies[body_mask.TAIL-tail.v89.DEF_FUNCS]==tail.v89.body_from_helper(body_mask.HELPER)
print('PASS v98 changes only the body mask helper and its builder call sites')
v99_native=armed_body.build()
v99_sections=dict(tail.v89.sections(v99_native))
assert v99_sections.keys()==v98_sections.keys()
assert all(v99_sections[sid]==v98_sections[sid] for sid in v98_sections if sid not in (3,10))
v99_bodies=tail.v89.code_bodies(v99_sections[10])
assert len(v99_bodies)==len(v98_bodies)+1
assert [i+tail.v89.DEF_FUNCS for i,(a,b) in enumerate(zip(v98_bodies,v99_bodies)) if a!=b]==[5031]
assert v99_bodies[-1]==tail.v89.body_from_helper(armed_body.HELPER)
print('PASS v99 adds one armed Body helper and its builder call site')
v100_native=hide_presets.build()
v100_sections=dict(tail.v89.sections(v100_native))
assert v100_sections.keys()==v99_sections.keys()
assert all(v100_sections[sid]==v99_sections[sid] for sid in v99_sections if sid!=7)
print('PASS v100 adds one Unity export and preserves every native function body')
v101_native=reset_editor.build()
v101_sections=dict(tail.v89.sections(v101_native))
assert v101_sections.keys()==v100_sections.keys()
assert all(v101_sections[sid]==v100_sections[sid] for sid in v100_sections if sid not in (6,7,10))
v101_bodies=tail.v89.code_bodies(v101_sections[10])
assert len(v101_bodies)==len(v99_bodies)
assert [i+tail.v89.DEF_FUNCS for i,(a,b) in enumerate(zip(v99_bodies,v101_bodies)) if a!=b]==[reset_editor.BUTTON_PRESS]
print('PASS v101 changes only Unity Button.Press and adds Reset globals and exports')
v104_native=remove_presets.build()
v104_sections=dict(tail.v89.sections(v104_native))
assert v104_sections.keys()==v101_sections.keys()
assert all(v104_sections[sid]==v101_sections[sid] for sid in v101_sections if sid!=7)
print('PASS v103 adds preset cleanup exports and preserves every native function body')
active=(R/'game/Build/WebGL.wasm').read_bytes()
assert active==export_button.build()
active_sections=dict(tail.v89.sections(active))
assert active_sections.keys()==v104_sections.keys()
assert all(active_sections[sid]==v104_sections[sid] for sid in v104_sections if sid not in (6,7,10))
v104_bodies=tail.v89.code_bodies(v104_sections[10])
active_bodies=tail.v89.code_bodies(active_sections[10])
assert len(active_bodies)==len(v104_bodies)
assert [i+tail.v89.DEF_FUNCS for i,(a,b) in enumerate(zip(v104_bodies,active_bodies)) if a!=b]==[export_button.BUTTON_PRESS]
print('PASS v105 changes only Unity Button.Press and adds Export globals and exports')
m=json.loads((R/'game/MUTTS-v105-Build-Manifest.json').read_text())
v104=json.loads((R/'game/MUTTS-v104-Build-Manifest.json').read_text())
v103=json.loads((R/'game/MUTTS-v103-Build-Manifest.json').read_text())
v102=json.loads((R/'game/MUTTS-v102-Build-Manifest.json').read_text())
v101=json.loads((R/'game/MUTTS-v101-Build-Manifest.json').read_text())
v100=json.loads((R/'game/MUTTS-v100-Build-Manifest.json').read_text())
v99=json.loads((R/'game/MUTTS-v99-Build-Manifest.json').read_text())
v98=json.loads((R/'game/MUTTS-v98-Build-Manifest.json').read_text())
v97=json.loads((R/'game/MUTTS-v97-Build-Manifest.json').read_text())
v96=json.loads((R/'game/MUTTS-v96-Build-Manifest.json').read_text())
v95=json.loads((R/'game/MUTTS-v95-Build-Manifest.json').read_text())
v94=json.loads((R/'game/MUTTS-v94-Build-Manifest.json').read_text())
v93=json.loads((R/'game/MUTTS-v93-Build-Manifest.json').read_text())
v92=json.loads((R/'game/MUTTS-v92-Build-Manifest.json').read_text())
assert v94['unityAssets']==v93['unityAssets']
assert v102['unityAssets']==v101['unityAssets']
assert v104['unityAssets']==v103['unityAssets']
assert m['sourceV104PlayerWasmSHA256']==tail.sha256(v104_native)==v104['newNativeWasmSHA256']
assert m['sourceV102PlayerWasmSHA256']==tail.sha256(v101_native)==v102['newNativeWasmSHA256']
assert m['sourceV100PlayerWasmSHA256']==tail.sha256(v100_native)==v100['newNativeWasmSHA256']
assert m['sourceV99PlayerWasmSHA256']==tail.sha256(v99_native)==v99['newNativeWasmSHA256']
assert m['sourceV98PlayerWasmSHA256']==tail.sha256(v98_native)==v98['newNativeWasmSHA256']
assert m['sourceV97PlayerWasmSHA256']==tail.sha256(v97_native)==v97['newNativeWasmSHA256']
assert m['sourceV96PlayerWasmSHA256']==tail.sha256(v96_native)==v96['newNativeWasmSHA256']
assert m['sourceV95PlayerWasmSHA256']==tail.sha256(v95_native)==v95['newNativeWasmSHA256']
assert m['sourceV94PlayerWasmSHA256']==tail.sha256(v94_native)==v94['newNativeWasmSHA256']
assert {n:h for n,h in m['unityAssets'].items() if n!='Build/WebGL.wasm'}=={n:h for n,h in v92['unityAssets'].items() if n!='Build/WebGL.wasm'}
assert m['sourceV92PlayerWasmSHA256']==v92['newNativeWasmSHA256']==tail.sha256(v92_native)
assert m['underlayHelperWasmSHA256']==H(backpack.UNDERLAY_HELPER)
assert m['handFallbackWasmSHA256']==H(hand_fallback.HELPER)
assert m['bodyMaskWasmSHA256']==H(body_mask.HELPER)
assert m['armedBodyWasmSHA256']==H(armed_body.HELPER)
assert m['newNativeWasmSHA256']==H(R/'game/Build/WebGL.wasm')
assert set(m['activeScripts'])=={p.name for p in (R/'game').glob('*.js')}
assert set(m['activeCss'])=={p.relative_to(R/'game').as_posix() for p in (R/'game').rglob('*.css')}
for group in ('unityAssets','activeScripts','activeCss'):
 for n,h in m[group].items():
  assert H(R/'game'/n)==h,f'Manifest mismatch {n}'
assert H(R/'game/index.html')==m['entryHTMLSHA256']
title=f'MUTTS Pixel Generator [{m["version"]}]'
assert f'<title>{title}</title>' in (R/'game/index.html').read_text()
assert f'productName: "{title}"' in (R/'game/index.html').read_text()
assert f'productTitle = "{title}"' in (R/'main.go').read_text()
assert (R/'game/Changelog.txt').read_text().startswith(title)
# Imported traces retain their original producer identity.
for f in (R/'diagnostics/v88').glob('PixelHero-v88-IdleAutoHandTrace*.json'):
 assert json.loads(f.read_text())['result']['build']=='Pixel Hero Maker [v.88]'
print('PASS v105 Web manifest, product titles, source references, and diagnostics')
print('NOTE: no user/gameplay or Windows GUI testing performed by this script')
