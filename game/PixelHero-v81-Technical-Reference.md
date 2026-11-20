# Pixel Hero Maker [v.81] — Experimental three-case native underlay technical reference

**Baseline:** v.80, accepted by the user on 2026-11-19 as working for the Cape/Back hand-color issue. v.80 WebGL.wasm SHA-256: `ca81e969c6cb6ea0c6cde67bf5006d526e948143583f2981d494082947d84cf4`. This reference supersedes v.80 only as the **experimental code branch**, not as a user-accepted replacement. Retain both distributions.

## Goals and evidence

The user provided `Items-For-Fix.zip` with 12 `Current`/`Fix` sprite pairs using a naked Human base and Bolt firearm. This release tests only three pairs: `Cape;Cape.png`, `Body;Fire Lizard.png`, and `Armor;Apache.png`. Using Unity's native texture geometry and cropped-export alignment, their zero-based coordinates within the first 64×64 idle cell are:

| Item | Operation | Native idle (x,y) | Live palette anchor |
|---|---|---|---|
| Cape > Cape | Add one opaque pixel | (27,17) | (27,18) |
| Body > Fire Lizard | Replace five pixels | (27,18), (26,19), (27,19), (26,20), (27,20) | (25,20), (29,19), (26,21) |
| Armor > Apache | Erase one pixel | (27,17) | none |

The color samples are from the CURRENT merged sprite, but the first experiment recognizes only source examples with their ORIGINAL palette via whole-idle-image fingerprints. Thus swatch preservation presently means *unsupported configurations are left untouched*, not that swatch variants are corrected. Neither the `Bolt` Unity Texture2D `pathID=49` nor standalone prototype item enum values are used as presumed live UI item IDs.

## Actual integrated native mechanism

New source: `prototype/native_underlay_v81.c` (compiled with Clang `--target=wasm32-unknown-unknown -O2 -nostdlib` into `native_underlay_v81.wasm`). Reproducible patcher: `patch_native_underlay_v81.py` applies only to the SHA-pinned original v.80 native module in `previous-v80.wasm`.

The patcher appends Wasm function **71935** with the same `(i32,i32,i32)->i32` function type index 1 as existing native helper 71934, appends mutable global **28** and exports `phm_underlay_status`. In `CharacterBuilder.Rebuild` function **5031**, after the original function **71933** and accepted Cape/Back-aware **71934** (unchanged bodies and ordering), one call passes the live ordered `List<Color32[]>`, last firearm `Color32[]` and diagnostic context. It runs **BEFORE** the original `22151` final Unity texture construction. All WebGL.data/framework/loader assets remain frozen v.80.

The helper checks managed list size 2–24, every array's 534,528-pixel length, and that the firearm is the final input. It verifies the full 64×64 source Bolt firearm alpha mask with FNV-1a `0x3dbe5bbd`, which independently differs from all 20 other source firearms with first-idle hand-marker geometry. It computes Unity's last-nontransparent-pixel composite from the **live** input arrays, normalizing alpha-254 hand-marker colors to avoid false palette mismatches. The first idle composite must equal exactly one of the normalized supplied `Current` fingerprints: Cape `0x851e5dc5`, Fire Lizard `0xc8432bdf`, Apache `0x94e70373`. If it doesn't, no array is modified.

For add/replace, it writes only the appropriate native idle pixels into the LAST non-firearm array and lets Unity's normal merge place the firearm above them. For erase, it clears the one target pixel in ALL non-firearm arrays, ensuring earlier layers cannot reappear. It refuses edits where the actual selected firearm array has nonzero alpha. No browser GPU texture rewrites or additional draw calls are used. This is a native **corrective compositing stage**, not an attempt to reconstruct omitted arms from native source104/108. Its effect is limited to reference-matched character appearance and is not assumed to generalize across equipment combinations.

Note: even though this stage behaves visually as an underlay, it **modifies narrowly selected pre-merge layer inputs** rather than inserting an additional allocated `Color32[]` into Unity's list. A separate allocated layer would require further management of Unity list ownership and is not claimed here.

## Status and diagnostics

`phm_underlay_status` in `Module.asm` reports the latest normal builder outcome: 1 Cape, 2 Fire Lizard, 3 Apache; -1 unexpected managed provenance; -2 non-Bolt first-idle alpha mask; -3 unmatched current first-idle fingerprint; -4 source color unavailable; -5 firearm-covered correction site; 0 uninitialized. The browser's `PixelHero-v81-IdleAutoHandTrace.json` includes this as `result.experimentalUnderlay`, and the system report includes it too. It is **not** a pixel-by-pixel GPU/export acceptance test; the provided `observedSpriteAtlas` remains a separate read-only observation and may be from a different rebuild.

## Tests, limitations, and follow-up

- The compiled helper passed six integration-style fixture tests: all three actual `Current` vs `Fix` targets matched at every non-marker pixel using real managed arrays/atlas dimensions; the firearm buffer was byte-unchanged and unrelated pixels stayed unchanged; altered weapon alpha masks skipped without writing. The previous prototype's 19 tests also passed.
- The six native v.80 hand pipeline-order tests and 17 Cape/Back reference tests passed unchanged. Full v.81 WASM compiled and validated. JavaScript syntax and inherited v.81 WebGL preview/export mock passed.
- These tests are **isolated native fixtures** and do not verify actual Unity calls, live palette/selection IDs, GPU atlas output, Windows GUI, user-saved downloaded ZIP basenames, or final human-clicked SpriteSheet.png exports. The user's accepted v.80 hand-color evidence is preserved as the stable comparison.
- The helper's fingerprint deliberately skips color swatches and unexpected outfit layering. A live `-3` may mean the source sprite differs from the supplied reference even when the expected item is selected; capture the unchanged sprite and v.81 trace before broadening guards.
- All remaining item pairs, including Dracula, other firearms, tail issues and non-idle animations are out of scope. Do not infer a universal geometry solution from the three-case fixture pass.

## Release discipline

Read `PIXEL_HERO_MAKER_PROJECT_RELEASE_RULES.md` before making follow-on changes. Deliver exact literal filenames with flat player ZIP roots, `Pixel Hero Maker [v.81]` launcher and browser title, `SpriteSheet.png` export default and unchanged user-named files. Keep `Changelog.txt` history intact. Windows launcher is compiled from the included Go source embedding the SAME `game/` tree as the Web ZIP. For all subsequent work, keep v.80 as accepted fall-back until actual v.81 gameplay confirms the underlay effect.
