# Codex operating instructions — MUTTS Pixel Generator

Read `docs/CODEX_HANDOFF.md`, `docs/BUILD_AND_TEST.md`, and `docs/MUTTS_PIXEL_GENERATOR_PROJECT_RELEASE_RULES.md` before modifying code.

## Hard invariants

- The imported **v.89** baseline was experimental. Treat any v.88/v.89 equipment combinations awaiting owner validation accordingly.
- Preserve historical `previous-v*.wasm`, user evidence, reference sprites, and the original `game/Build/WebGL.data`. Do not rewrite prior changelogs to imply new test outcomes.
- The original native automatic hand correction uses functions **71933 and 71934** in the accepted v.80 order; avoid altering their bodies or order unless explicitly tasked to repair hand colors and properly test their provenance/swatch/armor behavior.
- Experimental underlay correction lives in WASM function **71935**. Recognize supported item source layers reliably, preserve foreground item and firearm pixels, and avoid writing outside narrowly verified pixel sites.
- Never presume all 24 firearm types, every palette, and arbitrary equipment combinations are fixed. Respect 25 known firearm mask variants, item layer order, and unsupported-case safe skips.
- Do not repaint sleeves or gloves with guessed skin RGB. Cape and Back are excluded as hand-color reference categories. The known source108-selected-but-unavailable failure is **unresolved** in imported v.89.
- Keep sprite-sheet geometry, animations, transparency, UI, palettes, offline behavior, and custom export names unchanged. Default suggested export basename is `SpriteSheet`.
- Release filenames and in-game titles must exactly follow `docs/MUTTS_PIXEL_GENERATOR_PROJECT_RELEASE_RULES.md`. Archive roots must be flat; Web `Build/` and `TemplateData/` remain subfolders. No underscore or URL-encoded final basenames.
- Changes to compiled Unity WASM require pinned-baseline checks and an auditable function-level diff. Never call a mock test a live Unity or Windows GUI test.
- Treat diagnostics as evidence; their native snapshot and GPU-observed atlas may refer to different builder calls. Validate freshness before relying on them.

## Development workflow

1. State the targeted problem and identify the exact baseline, test fixtures, and files before editing.
2. Reproduce the failing native/helper/atlas case from `diagnostics` or ask for missing exact evidence instead of guessing equipment IDs.
3. Commit directly on `main` and push tested changes to `origin/main`. GitHub Pages deploys from `main`. Make the smallest reviewed change, add negative tests, and verify firearm source buffers.
4. Run `python scripts/verify_repository.py`, `python scripts/run_tests.py --smoke`, and, for native changes, `python scripts/run_tests.py --full` when environment permits.
5. If a native patch changes, compare WASM function bodies and preserve functions 71933/71934 unless in a separately approved hand-color fix.
6. Only produce Windows/Web release ZIPs after following all release gates. Do not commit generated `*.exe` or release ZIPs to source control.
7. In every summary separate: source inspection, isolated synthetic validation, browser mock, real live Unity export, Windows GUI, and downloaded-filename testing.

## Suggested first Codex task (analysis-only)

Investigate why v.89's source-aware underlay still needs companion layers for some equipment and why selected `source108` can be unavailable in Armor + Cape/Back cases. Use the imported diagnostics; propose a small testable fix plan. **Do not modify the accepted v.80 hand-color routine or publish a v.90 build before showing evidence and negative tests.**
