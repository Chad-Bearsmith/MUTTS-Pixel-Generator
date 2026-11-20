# Pixel Hero Maker [v.80] — Current Technical Reference and Future-Chat Handoff

**Current authoritative player baseline:** `Pixel Hero Maker [v.80]` (derived from v.79 on November 19, 2026). Keep this file, the release rules, the root changelog, the Windows/Web ZIPs, and the v80 developer source together for further work. Earlier v78 and v79 references remain valuable historical evidence, but **do not restart from them** after v80.

## 1. Purpose and confirmed source of the v79 hand-color failure

The user's v79 live gray-backpack/green-body AK-47 image (`SpriteSheet.png`) and subsequent fresh `SpriteSheet (1).png` are byte-for-byte identical PNGs (440x440, SHA-256 `ce4e1602813c83a96c785fa16efa048accc3f5ba5eb57be0a3940a7e001ccb8d`). Both contain exactly seven alpha-254 firearm hand-marker source pixels colored **RGBA (146,161,185,254)** (each pixel enlarged 20× in the export), matching backpack gray. Neither contains the **(153,230,95)** green selected reference. The user's `PixelHero-v79-IdleAutoHandTrace.json` reported native status 1, source104 fresh, source108 legitimately absent, all seven markers changed, and reference RGBA **(153,230,95,255)**. These facts established a disconnect between native status and final output; the trace by itself is NOT proof that the final sprite was fixed.

Disassembly of v79 `CharacterBuilder.Rebuild` (WASM function **5031**) explains it:

- `0x158892`: call Unity's final builder merge 2608.
- **`0x15889d`: call native 71934** — newer v76/v79 current-swatch-aware firearm-free hand reference reconstruction and first-idle alpha-254 marker writer. The v79 extension excludes Back and Cape for reference only.
- **`0x1588ae`: call native 71933** — original compiled Unity hand-color routine. The original routine is NOT read-only: it independently reads the original layer list and rewrites the firearm's alpha-254 markers using an **unfiltered** reference. Back/Cape pixels can therefore overwrite the newer correction AFTER the newer routine has reported status 1.

Two-function isolated native WASM fixtures reproduced this exact result: helper71934 then handler71933 leaves the unfiltered gray, while handler71933 then helper71934 produces selected green. No additional browser color correction is necessary for that documented failure mechanism.

## 2. The minimal v80 native change

The **only native WASM difference from v79 is a fixed-length, 27-byte call-order substitution** within builder function 5031. The exact 27-byte old sequence begins at file offset `0x158897`; all other WebAssembly bytes are identical to v79, including functions 71933 and 71934 and all Unity layer-building and merging logic.

**v79:** final merge → 71934 (Cape/Back-aware) → diagnostic bookkeeping → 71933 (older unfiltered recolor) → texture creation.

**v80:** final merge → 71933 (older unfiltered recolor) → 71934 (Cape/Back-aware) → same diagnostic bookkeeping → texture creation.

The original older routine still runs, including its historical behavior in other atlas cells. The newer helper gets the final write **only on its verified 7/9 first-idle hand-marker pixels**; it does not alter the remaining weapon pixels, other inputs or geometry. If the helper fails closed (missing/incorrect provenance, transparent reference, unsupported markers), the original Unity routine retains its preexisting behavior; do not assert no recoloring occurs on failure because the legacy native routine still runs.

This ordering deliberately avoids eliminating the older routine, disrupting its other-frame behavior, or changing any source/arm/glove data. `patch_v80_order.py` holds the reproducible patch and validates the exact v79 WASM SHA-256 before it writes the new file. The known v79 baseline SHA-256 is `bd4d590e6fee21af136e02c6b14fb275973ee01b9b99b688dc0613dbe0830676`. The resulting v80 WASM SHA-256 is `ca81e969c6cb6ea0c6cde67bf5006d526e948143583f2981d494082947d84cf4`. The `.data`, `.framework.js`, and `.loader.js` binaries remain unchanged from v79.

## 3. Native v79 reference algorithm — must remain intact

Unity 2021.3.45f1 / IL2CPP uses a 576×928 Color32 atlas and a first idle 64×64 cell at top-down x 0–63, y 64–127. The specified hand reference is at one-based (28,20), zero-based (27,19), original compiled atlas array index **486171**.

The current v79 native function71934 handles source104 (required base arms) and optional source108 (clothing/gloves) generated in the current armed rebuild using the live selections and swatches. It reconstructs the genuine firearm-free source color; when selecting the reference at (27,19), it skips only native builder source pointers with **Back tag101** and **Cape tag111** (both verified by provenance pointer equality). It does NOT remove their pixels from the final sprite and does NOT use skin-tone guesses, old unarmed caches or a manual outfit selector. It validates the reference and 7/9 alpha-254 marker count before replacing marker RGB only, preserving their alpha 254. Preserve genuine black as a legal color and the explicit optional-source108-absent path (v76 accepted behavior).

