# MUTTS Pixel Generator [v.84] — Crossbow and Shotgun source-mask corrections

**Baseline:** v.83 exact distribution, user-reported working except Crossbow
and Shotgun. Earlier accepted Bolt and native hand-color behavior retained.
**Scope:** First idle 64×64 frame, reference-matching naked Human and default
swatches. This is an experimental recognition fix, not an arbitrary-color or
all-outfits geometry system.

## Reproduced failure and exact Unity sources

The user provided `PixelHero-v83-IdleAutoHandTrace.json` and `(1).json` from
Crossbow/Shotgun Dracula tests. Both had `experimentalUnderlay.status=-2`, while
native hand reference was (246,202,159,255), and the observed 7 alpha-254
markers all matched the hand reference. The two exports had different weapon
artwork and both retained missing Dracula geometry. The diagnostic records the
most recent builder call and is not a perfect synchronized source snapshot.

The v.83 generator read 23 weapons from `resources.assets` only:
* `resources.assets/Shotgun`, original first-idle alpha mask FNV-1a
  `0x8b4dc278`, contains 59 alpha-255 weapon pixels, no 254 markers.
* The actual Unity bundle ALSO contains `sharedassets0.assets/Shotgun` at
  texture path ID 277, with identical first-idle RGB artwork and 59 opaque
  positions, but 51 alpha-255 pixels, 7 alpha-254 hand markers, and 1 alpha-252
  material pixel. Alpha FNV-1a `0xcc087534`. The eight positions whose alpha
  differs from the unmarked variant are (29,19), (31,19), (32,19), (33,19),
  (31,20), (32,20), (37,20), (38,20), in zero-based first-idle coordinates.
* `sharedassets0.assets/Сrossbow` at texture path ID 138 (first character
  U+0421 Cyrillic capital Es), first-idle alpha hash `0x0175df7a`, 81 nonzero
  pixels, 7 alpha-254 markers, 3 alpha-252 pixels. It was not among v.83's
  original 23 source masks. Its artwork overlaps the user's Crossbow export.

The new masks do not increase the 255 occupied idle pixels in the existing
union mask, so **the original item reference signatures and correction source
sampling coordinates remain unchanged**.

## Native change and how to reproduce it

* `previous-v83.wasm` is the exact v.83 baseline (SHA-256
  `04eef99b637f4c722126a314f9daf2c62a0e4afd74eb2b15f481502801c55b94`).
* Native function 71935 retains the v.83 correction code and adds two exact
  alpha-hash dispatch values: `0x0175df7a => firearm ID 23` (Crossbow) and
  `0xcc087534 => firearm ID 19` (Shotgun marked variant). The existing
  unmarked Shotgun hash `0x8b4dc278 => 19` is still accepted.
* All other original functions **including builder 5031 and accepted hand
  correction functions 71933/71934** are unchanged. Unity .data, framework
  and loader are frozen. The original first-idle frame underlay, gun-occlusion
  alpha tests, reference RGB sources, 12 item operations, Bolt special path,
  export dimensions, and disabled animations are unchanged.
* `firearms/fixtures-v84.json` references 25 exact source alpha masks for 24
  unique firearm IDs (two Shotgun variants), including full first-idle RGBA
  data. Files `firearms/Crossbow-sharedassets0-idle.npy` and
  `firearms/Shotgun-marked-sharedassets0-idle.npy` contain unmodified
  first-idle data from the Unity source bundle. The reproducible generator
  `generate_weapon_variants_v84.py` asserts they match expected source hashes,
  that the older 23 masks remain unmodified and that the union mask is equal.
* Generate native C by running the generator; compile
  `prototype/native_underlay_v84.c` using clang `--target=wasm32 -O2 -nostdlib`
  with `-Wl,--no-entry -Wl,--import-memory -Wl,--export=phm_native_underlay`.
  `patch_native_underlay_v84.py` replaces ONLY method 71935 in the exact
  SHA-pinned v.83 WASM; build both player packages from the same `game/` root
  with the included Go sources. Developer source ZIP intentionally includes
  `game/` and is not a player distribution.

## Statuses and fixture evidence

The positive native underlay status for Dracula Armor is `2306` for Crossbow
and `1906` for either Shotgun variant; all twelve item codes 1..12 unchanged.
Negative statuses -1..-7 retain v.83 meanings. The inspector maps firearm ID 23
to `Crossbow` and ID 19 to `Shotgun`.

`prototype/test_native_v84_integrated.js` passes 305 compiled WASM fixtures:
25 source variants × 12 items + 5 adversarial guard checks. For Crossbow,
7 item templates have exposed target pixels and 5 are fully occluded (-6).
For either Shotgun variant, all 12 templates have at least one exposed pixel.
For Dracula, Crossbow has 9 exposed patch pixels and Shotgun 14. The tests
preserve the gun array exactly and check no unrelated native atlas pixels
change. These are synthetic tests, not proof that live Unity resolves all item
selections to these same source arrays. Inherited v.80 native hand and v.83
browser checks are separate.

**NOT TESTED:** Live Unity with the new v.84 variants, actual Windows
execution on Windows, human-verified GUI title/native save dialogs, or the
client-saved basename of the final ZIP downloads. The user should export both
Dracula examples in v.84 and supply the two reports if the correction does not
apply. No tail or animation repair is included.
