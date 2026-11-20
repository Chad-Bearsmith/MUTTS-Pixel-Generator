# Pixel Hero Maker [v.85] — Swatch-aware underlay experiment

**Code baseline:** The exact user-accepted v.84 Windows/Web game, native
WebAssembly SHA-256 `d7e7e32fbcf19dc72823393da235b726e03426e5d631805dce3767b8c66a63eb`.
Only WebAssembly function 71935 changed; CharacterBuilder function 5031 and
native hand routines 71933/71934 are unchanged, as are the original
WebGL.data, framework, loader and the static preview/export behavior.

## Mechanism

1. Validate Unity's actual managed layer arrays and the original firearm mask
   exactly as in v.84 (24 firearm identities, 25 original RGBA alpha variants).
2. Keep the v.84 exact RGB item recognition, native color sampling, per-pixel
   firearm precedence, and 12 accepted corrective operations first.
3. For otherwise unrecognized/recolored configurations, compute a 32-bit
   FNV-1a *structural* fingerprint of the 64×64 first-idle character beneath
   the firearm. Ignore all 255 pixels covered by the union of known firearm
   alpha silhouettes. For each remaining position hash an opaque/transparent
   bit plus equality of the current RGB to the immediately left/above visible
   character pixel, when that neighbor is outside the same firearm union.
   This fingerprint recognizes preserved color-shade boundaries regardless of
   the literal palette value. Color-boundary collapse or a new outfit may not
   match and intentionally returns -3.
4. Two reference pairs share the same exposed fingerprint: Apache/Alien Armor
   and Cape/Dracula Armor. Disambiguate using the *real native character
   underlay* alpha at (27,17) or (27,18), respectively. No color guess or
   manual category selector is used.
5. Validate the original target alpha and live source alpha before any edits;
   then write only exposed patch sites using live source RGBA from the character
   buffers, or clear the Apache target across the underlying buffers. No
   firearm array is written. All original default-color pathways still take
   priority and return their v.84 status values.
6. The swatch-aware successful status is `5000 + weaponID*100 + itemID`, and
   the browser trace reports `experimentalUnderlay.matchMode=swatch-aware`.
   This is a new diagnostic, not evidence of in-game acceptance.

## Special limitation — Dracula highlight

Dracula's one bright-red added pixel has no surviving sampled equivalent in
its armed first-idle composite. v.84 used the literal default RGB. For the
new color-aware fallback, the helper transforms a live darker-red material
pixel at first-idle (27,22), mapping the brightest, middle, and darkest RGB
channels with the known original ratios of (196,36,48) → (234,50,60), with
rounding/clamping. This relation is exact at default and for pure permutations
of RGB channels; it is not proven equal to Unity's arbitrary swatch algorithm.
The accepted v.84 original-color Draco patch continues unchanged. The user
should visually verify the highlight for real recolored Dracula presets.

## Test evidence and scope

* 25 exact source alpha variants × 12 selected item templates × six synthetic
  RGB-channel permutations = 1,800 fixture cases, with two further negative
  mutation guards: 1,802 compiled WebAssembly cases passed. This covers
  native source-array memory indexing, pixel addition/replacement/clear,
  firearm occlusion, unchanged weapon buffers, and direct frame references.
* Inherited 305 compiled v.84 fixture cases and the 6+17 native hand correction
  fixtures pass. `node --check` and browser mock preview/export tests pass.
* Only method 71935 differs in the full Unity WebAssembly binary; all original
  other functions and non-code sections are preserved.
* Source references are supplied in `firearms/fixtures-v84.json`, and the
  generator and native tests are included in the development source ZIP.

**Not established:** live Unity selections or arbitrary actual palette
swatches, which may recolor shade classes differently from synthetic channel
permutations; all outfits in combination; actual Windows GUI; real download
client basename. Do not claim universal swatch support before user testing.

## Build and packaging

Run `python3 generate_swatch_underlay_v85.py`; compile the generated
`prototype/native_underlay_v85.c` with clang targeting wasm32 (`-O2`,
`-nostdlib`, `-Wl,--no-entry`, `-Wl,--import-memory`, export
`phm_native_underlay`); `python3 patch_native_underlay_v85.py` patches only
method 71935 of the SHA-pinned v.84 WASM. Run the test scripts, then
`python3 build_release_v85.py` and `python3 verify_release_v85.py`.
The source bundle contains `previous-v84.wasm`, game files, Go launcher
sources, fixtures, generator, tests and project release rules.
The Windows launcher must be rebuilt from source; do not rename an older EXE.
The player ZIPs are flat at root, use literal filenames and are separate
from the development archive whose `game/` subfolder is intentional.
