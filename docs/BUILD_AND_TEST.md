# Build, verify, and test notes

## Dependencies

For read-only checks: Python 3.10+ and Node.js 18+ (newer LTS recommended). Native helper rebuild requires Clang with WebAssembly target and a compatible linker. Windows launcher rebuild requires Go with ability to cross-compile for Windows. Unity runtime and actual Windows GUI testing may require a separate Windows machine/browser environment.

This repository contains compiled helpers, so the basic tests do **not** need a Clang installation.

## Repository layout

Development tools live in `scripts/`, pinned native inputs in `baselines/`, regression inputs in `tests/fixtures/`, and captured evidence in `diagnostics/`. The Go launcher builds from the repository root and embeds the playable assets from `game/`. See the [release rules](MUTTS_PIXEL_GENERATOR_PROJECT_RELEASE_RULES.md) for packaging requirements.

## Recommended first checks

```sh
python scripts/verify_repository.py
python scripts/run_tests.py --smoke
python scripts/run_tests.py --full
```

On Windows, run these from the project root in PowerShell with `py` or `python` depending on your installation. Run the full tests after a native correction change or before a release. Some tests allocate substantial WebAssembly memory.

## Native helper rebuild (only when deliberately modifying its C source)

Without the later compile flags, `prototype/native_underlay_v89.c` builds the historical helper represented by `prototype/native_underlay_v89.wasm`. Use the current player commands below for v.106.

Example toolchain commands (Linux/macOS compatible shell, adjust for your Clang installation):

```sh
clang --target=wasm32 -O2 -nostdlib -Wl,--no-entry -Wl,--import-memory -Wl,--export=phm_native_underlay -o prototype/native_underlay_v89.wasm prototype/native_underlay_v89.c
python scripts/patch_native_underlay_v89.py
python scripts/verify_repository.py
python scripts/run_tests.py --full
```

`scripts/patch_native_underlay_v89.py` asserts the SHA-256 of the pinned `baselines/previous-v88.wasm` input and rewrites `game/Build/WebGL.wasm` by replacing **only function 71935**. Changes for later versions need new versioned scripts and tests, not silent edits to v.89 history.

## Rebuilding the native player

The native Unity Randomize button clones Export's visuals and batches the original dropdown and swatch callbacks into one editor rebuild. Starting in v.97, the entry page and scripts share a build key in their asset URLs. Update that key in the entry page and Randomize script when cutting a new player version.

Reproduce the checked-in helpers with Zig 0.17.1.

```sh
zig cc --target=wasm32-freestanding -O2 -fno-builtin -nostdlib -Wl,--no-entry -Wl,--import-memory -Wl,--strip-all -o prototype/native_alien_body_tail_v90.wasm prototype/native_alien_body_tail_v90.c
zig cc --target=wasm32-freestanding -O2 -fno-builtin -nostdlib -DPHM_EXACT_DRACULA_HIGHLIGHT -Wl,--no-entry -Wl,--import-memory -Wl,--strip-all -o prototype/native_underlay_v91.wasm prototype/native_underlay_v89.c
zig cc --target=wasm32-freestanding -O2 -fno-builtin -nostdlib -DPHM_EXACT_DRACULA_HIGHLIGHT -DPHM_PROTECT_SMALL_BACKPACK -Wl,--no-entry -Wl,--import-memory -Wl,--strip-all -o prototype/native_underlay_v93.wasm prototype/native_underlay_v89.c
zig cc --target=wasm32-freestanding -O2 -fno-builtin -nostdlib -Wl,--no-entry -Wl,--import-memory -Wl,--strip-all -o prototype/native_hand_fallback_v97.wasm prototype/native_hand_fallback_v97.c
zig cc --target=wasm32-freestanding -O2 -fno-builtin -nostdlib -Wl,--no-entry -Wl,--import-memory -Wl,--strip-all -o prototype/native_alien_body_mask_v98.wasm prototype/native_alien_body_mask_v98.c
zig cc --target=wasm32-freestanding -O2 -fno-builtin -nostdlib -Wl,--no-entry -Wl,--import-memory -Wl,--strip-all -o prototype/native_armed_body_v99.wasm prototype/native_armed_body_v99.c
zig cc --target=wasm32-freestanding -O2 -fno-builtin -nostdlib -Wl,--no-entry -Wl,--import-memory -Wl,--strip-all -o prototype/native_keyed_underlay_v106.wasm prototype/native_keyed_underlay_v106.c
zig cc --target=wasm32-freestanding -O2 -fno-builtin -nostdlib -DPHM_EXACT_DRACULA_HIGHLIGHT -DPHM_PROTECT_SMALL_BACKPACK -DPHM_REQUIRE_SELECTED_ITEM -Wl,--no-entry -Wl,--import-memory -Wl,--strip-all -o prototype/native_underlay_v106.wasm prototype/native_underlay_v89.c
python scripts/patch_native_player_v106.py
python scripts/verify_repository.py
python scripts/run_tests.py --full
```

