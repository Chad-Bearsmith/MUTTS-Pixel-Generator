# Pixel Hero Maker [v.88] — Source-aware corrective layer and hand overlay evidence

**Baseline:** Accepted v87, original WebAssembly SHA-256 `0c47dc29fec0446fa5e8a632f24ec6d663e0c33eabfccb1d9e3322980e698486`.

v88 replaces exactly one original compiled function, the existing 71935 corrective helper. Unity native functions 5031, 71933 and 71934 remain byte-for-byte unchanged. The original game data, Unity loader/framework, static idle preview/export, and 25 source weapon masks remain intact. No new browser-side geometry or hand-color pixel writer is introduced.

## Root cause and tested geometry approach

In v87, the primary underlay recognizer fingerprints the entire character before merge; an unrelated helmet, cape, back item or other gear can change this image and return -3. When a structural fallback matches it may still reject -7 because another item legitimately occupies a correction coordinate. Worse, v87's writes target the **last non-firearm layer**, which can be an unrelated accessory.

v88 keeps all original matchers first. On selected -3/-7 failures, it tests each live builder input array independently against original Unity first-idle alpha shapes. The code uses exact source alpha shape signatures (rather than names from render order or final-composite RGB), recognizes the original selected item parts, and reads any needed replacement colors from the actual current item source array. For split armor items, distinct required source masks must both appear. It commits within the donor item's original input array; later Unity layers and visible firearm materials continue to take priority. Unknown and ambiguous shapes fail closed. Only first-idle frame indices are writable.

Native-only tests on all 12 original Unity item texture source sets reproduce each intended default correction at its source RGBA, plus a simulated swatch variant. The original 10 v87 user source-layer traces were modeled with the exact captured 4096-bit per-layer alpha shapes and seven reported source RGBA sample sites; all remaining pixels were filled from the matching original Unity source textures. Merman+various equipment and Merman+Cape demonstrate how the depth-sensitive fix can avoid the previous final-composite fingerprint failure. **These are source-supported synthetic fixtures, not live v88 acceptance tests.**

## Hand-color regression remains unresolved

The earlier accepted v80 hand routine is untouched. The user's v87 traces (8)/(9) have hand status 2, source104 fresh, source108 not fresh and NOT proven optionally absent. A selected overlay may be required, so substituting bare-arm skin could break armor/glove combinations. v88 deliberately does **not** bypass the guard or claim the wrong hand colors fixed. The standard trace adds `nativeArmSourceEvidence` with first-idle source104 and source108 sample pixels (only when fresh), their freshness flags, and the optional overlay-absence status. This provides evidence for a future native fix rather than guessing.

## Diagnostics

Source-aware underlay statuses use 8000+itemCode for Bolt: 8001 Cape, 8002 Fire Lizard, 8003 Apache, 8004 Alien, 8005 Angel, 8006 Dracula, 8007 Furry, 8008 Lizard, 8009 Merman, 8010 Werewolf, 8011 Hellsing, 8012 Snow Rider; 8099 means multiple source-matched items. Other firearm variants add a code offset. Existing exact/default and 5000-series swatch codes are unchanged. A positive native status is NOT proof the browser GPU atlas or exported PNG contains the patch: verify a live export. Inactive/mismatched source masks remain safely skipped.

## Reproducibility and release gates

Source archive contains the exact v87 baseline WASM, compiled v88 helper, generator/patcher, original source-alpha mapping, native trace fixtures, source-item fixtures, inherited regression tests and launcher Go source. Regenerate C with `generate_source_layer_underlay_v88.py`, compile via `clang --target=wasm32 -O2 -nostdlib -Wl,--no-entry -Wl,--import-memory -Wl,--export=phm_native_underlay`, and patch only 71935 with `patch_native_underlay_v88.py`.

Static tests: native fixture suites, v87 inherited firearm/item 305, synthetic swatch 1802, native Cape/Back 17 and pipeline 6, browser mock, JS syntax, WASM code-section identity, ZIP CRC/root filenames, embedded Web/Windows asset hashes. Limitations: no independent live Unity validation on the new gear combinations, no native Windows GUI test, no actual downloaded ZIP-basename test. The v80 accepted hand-color logic remains authoritative and intentionally fails closed when a selected overlay is unproven.
