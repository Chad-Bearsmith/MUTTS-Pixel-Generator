# Pixel Hero Maker [v.86] — Native underlay: real Furry/Werewolf swatch correction

**Starting game:** v85, WASM SHA256 `0830cef642be81c02ac40336363f598f762a88070ef73cf1af8b0eb7ac2a321e`. v84 remains the accepted default-color base; user reported all v85 recolored items working except Furry and Werewolf Body. v86 changes only existing native underlay function **71935**. The original native builder function **5031** and hand-color functions **71933/71934** are unchanged. Original `WebGL.data`, loader, framework and browser preview/export remain unchanged.

## Root cause, verified from actual user exports

`swatch_signature` in v85 used alpha plus exact equality of immediate left/up pixel RGB values, outside the union of all known firearm alpha shapes (255 occupied pixels in 64×64 first idle). The supplied `SpriteSheet.png` was Furry Body aligned at exported crop offset (22,5), and `SpriteSheet (1).png` was Werewolf Body offset (22,4). Both retain **identical per-pixel silhouette** to their original named item fixture outside the firearm union. Yet the following RGB-equality flags change on selecting a pink Body color:

- Furry Body: native idle positions (30,10), (35,10), (30,11), (35,11).
- Werewolf Body: native idle position (29,9).

The old helper applied zero corrections (status -3) because the v85 structural fingerprint included those relationships. The successful v80 hand-color routine is unrelated.

## Native change

v86 computes both the **unchanged original v85 structural fingerprint** and a secondary FNV fingerprint within the same scan. Only at the five listed positions, the secondary hash retains the original opaque/transparent bit but ignores equality-to-left and equality-to-above bits. If full structural matching fails, the secondary hash may identify **only Furry (ID 7)** or **Werewolf (ID 10)**. Both hashes are unique for those items across all 12 known templates. No other item can fall back through this relaxed signature. Reference signatures: `0x8c47b2b6` (Furry) and `0x31102402` (Werewolf).

All subsequent firearm occlusion, target-before-alpha, live sample source alpha checks, and native write operations are untouched. No browser postprocessing, fixed swatch colors, new weapon masks, or unrelated feature changes are introduced. Positive diagnostic results continue to use `5000 + gunID*100 + itemID` for swatch-aware matching; Bolt Furry = 5007 and Bolt Werewolf = 5010.

## Actual verification performed

The developer archive includes `swatch-repros/SpriteSheet.png`, `swatch-repros/SpriteSheet (1).png` and `prototype/test_native_v86_live_swatches.js` to reproduce the two real v85 failures in isolated native WASM memory. The v85 helper returns -3 for both; v86 returns 5007 and 5010. In these source-aligned fixtures only the known 4/6 patch sites are changed to palette-sampled colors. All other atlas pixels, including non-idle and firearm arrays, remain byte-identical. The extra native guard-mutation tests also return -7 without modifying the buffers.

Inherited checks: 1,802 compiled-WASM synthetic palette cases, 305 compiled-WASM firearm/item cases, six pipeline-order native tests, 17 Cape/Back native tests. Full game WASM compilation, JS syntax/mock, Windows/Web archive integrity and parity must also pass before release. These results are fixture tests, **NOT live v86 game acceptance**. Other actual swatches, combined outfits, native Windows gameplay and actual browser-saved file names are not independently verified.

## Reproducibility

From developer source directory: `python3 generate_swatch_underlay_v86.py`, then compile `prototype/native_underlay_v86.c` to WebAssembly using clang wasm32, `-O2 -nostdlib -Wl,--no-entry -Wl,--import-memory -Wl,--export=phm_native_underlay`. `python3 patch_native_underlay_v86.py` replaces native function 71935 only, starting from `previous-v85.wasm`. Run `node prototype/test_native_v86_live_swatches.js`, `node prototype/test_native_v86_swatches.js`, `node prototype/test_native_v86_inherited.js`, two historical hand-color test scripts and the browser mock, then `python3 build_release_v86.py && python3 verify_release_v86.py`. Both player ZIPs have flat roots and canonical literal-space names; development archive's `game/` folder is intentional.
