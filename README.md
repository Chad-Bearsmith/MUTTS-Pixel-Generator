# Pixel Hero Maker — preservation and Codex development repository

**Current player build: `Pixel Hero Maker [v.90]`.**

This repository captures the project's supplied **compiled Unity WebGL game**, custom native WASM patch sources, launcher source, scripts, test fixtures, visual references, and native diagnostics. **It is not a Unity Editor project and does not contain the original Unity C# source/project hierarchy.** Future development will mainly modify the WASM/JavaScript build pipeline and verify actual Unity sprite exports.

## What to read first

1. [`AGENTS.md`](AGENTS.md): rules for Codex and code changes.
2. [`docs/CODEX_HANDOFF.md`](docs/CODEX_HANDOFF.md): factual project history, implementation architecture, accepted fixes, unresolved issues, and suggested first task.
3. [`PIXEL_HERO_MAKER_PROJECT_RELEASE_RULES.md`](PIXEL_HERO_MAKER_PROJECT_RELEASE_RULES.md): mandatory canonical release naming, ZIP layout, changelog, titles, and export filename.
4. [`docs/BUILD_AND_TEST.md`](docs/BUILD_AND_TEST.md): commands, prerequisites, and caveats.
5. [`docs/GITHUB_SETUP.md`](docs/GITHUB_SETUP.md): beginner-friendly publishing and Codex setup.

## Repository layout

| Path | Meaning |
|---|---|
| `game/` | **v.90 player** Web build including `Build/WebGL.wasm`, `Build/WebGL.data`, JavaScript, HTML, assets and historical technical references |
| `previous-v80.wasm` ... `previous-v88.wasm` | Imported SHA-pinned previous native builds, **not** evidence that all versions were user-accepted |
| `prototype/` | Native C correction helpers, compiled helper WASMs, and regression tests |
| `tests/` | Unity native fixtures, Javascript probes, hand-color regression tests, and release test helpers |
| `firearms/`, `references/`, `real-v86-examples/`, `swatch-repros/` | Firearm masks and visual ground-truth examples |
| `diagnostics/v87/`, `diagnostics/v88/` | User-provided traces, reports, and recent v.88 exports, preserved unchanged |
| `main.go`, `console_*.go`, `go.mod` | Windows executable launcher source; embeds `game/` via `go:embed` |
| `patch_*.py`, `generate_*.py`, `build_release_v89.py` | Native patch/build scripts and lineage |
| `scripts/` | This repository's verification and test runner (does not modify game artifacts) |

## Build policy

* **Keep v.89 experimental.** Do not claim its four new equipment recognition paths work in-game until verified by a user.
* v.87 is the most recent confirmed reference for the four reported palette-specific corrections, **not** universal equipment support. See the handoff for the confirmed v.80–v.87 history.
* Do not run broad patch generation or rebuild commands automatically on import. First run `python scripts/verify_repository.py` and `python scripts/run_tests.py --smoke`.
* Keep releases and generated executables out of Git history. Use GitHub Releases for final player ZIPs when appropriate, not committed historical ZIP copies.
* All source files are supplied as-is for the owner's private use. Review rights for any original game content before changing repository visibility.
