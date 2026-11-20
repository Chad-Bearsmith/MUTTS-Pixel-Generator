# Pixel Hero Maker [v.87] — Guarded swatch exceptions and diagnostic helmet-layer provenance

**Baseline:** Exact v86 game WebAssembly SHA256 `d3176bb11e042b2633bc81a55b700f9aa625f8d58cbfff08330dfc9b7de30c9c`; only existing corrective helper **71935** changed inside the compiled module. The approved native hand-color functions **71933/71934**, builder **5031**, Unity data, framework, loader, and final merge behavior are unchanged. Browser `phm-v76-layer-provenance.js` adds a read-only snapshot to the automatic diagnostic; no pixel upload or browser correction writer is introduced.

## User-reported failures, confirmed from supplied live v86 artifacts

All nine trace files show `experimentalUnderlay.status=-3` (whole-character exact and palette-structural matching failed), while the separate hand-color routine reports `status=1` and the GPU atlas agrees on all seven hand-marker colors. Nine 20x-nearest-neighbor sprite sheets align uniquely against the immutable Bolt firearm source, enabling original 64x64 first-idle coordinates. Four cases have the exact original corresponding alpha silhouette outside the 255-pixel union of known firearm masks:

| Item / user palette option | Rejected equal-color sites (0-based x,y) | v87 expected Bolt result |
|---|---|---|
| Fire Lizard Body / 12 | (32,12), (32,13) | 5002 |
| Lizard Body / 12 | (33,13) | 5008 |
| Werewolf Body / 4 | (29,9), (31,12), (31,13), (35,13) | 5010 |
| Werewolf Body / 19 | (29,9), (36,13) | 5010 |

The Werewolf union comprises five sites. These are equality-to-left/up bits, *not visible sprite pixels being added or painted*. No original underlay patch coordinates changed. Underlying palette-adjusted colors are sampled from the existing source as in v86. All other sample/target shape guards and per-weapon alpha checks are retained.

## Helmet limitation — reason for additional diagnostics

The other five supplied exports include Astronaut Helmet overlapping different underlying items. The former whole-character hash cannot distinguish which Body/Armor or accessory was selected once the helmet covers its distinguishing silhouette; simply masking the head can cause a collision (e.g., Apache versus Alien). Applying corrections on an alpha-only guess would damage other items. v87 intentionally does **not** claim those combinations fixed. A later implementation should identify the selected category or its independently appended source array from live native append provenance, and protect any foreground helmet pixels in addition to firearms.

The standard automatic idle trace now includes `underlaySourceLayers`, a read-only summary of the existing native copy of the most recent equipped builder input arrays, including their 4096-bit alpha shapes (1024 hex chars per layer), seven known sample coordinates per layer, append-site IDs and matched final slots. A fresh rebuild is required; if no eligible native array snapshot exists, the field shows `available:false` and a reason. Native append-site numbers are not assumed to be UI category IDs. Comparing this field with and without an equipped helmet, holding the selected target item, its swatch, and firearm constant, is the next required layer-identity experiment.

## Reproducibility

Developer archive contains the four real v86 PNGs, source-aligned 64x64 NumPy frames, the full v86 source and v87 helper source, the original 25-weapon mask fixture, generator `generate_swatch_underlay_v87.py`, patcher `patch_native_underlay_v87.py`, and JavaScript verification scripts.

Regenerate via `python3 generate_swatch_underlay_v87.py`, compile `prototype/native_underlay_v87.c` using `clang --target=wasm32 -O2 -nostdlib -Wl,--no-entry -Wl,--import-memory -Wl,--export=phm_native_underlay`, patch the exact `previous-v86.wasm` using `python3 patch_native_underlay_v87.py`, then test and rebuild Windows/Web from the new source tree. No module changes aside from function 71935 and the observational JavaScript are permitted.

### Validation and limitations

Compiled-native: 54 checks reproducing four real failed v86 exports, 305 prior firearm/item cases, 1,802 synthetic swatch cases; browser snapshot mock verifies read-only behavior, header and provenance checks, byte-preservation. The 23 inherited hand-color regression checks, JavaScript mock, WASM validation, asset hashes, archive and launcher parity must be separately completed before release. These tests do not constitute live Unity v87 acceptance, native Windows GUI testing, real helmet item identity verification, or verification of the user-facing saved ZIP basenames. Negative status -3 for unsupported overlap is deliberate and preferred to a destructive guess.