The implementation of source104/108 and 71934 was not altered by v80. The historic v76 user tests accepted green bare arms and gray gloves in the first idle. The first idle is the only requested correction target; animation playback stays disabled. Source 104/108 handles hand color, NOT missing silhouette geometry or tails.

## 4. Browser flow, diagnostic cross-check and export

Six browser modules load before the Unity loader:

1. `phm-static-idle.js`: obtains the observed 576×928 Unity GPU-uploaded atlas, extracts top-down first idle, paints the browser preview and exports a cropped/squared, nearest-neighbor 20× PNG named `SpriteSheet.png` unless the user chose a custom name.
2. `phm-preview-inline.js`: suppresses duplicate Unity SpriteRenderer draws while browser static idle preview is ready.
3. `phm-compositor-probe.js`: read-only WebGL2 texture-upload/draw observer retaining bounded atlas copies. No upload modifications or geometry fixers.
4. `offline-ui.js`: offline UI support.
5. `phm-v76-layer-provenance.js`: read-only native status, original-vs-armed source-array diagnostics, and optional PNG/JSON provenance exports. In v80 the automatic trace ALSO includes `observedSpriteAtlas`, a read-only sampling of current atlas first-idle alpha-254 marker RGB and whether it matches the native reference. Note: this is the last observed SpriteRenderer atlas and is not *guaranteed* to correspond to the same native rebuild as the diagnostic metadata. Have the user change a selection, let the visual atlas update, then capture.
6. `phm-diagnostics-ui.js`: read-only system report and panel.

The complete v78 browser geometry/skin/tail patchers were physically removed and remain absent. The v80 correction is **native**, not a WebGL or browser-side pixel repaint. The Web browser preview/export remain browser presentation interventions, not a raw native renderer. Normal export is a cropped, squared 20× single first-idle PNG; the output can be 440×440 rather than 1280×1280.

## 5. Evidence, tests, and limitations

**Confirmed before v80:** the user-supplied PNGs and v79 native status disagree as documented above; the compiled older routine 71933 writes marker RGB and comes AFTER v79 helper; simulated execution of both unchanged compiled routines reproduces the overwrite.

**Validated for v80:** `tests/test_native_pipeline_order.js` verifies both call orders against the exact compiled 71933 and 71934 function bodies with Back only, Cape only, both, opaque black body, optional gray glove108, no excluded categories and 7/9 marker variants. Markers have the intended RGB and preserved alpha 254 at the end of the new order; non-marker firearm bytes do not change in these fixtures. The preexisting 17 isolated native helper regression tests are still included. `node --check` on all JS and full WebAssembly `WebAssembly.validate/compile` are mandatory. `tests/test_clean_v79.js` remains a reusable v79-branded simulated preview/upload test and must not be misconstrued as live gameplay.

**NOT verified**: actual Unity/WebGL gameplay in a real graphical browser for v80; actual Windows GUI/browser title or Save/Export UI on Windows; every firearm/outfit/swatch combination, the actual user-visible downloaded ZIP basenames. A compiled module/simulated fixture or matching native status is NOT a live acceptance test. The user should re-export the previously failing gray Back + green body AK-47 character in v80, compare the first idle marker RGB, and optionally download `PixelHero-v80-IdleAutoHandTrace.json` to check BOTH `referenceColor` and `observedSpriteAtlas`.

**Unresolved and not part of v80:** firearm-dependent omission of arm/clothing geometry, body silhouette gaps, tail issues, non-idle animations. The proposed native firearm-underlay geometry technique has **not** been implemented or evaluated as a fix. Do not introduce it under a hand-color version without explicit direction.

## 6. Release reproducibility, integrity and filenames

Always read `PIXEL_HERO_MAKER_PROJECT_RELEASE_RULES.md` and `Changelog.txt` before editing. Canonical player archives:

- Windows: **`Pixel Hero Maker [v.80].zip`**, root includes **`Pixel Hero Maker [v.80].exe`** plus README/changelog/reference/manifest. Executable is compiled with Go and embeds the exact v80 Web files. The launcher opens localhost and its console remains open.
- Web: **`Pixel Hero Maker [v.80] (Web).zip`**, root contains `index.html`, `Build/`, `TemplateData/`, active JS/CSS, README, changelog, manifest and this reference. No outer wrapper directory.
- Developer: `PixelHero-v80-Development-Source.zip` contains `game/`, Go source, v79 baseline WASM (`previous-v79.wasm`), the v80 patch, tests and reproducibility instructions. The development ZIP intentionally has a `game/` subdirectory.

Window/tab title EXACTLY `Pixel Hero Maker [v.80]`; default sprite export `SpriteSheet.png`, preserving custom user filenames. Deliver literal (not URL-encoded/underscored) filenames. Inspect actual final ZIP contents, ZIP CRCs, source hashes and Windows embedded Web parity; separately report saved basename testing as PASS, FAIL or NOT TESTED. For exact hashes see `PixelHero-v80-Build-Manifest.json`.