The v.97 patcher reconstructs the pinned v.96 module and inserts the fallback between the original hand-color pass and the firearm underlay. When some equipment combinations make Unity append a copy of the firearm, the fallback finds the unique rendered layer by an exact first-idle match outside the hand-marker colors. It reads the current arm and glove from native captures and writes only the matched layer's marker RGB. Use `--output <path>` to write the module elsewhere.

The v.98 patcher replaces the Body tail helper and updates its existing builder call sites. It selects the first-idle tail mask from the same item keys Unity passes to its pixel lookup. The swatch suffix can vary freely. After the firearm and equipment corrections, the mask clears the selected pixels in the private Body copy whenever the selected Armor key is Alien.

The v.99 helper uses the selected Body key for the verified Furry, Merman, and Werewolf firearm templates. It samples the two donor colors in the private Body copy and checks the current firearm pixels before applying each repair. The call runs after the original underlay and before the Alien Armor tail mask.

The v.100 patcher exports Unity's existing `GameObject.SetActive` function. UI initialization calls it on the `Presets` parent to hide the whole grid and disable its input.

The v.101 patcher routes the Reset clone through Unity's existing button press method. The editor records startup selections, colors, and visibility, then restores them in one rebuild. The v.102 preview uses four design pixels per texel and the default Human's bounds for the fixed shadow anchor.

The v.103 patcher exposes Unity's child count and deferred object destruction. At startup the editor finds Export by name and destroys the optional legacy preset grid. The original serialized Unity scene is preserved in `WebGL.data`.

In v.104 the loading screen stays visible while Unity initializes the editor and removes the grid. The page reveals the canvas after Unity has had a frame to redraw.

The v.105 patcher routes the Unity Export button to the local PNG exporter before Unity invokes the legacy Save callback. Mouse, touch, and keyboard submit use the same Unity button path. With the canvas focused, Up and Down select an action button, and Enter or Space activates it.

The v.106 builder supplies the selected item keys and private pixel arrays to the first-idle underlay. The new pass accepts Unity's rendered firearm copy when it matches the source outside the hand-marker RGB and uses that rendered layer to guard each repair site. The compatibility pass requires the selected item, and Apache's erase is confined to its private Armor and verified shadow arrays. The Hellsing and Snow Rider fallback uses the verified Human Body template.

The guarded Apache Armor underlay preserves the Small Backpack pixel. The preview and PNG export both read the combined first idle tile. Randomize and Reset inherit Export's styling and apply changes using the native controls in one editor rebuild.

## Packaging the historical v.89 candidate

Run these commands from the imported v.89 checkout (`3962388`).

```sh
python build_release_v89.py
python verify_release_v89.py
```

The build script cross-compiles the Go Windows launcher, packages Web and Windows ZIPs, and writes a development-source ZIP in the **parent folder of the repository**. All are generated artifacts; they should be attached to a GitHub Release or retained outside Git history. Existing v.89 output should not be overwritten without deliberate intent. The release rules require additional live checks before a future player release is called verified.

Review rights to the original game assets before changing how they’re distributed.

## Native tests are not gameplay tests

The imported native test fixtures model managed arrays, selected inputs, framebuffer, palettes, and weapon alpha. Synthetic test success is useful for safety, **not** proof of the real Unity builder's complete equipment and sprite export behavior. Required live checks include Cape/Back-selected arm overlays, the four new v.89 geometry cases, and regression cases with other weapons and palettes.

## Large binary management

The active checkout keeps the pinned v.87 and v.88 WASM files in `baselines/` and the current `WebGL.data` in `game/Build/` as byte-for-byte development inputs. The `archive/v103-pre-cleanup` tag preserves the v.80–v.86 snapshots, historical patchers and packagers, and original reference ZIP. The same reference PNGs are available directly under `references/`. [Imported source hashes](IMPORTED_SOURCE_SHA256.json) record the original import paths.

```sh
git worktree add --detach ../mutts-v103-archive archive/v103-pre-cleanup
```

Keep generated Windows executables and release ZIPs outside the source tree.
