"""Update current-release labels while preserving all historical notes and assets."""
from pathlib import Path
R=Path(__file__).resolve().parent;G=R/'game';OLD='MUTTS Pixel Generator [v.88]';NEW='MUTTS Pixel Generator [v.89]'
for file in (R/'main.go', G/'index.html', G/'phm-static-idle.js', G/'phm-diagnostics-ui.js',G/'phm-v76-layer-provenance.js'):
 s=file.read_text()
 assert 'v.88' in s,file
 s=s.replace(OLD,NEW).replace('"v.88"','"v.89"').replace("'v.88'","'v.89'")
 # diagnostic buttons use current file title; maintain literal naming.
 if file.name=='phm-v76-layer-provenance.js':
  s=s.replace('v88 invokes source-layer matching','v89 preserves the v88 source-layer matcher and additionally accepts the unique primary native item source alone for Apache, Alien, Dracula, and Furry when optional companion textures are absent')
  s=s.replace('12 item templates; 24 firearm IDs/25 source masks; source-layer recognition is experimental with added equipment','12 item templates and 25 source firearm masks; v89 four-item unique-donor source fallback remains experimental with added equipment')
 file.write_text(s)
old=(G/'Changelog.txt').read_text();assert old.startswith(OLD)
release='''MUTTS Pixel Generator [v.89] — Experimental optional companion source support (four item geometry cases)
- Changed: Native underlay helper 71935 recognizes Apache Armor, Alien Armor, Dracula Armor, and Furry Body by their independently unique 64x64 original item source alpha shapes, even when a companion source buffer is omitted by Unity during an equipped rebuild. Each unique primary source was checked against the 564-item original source texture alpha index. All other item matching rules, including Snow Rider's shared source shape that requires its distinguishing sentinel, remain strict.
- Corrective pixels: Existing v88 item-specific add, recolor, and erase templates are unchanged. The four selected item changes are written to their own current swatch-adjusted native source arrays, beneath later equipment and the firearm. For Apache, an optional secondary erase is performed only if its secondary source exists. The other original matching paths remain first-choice, and the firearm buffer remains untouched.
- Verification: Five newly supplied v88 native per-layer trace masks modeled with exact observed alpha and sample RGBA values (unobserved RGB filled synthetically) returned 8004 Alien, 8006 Dracula, 8003 Apache, -3 safe skip, and 8007 Furry. All 12 source-item fixture tests (126 checks), earlier v87 equipment layer fixtures, inherited 305 firearm and 1802 swatch tests, and 23 native hand-color tests passed. Full WASM validates. These are isolated tests, NOT evidence of a successful v89 interactive Unity sprite export.
- Known limitation: The separate Armor + Cape/Back hand-color failure is NOT repaired. Some equipped combinations still give hand status 2 with source104 fresh but a selected 108 overlay unavailable, leaving the earlier routine's Cape/Back color. The v88 arm-source diagnostic remains available. Avoid guessing skin when armor or gloves could be equipped; see the technical reference.
- Known limitation: Other unsupported mixed outfits, missing source buffers, or shared silhouettes may still skip. Dracula's inferred unusual swatch highlight remains experimental.
- Windows/Web packaging: Flat-root Windows and Web archives, matching embedded and browser assets, exactly named MUTTS Pixel Generator [v.89].zip and MUTTS Pixel Generator [v.89] (Web).zip. Actual native Windows GUI, live Unity v89 exports, and browser-saved ZIP basenames were not independently tested. Default PNG export basename remains SpriteSheet.png.

'''
(G/'Changelog.txt').write_text(release+old)
(G/'README-START-HERE.txt').write_text('''MUTTS Pixel Generator [v.89]
=======================
EXPERIMENTAL GEOMETRY FIX — NOT A CONFIRMED GLOBAL REPAIR

The four item examples newly supplied after v88 show Apache Armor, Alien
Armor, Dracula Armor, and Furry Body item data present in the native builder,
but omitted companion source arrays prevent the existing correction.

v89 now recognizes these four independently unique primary source alpha masks
and applies the same tested item corrections to the selected item's own input
layer when the Bolt or another recognized firearm leaves the target exposed.
Other items, especially those with shared source silhouettes, remain guarded.

TEST THESE COMBINATIONS
Recreate the four supplied v88 examples. Export SpriteSheet.png and compare
the restored item geometry to the intended appearance. The native trace
should show source-layer codes 8003 Apache, 8004 Alien, 8006 Dracula, or
8007 Furry with Bolt. These still need live Unity validation.

IMPORTANT — HAND-COLOR ISSUE STILL PRESENT
Certain Armor + Cape/Back selections can still cause the firearm hands to
inherit the wrong Cape/Back color. Native hand status 2 and
source108SelectedButUnavailable=true identify this condition. v89 does NOT
alter the v80 hand routine or guess glove/armor colors. Send paired fresh
sprite exports and PixelHero-v89-IdleAutoHandTrace.json for further study.

WINDOWS
Extract MUTTS Pixel Generator [v.89].zip into any folder. Run
MUTTS Pixel Generator [v.89].exe. It opens the offline game in your browser
through a local server. Keep the console launcher running during play.

WEB
Extract MUTTS Pixel Generator [v.89] (Web).zip into any folder. Serve
index.html over local HTTP if direct file:// loading is restricted.

Default PNG export is SpriteSheet.png; custom export names remain supported.
Only the first idle frame is targeted by the native corrective stage.
Live v89 Unity interaction, Windows GUI operation, and the downloaded ZIP
basenames have not been independently verified in this environment.
''')
(G/'MUTTS-v89-Technical-Reference.md').write_text('''# MUTTS Pixel Generator [v.89] — Technical reference

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
''')
(R/'README-DEVELOPER.txt').write_text('MUTTS Pixel Generator [v.89] experimental source. Four item-unique donor masks can act alone when companion buffers are omitted. Use patch_source_companions_v89.py, compile prototype/native_underlay_v89.c, patch native function 71935 via patch_native_underlay_v89.py, test and build. Cape/Back hand status 2 is NOT yet repaired. See game/MUTTS-v89-Technical-Reference.md.\n')
print('updated game UI labels, changelog, README and v89 technical reference')
