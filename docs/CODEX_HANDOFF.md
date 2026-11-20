# Pixel Hero Maker — technical handoff to Codex

**Prepared:** 2026-11-20  
**Imported runtime:** experimental `Pixel Hero Maker [v.89]`  
**Safeguarded reference:** `previous-v87.wasm` (the last source version with newly user-confirmed palette cases); full v.87 Web release is preserved separately as the original `Pixel Hero Maker [v.87] (Web).zip` download, not committed inside this source repo.  
**Important:** The user has not yet confirmed the v.89 geometry changes in live gameplay. In this imported snapshot, v.89 is an experimental branch, not a new accepted baseline.

## 1. What the product is

A Unity WebGL-based offline pixel-hero character/sprite builder with equipment categories, color swatches, firearms, animated sprite export, and a Windows Go launcher that embeds the Web build. Work has been performed on compiled Unity WebAssembly, JavaScript renderer/diagnostics, and original Unity-derived asset masks. **No original Unity Editor C# project is present in the supplied developer archive.**

All source/asset/diagnostic files here were imported from `PixelHero-v89-Development-Source.zip` plus previously uploaded v.87/v.88 diagnostics and five latest v.88 exported PNGs. They are immutable evidence unless the user explicitly instructs otherwise.

## 2. Confirmed history (what the user actually accepted)

| Version | Result and confidence |
|---|---|
| v.80 | **User confirmed** Cape/Back-aware automatic firearm hand color. Older hand routine runs first, newer one has last priority. |
| v.81 | **User confirmed** native correction operations for Cape add, Fire Lizard replace, Apache erase on naked Human + Bolt. |
| v.82 | **User confirmed** all 12 Bolt item templates with default reference colors. |
| v.83 | Multi-firearm experimental expansion; user reported it worked except Crossbow and Shotgun. |
| v.84 | **User confirmed** Crossbow and marked Shotgun asset mask recognition; previously reported weapon exceptions resolved. |
| v.85 | Swatch-aware recognition introduced; initial exceptions found for Furry and Werewolf. |
| v.86 | Added fallback for Furry/Werewolf swatches; later found four other palette combinations and equipment issues. |
| v.87 | **User confirmed** four palette cases: Fire Lizard option 12, Lizard option 12, Werewolf options 4 and 19. Other equipped item and Cape/Back hand cases remained broken. |
| v.88 | Source-layer recognition experiment; user supplied five new failing screenshots/traces. Not accepted as a universal fix. |
| v.89 | New four uniquely identified primary-source fallback paths; **only synthetic/native tests passed**; awaits user live gameplay confirmation. Cape/Back hand-color bug intentionally still unresolved. |

Historical technical references are in `game/PixelHero-v80...v89-Technical-Reference.md`. Follow those source details rather than treating the summaries as code-level proof.

## 3. Native architecture and fixed references

- Unity idle frame: top-left origin, 64x64, first idle tile at atlas `(x=0,y=64)` in a 576x928 atlas.
- WASM native builder: `CharacterBuilder.Rebuild`; helper 71935 handles underlay corrections. The accepted v.80 hand-color function bodies are 71933 and 71934, kept in that order.
- Firearms: 24 source firearm IDs, 25 known alpha-mask variants (marked Shotgun separate from an unmarked duplicate). Crossbow name may begin with Cyrillic-looking `С`, not Latin `C`.
- 12 supported item templates: Armor Alien, Angel, Apache, Dracula; Body Fire Lizard, Furry, Lizard, Merman, Werewolf; Cape Cape; Helmet Hellsing, Snow Rider.
- Corrections may add, replace, or erase a pixel; they must remain behind visible firearm artwork and respect foreground equipment. Apache's erase requires true clearing rather than a transparent overlay.
- Existing fallback recognition uses palette-invariant fingerprints and later v.88/v.89 source-layer matching when composite-based recognition skips.
- Accepted release convention: exact visible title `Pixel Hero Maker [v.N]`, export default `SpriteSheet.png`, Windows `Pixel Hero Maker [v.N].zip`, Web `Pixel Hero Maker [v.N] (Web).zip`, flat ZIP roots. See the full rules file.

## 4. Current v.89 implementation and remaining limits

File `game/PixelHero-v89-Technical-Reference.md` details exactly which native function changed and how. Specifically, v.89 recognizes four item primary alpha masks independently when Unity omits otherwise expected companion textures:

