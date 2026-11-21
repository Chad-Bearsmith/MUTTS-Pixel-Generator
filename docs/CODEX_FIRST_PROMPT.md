# First Codex task — paste this into the Codex conversation for this repository

Investigate MUTTS Pixel Generator's remaining sprite-corrective-layer and Armor + Cape/Back firearm hand-color bugs. **Do not modify files, create a release, or claim that v.89 is accepted yet.**

First read `AGENTS.md`, `docs/MUTTS_PIXEL_GENERATOR_PROJECT_RELEASE_RULES.md`, `docs/CODEX_HANDOFF.md`, `docs/BUILD_AND_TEST.md`, `game/MUTTS-v89-Technical-Reference.md`, and the v.88 traces in `diagnostics/v88/`.

Verify file integrity and run the smoke tests. Inspect the exact native `source104`/`source108` provenance for status-2 failed recoloring and the source-layer matching/companion guard in `prototype/native_underlay_v89.c` and the related native patcher/tests. Compare the five v.88 screenshots and corresponding source-layer snapshots with the 12 original visual references.

Report: (1) which failures are proven and which still need a fresh Unity capture, (2) the safest native implementation approach for the two independent bugs, (3) tests and negative controls to protect all previously accepted geometry and swatch fixes, and (4) the exact files/functions you'd change for a proposed v.90. Do not weaken Cape/Back exclusions, paint guessed skin over armored gloves, or infer item identity from an ambiguous silhouette.
