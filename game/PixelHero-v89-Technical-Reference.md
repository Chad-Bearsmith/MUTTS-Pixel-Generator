# Pixel Hero Maker [v.89] — Technical reference

## Scope and baseline
Derived from unchanged v88 with only native helper 71935 replaced. The v80
hand routines 71933 and 71934, their call order, and all original game assets
remain unchanged. Previous exact and swatch-aware item recognizers are first
priority; source-aware fallback triggers only for existing -3 and -7 skips.

## Four item source identity improvements

Original texture index covers 564 source item textures. Four primary source
shapes are unique in that index, and the uploaded v88 native snapshots
confirm those exact source alpha masks are present despite missing companion
textures. v89 independently recognizes the primary source for:

| Item | Unique donor FNV32 | Bolt status | Patch |
|---|---|---|---|
| Apache Armor | f332657f | 8003 | Transparent erase at (27,17) |
| Alien Armor | 0acbc220 | 8004 | Four preexisting item-template pixels |
| Dracula Armor | 532c80de | 8006 | Sixteen preexisting item-template pixels |
| Furry Body | 4647633f | 8007 | Four preexisting item-template pixels |

All positions use zero-based top-left coordinates of the original 64x64
native idle tile. The original source pixel and firearm alpha guards remain.
Apache's secondary erase is conditional on the secondary source being present.
No item correction writes into the firearm's original array. Non-target
mixed items continue to fail closed. Snow Rider's donor mask is shared with
64 original assets and is specifically NOT permitted without its additional
unique sentinel; this prevents item identity confusion.

## Reproduction evidence

Five v88 JSON snapshots supplied by the user were parsed at full 4096-bit
native alpha-mask resolution. The seven reported pixel samples per layer are
exact as observed. Unsampled RGBA components in the native test harness are
*synthetic*: the new positive statuses and patch coordinate scope are tested,
not a live pixel-perfect comparison against the user's new PNG exports.
The new helper produced +8004, +8006, +8003, safe skip -3, +8007 in trace
order (1),(2),(3),(4),default. It did not modify any source firearm pixels.

All 12 original source-layer items passed 126 fixture checks; all earlier
v87 source-layer combination checks passed (including Merman+Alien now
correctly repairing both item layers), 305 cross-firearm checks, 1802
palette-swatch checks, 17 v80 Cape/Back checks, 6 combined native hand tests.
The full compiled game WASM validates. Live Unity validation is outstanding.

## Unresolved separate Cape/Back hand-color regression

The user-supplied v88 traces (3) and (4) both record hand status 2,
source104 fresh, source108 selected but unavailable, and its optional absence
NOT proven. Trace (4)'s observed alpha-254 firearm markers have red
RGB (234,50,60) while source104's sampled bare-arm RGB is (246,202,159).
That is corroborating evidence of Cape/Back color contamination, not proof
that source104 skin can safely override selected armor or glove sleeves.
The accepted hand-color guard remains unchanged. Native arm diagnostics still
report the unavailability and should guide a separate, narrow hand-source fix.

## Rebuild

Start with the SHA-pinned original v88 WASM, compile
`prototype/native_underlay_v89.c` to `prototype/native_underlay_v89.wasm`
with clang `--target=wasm32 -O2 -nostdlib -Wl,--no-entry -Wl,--import-memory -Wl,--export=phm_native_underlay`.
Run `patch_native_underlay_v89.py` to replace only native function 71935.
Run v89 source and uploaded-trace tests, inherited swatch, firearm and hand
tests. Rebuild both Web and Windows via `build_release_v89.py`, then verify
CRC, byte parity, titles, ZIP filenames, and WASM-function identity.