| Item | Bolt source-layer status | Known patch |
|---|---:|---|
| Apache Armor | `8003` | one transparent erase at `(27,17)` |
| Alien Armor | `8004` | four existing template pixels |
| Dracula Armor | `8006` | sixteen existing template pixels |
| Furry Body | `8007` | four existing template pixels |

Tested using the user's five v.88 layer snapshots, of which four are uniquely identifiable. The fifth remains safely skipped due to ambiguous identity. The tests synthesize unsampled RGBA bytes: **they do not prove pixel-perfect final rendered exports**.

The first-match exact/swatch-aware routes are retained. The user has not yet accepted this version in live Unity. Do not remove the safe skip for Snow Rider: its donor alpha mask is shared by 64 source assets in the existing inventory and needs additional verified identity evidence.

## 5. Remaining bug A: Cape/Back hand-marker colors

Two uploaded traces, `diagnostics/v88/PixelHero-v88-IdleAutoHandTrace (3).json` and `(4).json`, record automatic hand status **2**, `source104Fresh=true`, `source108Fresh=false`, `source108OptionalAbsentProven=false`, `source108SelectedButUnavailable=true`. In the red Cape case `(4)`, the observed seven alpha-254 marker RGBs are `(234,50,60)` while source104 bare arm samples are `(246,202,159)`.

The older hand routine's result can leak through when the newer v.80 source guard skips. It is not safe to unconditionally repaint these hands with skin color: sleeves/gloves/armor may legitimately determine hand RGB. Determine actual source108 provenance and selected arm layer behavior, then modify hand selection cautiously with regression tests.

Other v.88 traces `(1)`, `(2)` have successful native hand status 1 and source108 available or proven optional, so should be negative controls. `diagnostics/v88/PixelHero-v88-IdleAutoHandTrace.json` is another successful optional-absence control.

## 6. Remaining bug B: equipment interferes with underlay recognition

Additional armor, helmets, cape, back, etc. change layer arrangements. Earlier composite fingerprints skipped with `-3` and correction site alpha guard with `-7`. v.88 introduced source recognition but often incorrectly demanded companion textures that Unity omitted; v.89 relaxes those four cases only when source alpha uniquely identifies the item. Some arrangements still remain unconfirmed or unfixable without item-selection evidence. Do not unconditionally match visually identical shapes.

User screenshots are in `diagnostics/v88/exports/` and reference true targets in `references/Current` and `references/Fix`. The five screenshots map to the five v.88 traces by matching basename suffix (`SpriteSheet.png` to base trace, `(1)` to trace `(1)`, etc.), as uploaded. If precise selection provenance is not in the trace, do not infer it from visual resemblance alone.

## 7. Tests and releases

The v.89 technical reference reports 126 source-item assertions, 305 cross-firearm checks, 1,802 synthetic swatches, and 23 hand-color checks. These are **historical tests** and are not fresh outcomes until re-run in a new environment. `scripts/run_tests.py` can run a smoke suite and the fuller native suites; results are distinct from a real interactive Unity/Web/Windows test.

`previous-v87.wasm` is a byte-identical reference to the v.87 released Web WASM, `previous-v88.wasm` is byte-identical to the v.88 released Web WASM, and `game/Build/WebGL.wasm` is byte-identical to the v.89 released Web WASM in the supplied archives. Hashes are pinned and validated in `scripts/verify_repository.py`.

The compiled Unity `WebGL.data` and other assets are present under `game/Build`. Do not treat the native C helper or reconstructed assets as the whole original Unity source code.

## 8. Safe first Codex task

**Investigation only; no edits:** Read the v.89 native patcher, helper, the five v.88 diagnostic JSON files, user PNGs, and original source index. Compare positive and negative native layer matches and the hand-source108 selected-but-unavailable state. Produce a fact-checked plan with tests for both bugs. Keep the v.87 accepted behavior preserved and the v.89 candidate labeled experimental. Only after review should a v.90 candidate be implemented.

## 9. Handoff limitations

- No direct access from Codex to this ChatGPT Project's entire history should be assumed. This handoff and the included files supply necessary technical context, not every conversation turn.
- No Unity Editor project/source, GitHub repository, or completed live v.89 test was supplied.
- Native Windows gameplay and client-downloaded archive basenames are not established by isolated tests; don't claim otherwise.
- Native support masks and compiled WASM are source-provenance inputs, not evidence that all combinations work.
