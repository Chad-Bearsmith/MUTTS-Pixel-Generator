# Build, verify, and test notes

## Dependencies

For read-only checks: Python 3.10+ and Node.js 18+ (newer LTS recommended). Native helper rebuild requires Clang with WebAssembly target and a compatible linker. Windows launcher rebuild requires Go with ability to cross-compile for Windows. Unity runtime and actual Windows GUI testing may require a separate Windows machine/browser environment.

This repository contains compiled helpers, so the basic tests do **not** need a Clang installation.

## Recommended first checks

```sh
python scripts/verify_repository.py
python scripts/run_tests.py --smoke
python scripts/run_tests.py --full
```

On Windows, run these from the project root in PowerShell with `py` or `python` depending on your installation. Run the full tests after a native correction change or before a release. Some tests allocate substantial WebAssembly memory.

## Native helper rebuild (only when deliberately modifying its C source)

Without the later compile flags, `prototype/native_underlay_v89.c` builds the historical helper represented by `prototype/native_underlay_v89.wasm`. Use the current player commands below for v.94.

Example toolchain commands (Linux/macOS compatible shell, adjust for your Clang installation):

```sh
clang --target=wasm32 -O2 -nostdlib -Wl,--no-entry -Wl,--import-memory -Wl,--export=phm_native_underlay -o prototype/native_underlay_v89.wasm prototype/native_underlay_v89.c
python patch_native_underlay_v89.py
python scripts/verify_repository.py
python scripts/run_tests.py --full
```

`patch_native_underlay_v89.py` asserts the SHA-256 of the pinned `previous-v88.wasm` input and rewrites `game/Build/WebGL.wasm` by replacing **only function 71935**. Changes for later versions need new versioned scripts and tests, not silent edits to v.89 history.

## Rebuilding the native player

The v.94 player uses the v.93 native build unchanged. Its idle preview draws in Unity's WebGL canvas through `game/mutts-sprite-atlas.js`.

Reproduce the checked-in helpers with Zig 0.17.1.

```sh
zig cc --target=wasm32-freestanding -O2 -fno-builtin -nostdlib -Wl,--no-entry -Wl,--import-memory -Wl,--strip-all -o prototype/native_alien_body_tail_v90.wasm prototype/native_alien_body_tail_v90.c
zig cc --target=wasm32-freestanding -O2 -fno-builtin -nostdlib -DPHM_EXACT_DRACULA_HIGHLIGHT -Wl,--no-entry -Wl,--import-memory -Wl,--strip-all -o prototype/native_underlay_v91.wasm prototype/native_underlay_v89.c
zig cc --target=wasm32-freestanding -O2 -fno-builtin -nostdlib -DPHM_EXACT_DRACULA_HIGHLIGHT -DPHM_PROTECT_SMALL_BACKPACK -Wl,--no-entry -Wl,--import-memory -Wl,--strip-all -o prototype/native_underlay_v93.wasm prototype/native_underlay_v89.c
python patch_native_player_v93.py
python scripts/verify_repository.py
python scripts/run_tests.py --full
```

The patcher reconstructs the pinned v.92 module and replaces function 71935. This keeps the tail helper, both hand routines, the armed optional-overlay lookup, and the player export table. Use `--output <path>` to write the v.93 module somewhere else.

## Packaging the historical v.89 candidate

Run these commands from the v.89 checkout.

```sh
python build_release_v89.py
python verify_release_v89.py
```

The build script cross-compiles the Go Windows launcher, packages Web and Windows ZIPs, and writes a development-source ZIP in the **parent folder of the repository**. All are generated artifacts; they should be attached to a GitHub Release or retained outside Git history. Existing v.89 output should not be overwritten without deliberate intent. The release rules require additional live checks before a future player release is called verified.

## Native tests are not gameplay tests

The imported native test fixtures model managed arrays, selected inputs, framebuffer, palettes, and weapon alpha. Synthetic test success is useful for safety, **not** proof of the real Unity builder's complete equipment and sprite export behavior. Required live checks include Cape/Back-selected arm overlays, the four new v.89 geometry cases, and regression cases with other weapons and palettes.

## Large binary management

The repo includes original pinned WASM baselines and current `WebGL.data` as byte-for-byte development inputs. All imported files are below GitHub's individual 100 MiB Git limit; no separate Git LFS setup is required for this bootstrap. Avoid committing Windows executables, repeated full game ZIPs, or unrelated large exports every release. Add new large binary assets to Git LFS or GitHub Releases if size starts growing.
