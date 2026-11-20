# Pixel Hero Maker — Project Source and Release Rules

**Status:** Project-wide instructions for all future Pixel Hero Maker fixes, diagnostics, builds, and archives.  
**Priority:** Follow these rules unless the user explicitly requests a different convention.  
**Important:** These are packaging and release standards, not evidence that any gameplay bug has been fixed.

## 1. Canonical version and filenames

For release version `v.N` (example: `v.24`), use **exactly**:

| Artifact | Exact name |
|---|---|
| Windows ZIP | `Pixel Hero Maker [v.N].zip` |
| Web ZIP | `Pixel Hero Maker [v.N] (Web).zip` |
| Windows executable | `Pixel Hero Maker [v.N].exe` |
| Windows extraction folder (if the user creates one) | `Pixel Hero Maker [v.N]` |
| Web extraction folder (if the user creates one) | `Pixel Hero Maker [v.N] (Web)` |
| In-game or document version label | `Pixel Hero Maker [v.N]` |
| Game window title and Web/browser-tab title | `Pixel Hero Maker [v.N]` |
| Default sprite-sheet export basename | `SpriteSheet` (normally saved as `SpriteSheet.png`) |

Replace **only** `N` with the intended version number. Use literal ASCII spaces, `[`, `]`, `(`, `)`, and periods. Do **not** put `_`, `%20`, `%5B`, `%5D`, `%28`, `%29`, `- Flat`, `- Corrected`, `- Windows`, `- Diagnostic`, or other suffixes into the final ZIP filenames or game folder names. URL encoding in a browser's link address is not a filesystem filename; validate the actual disk names separately.

**Application-facing title requirement:** Every release must show `Pixel Hero Maker [v.N]` as the exact game window title and, for Web, the browser tab/document title. Do not append edition names, patch names, fix labels, platform labels, or descriptions such as `- Fixed`, `- Firearm`, `- Web`, `- Windows`, or `- Edition`. This requirement is separate from ZIP/executable filenames; the Web ZIP still retains `(Web)` in its package name.

**Do not silently overwrite an established release with different content.** If packaging a diagnostic build for the same version, obtain the user's preference about replacing the existing named files or advancing the version. Diagnostic purpose belongs in the README/changelog, not in an unrequested filename suffix.

## 2. ZIP layout: no wrapper or nested project folders

**The ZIP must contain the game files at archive root.** The user chooses the extraction directory. Do not include an enclosing `Pixel Hero Maker .../` folder inside the archive, and do not create a second copy of that folder under itself.

Expected Windows ZIP root:

```text
Pixel Hero Maker [v.N].exe
README-START-HERE.txt
[optional release notes or other necessary root-level files]
```

Expected Web ZIP root:

```text
index.html
Build/
TemplateData/
Changelog.txt
[necessary JavaScript, CSS, manifests, and README files]
```

The `Build/` and `TemplateData/` subdirectories are **required asset directories**, not unwanted nested release folders. Do not flatten their contents. Windows packages can have other root files if required by the actual launcher; verify them rather than assuming a fixed list.

When extracted into a user-created folder named `Pixel Hero Maker [v.N]` or `Pixel Hero Maker [v.N] (Web)`, the executable or `index.html` must be **immediately inside that folder**, not one or two levels deeper.

## 3. Preserve original game behavior unless the change requires otherwise

- Keep the original Unity assets, item inventory, UI options, palettes and swatches, offline operation, and native sprite-sheet export unless a change is explicitly requested.
- Keep sprite-sheet format, resolution, animation contents, custom file naming, and export controls unchanged except for the explicitly requested default filename basename `SpriteSheet`.
- Keep the Windows and Web builds functionally aligned. If Windows embeds Web content, rebuild the executable after changing that content.
- Do not use a renamed old executable and claim it contains new code. Compare its embedded assets or perform a functional check.
- Do not apply a six-frame AK-47 repair to every firearm without per-weapon evidence.
- Do not replace clothed arms/gloves with guessed skin colors. Account for selected outfit layers, weapon geometry, swatch recoloring, and all affected animation frames.
- Preserve unknown or unsupported combinations rather than introducing destructive, unverified pixel edits.
- Distinguish **diagnostic instrumentation**, **experimental repair**, and **verified gameplay fix** in release notes.

## 4. Changelog: preserve history, append accurate entries

The Web build must include `Changelog.txt` at ZIP root. Preserve existing historical entries in their existing order and wording unless correcting an explicitly identified factual error. Add the new version entry at the **top**, above prior version entries, using:

```text
Pixel Hero Maker [v.N] — Short release title
- Added/changed: ...
- Fixed: ... [only when supported by tests]
- Known limitations: ...
- Validation: ... [say exactly what was tested and what was not]
- Windows/Web packaging: ...
```

For a diagnostic-only release, say **"Diagnostic build — not a gameplay fix"**. Never say a fix is complete solely because simulated WebGL or pixel-level tests passed.

Check the **entire changelog**, including bottom `NOTES`, for stale executable names or version references. In the inspected v23 changelog, a historical note still said to run `Pixel Hero Maker [v.19].exe`; future release packaging must update such **current-use instructions** to the actual released executable while preserving historical version narratives.

The Windows release must also include accessible release information (e.g., `README-START-HERE.txt` and/or `Changelog.txt`). If Windows embeds a web changelog, ensure the embedded copy matches the Web release. Do not promise a standalone Windows changelog unless one is actually included.

## 5. README and user-facing instructions

Each release must include a current `README-START-HERE.txt` explaining:
- Exact release version and whether it is a fix, experiment, or diagnostic.
- Windows: extract into the chosen folder; run `Pixel Hero Maker [v.N].exe`; describe whether it opens a browser and whether its launcher window must remain open.
- Web: extract into the chosen folder; explain how to serve `index.html` locally if direct file access does not work.
- Any required testing steps, diagnostic capture button, generated output filename, and how to send results.
- Known limitations and unverified behavior.
- No console commands unless necessary; prefer UI-based tests when possible.

Update any version-specific README and HTML title strings that represent the current release. Avoid stale links to previous versions.

Document the default native export filename as `SpriteSheet.png` when the export format is PNG; `SpriteSheet` is the basename, and the extension comes from the existing export format. Do not suggest that the export has been patched unless it was tested.

## 6. Mandatory pre-delivery verification

Before presenting download links, inspect **the actual final ZIP files**, not just a staging directory:

1. Confirm exact case-sensitive filenames on disk, including spaces, brackets, parentheses, and `.zip` extension.
2. Open both ZIPs and run CRC/integrity tests.
3. List **every archive member** and verify there is no unexpected release wrapper folder, nested duplicate game folder, or path containing `%20`, `%5B`, `%5D`, `%28`, `%29` as a substitute for actual characters.
4. Confirm Windows `.exe` is at ZIP root and named for the same version.
5. Confirm Web `index.html` and `Changelog.txt` are at ZIP root; confirm `Build/WebGL.data`, `Build/WebGL.wasm`, `Build/WebGL.framework.js`, `Build/WebGL.loader.js`, and necessary `TemplateData` assets exist.
6. Check the release version in changelog, README, current-use instructions, and any UI title. Fix stale *operational* version references.
7. Confirm the Web and Windows packages contain the intended same game revision and diagnostic/repair scripts.
8. Run available functional tests. Report pixel tests, simulated GPU tests, browser tests, and actual Windows/Unity tests **separately**. Do not claim a test was performed when it was not.
9. Reopen and recheck ZIPs after any last-minute rename, rebuild, or copy.
10. Verify the exact final output paths exist before linking them.
11. Apply the tested literal-path `Link` delivery method in §7C, then perform the download-name verification in §7D, recording whether it was actually possible to test the user-facing downloaded filename.
12. Check the actual running Windows app/launcher title and the Web browser-tab title against the exact `Pixel Hero Maker [v.N]` string, with no edition or release-description suffix. Verify after startup, not solely by inspecting HTML or metadata.
13. Trigger a native sprite-sheet export in both Windows and Web. Verify the initial suggested filename is `SpriteSheet.png` for PNG exports, the exported bytes and sprite art are unchanged, and a user-specified filename is still respected. Report platforms not actually tested.

### Reference verification script (run against final artifacts)

```python
from pathlib import Path
from zipfile import ZipFile

root = Path("/mnt/data")
version = "v.24"  # set to the actual release version
for is_web in (False, True):
    filename = f"Pixel Hero Maker [{version}]" + (" (Web)" if is_web else "") + ".zip"
    path = root / filename
    assert path.is_file(), f"Missing: {path}"
    assert path.name == filename
    assert "_" not in path.name
    assert not any(code in path.name.lower() for code in ("%20", "%5b", "%5d", "%28", "%29"))
    with ZipFile(path) as z:
        assert z.testzip() is None, f"CRC failure: {filename}"
        names = [i.filename for i in z.infolist() if not i.is_dir()]
        assert names and all(not n.startswith("/") and ".." not in Path(n).parts for n in names)
        assert all(not any(code in n.lower() for code in ("%20", "%5b", "%5d", "%28", "%29")) for n in names)
        if is_web:
            required = {"index.html", "Changelog.txt",
                        "Build/WebGL.data", "Build/WebGL.wasm",
                        "Build/WebGL.framework.js", "Build/WebGL.loader.js"}
            assert required <= set(names), required - set(names)
        else:
            assert f"Pixel Hero Maker [{version}].exe" in names
        assert not any(n.startswith(f"Pixel Hero Maker [{version}]/") or
                       n.startswith(f"Pixel Hero Maker [{version}] (Web)/") for n in names)
        print("PASS", filename, len(names), "files")
```

This script is a **minimum structural check**, not a substitute for comparing embedded game content, checking all filenames for unintended characters, or running gameplay tests.

## 7. Downloaded-filename verification (separate release gate)

**The name on disk, the download link, and the filename the user actually receives are three different things. Verify them separately.** A ZIP with the right local name does **not** prove that a browser, app, or artifact host will save it under that name.

### A. Exact names to expect

For `v.N`, the user-visible saved download names must be **exactly**:

```text
Pixel Hero Maker [v.N].zip
Pixel Hero Maker [v.N] (Web).zip
```

Check the saved **basename**, not just the file extension, ZIP contents, link label, or a decoded URL. The filename must contain normal ASCII spaces, literal brackets and parentheses, and no underscores, `%` escape sequences, suffixes, or unexpected prefix. Do not confuse an automatic browser collision suffix such as `(1)` with a packaging error: retry in a clean download directory before drawing a conclusion.

### B. Verify the actual delivery path

1. Create the final files on disk under the exact names above, and verify them with `Path.name`, `repr(Path.name)`, and the ZIP checks in §6.
2. Attach or link **those exact files**; do not create separate copies with URL-encoded names, and do not substitute a filename derived from an encoded link target.
3. If a delivery mechanism exposes HTTP headers, inspect `Content-Disposition`. Prefer `attachment; filename="Pixel Hero Maker [v.N].zip"` (and the analogous Web name). If `filename*` is present, ensure its UTF-8-decoded value is the same exact basename. Check for unexpected underscores, percent-encoded literal filenames, or conflicting header values. Only configure headers when the delivery mechanism actually permits it.
4. **When possible, perform a real download through the same link or UI the user will use**, into a clean download directory. Inspect the resulting saved filename (and ZIP integrity). This is the strongest available verification of what the user receives.
5. If direct download simulation is not available, **state explicitly that the downloaded filename was not independently verified**. Do not claim that a correct `/mnt/data` filename guarantees the browser's saved name.
6. If the saved filename is wrong, first identify whether the error comes from the local artifact name, the link target, the server's download headers, or the client UI. Correct only the part under our control. Do not repeatedly rename or republish files without testing the relevant layer.
7. If the platform controls the filename and cannot be corrected from here, report the limitation clearly. Provide the exact intended filename and, if necessary, a rename instruction rather than falsely promising that the download will be named correctly.

**URL encoding rule:** `%20` in a link address can legitimately represent a space, and `%5B` / `%5D` can represent brackets. It is **not** evidence of a bad download filename by itself. Conversely, a file literally named `Pixel%20Hero%20Maker...zip` on disk **is** wrong. Never describe the two as interchangeable.

### C. Mandatory filename-safe download delivery — tested ChatGPT method

**Verified in the current ChatGPT interface on 2026-11-17:** The user confirmed that BOTH test ZIPs saved with their correct names when delivered using the rendered `Link` component with a **literal, unencoded sandbox path**. Earlier manually percent-encoded Markdown links produced encoded or underscored filenames; ordinary Markdown links containing unescaped spaces/brackets did not render reliably. Treat this as a verified delivery method for the tested interface, not a guarantee across all future clients.

1. **First choice for ChatGPT handoffs: render a `Link` component** whose `url` is the literal sandbox path to the already-verified artifact, preserving spaces, square brackets, and parentheses exactly. For example, the Windows link URL value is `sandbox:/mnt/data/Pixel Hero Maker [v.N].zip` and the Web link URL value is `sandbox:/mnt/data/Pixel Hero Maker [v.N] (Web).zip`. Give each link a readable title such as `Download Windows ZIP` or `Download Web ZIP`.
2. **Do not manually percent-encode** the `Link` URL value (`%20`, `%5B`, `%5D`, `%28`, `%29`) or replace spaces with underscores. Do not use a plain Markdown link with raw spaces/brackets as a substitute: this failed to render in the test. Do not create alternate encoded filenames on disk.
3. **If `Link` is unavailable in a future environment**, prefer a supported direct attachment with explicit basename, or a server-controlled download with matching `Content-Disposition` filename. A client-side Blob download is acceptable only if the environment truly supports authorized byte access and executable download controls. Never pretend that a nonfunctional workaround is available.
4. **After delivery, verify saved filenames separately** when possible. The 2026-11-17 user test passed for both test archives with literal-path `Link`; it does not establish the result for every future release or browser.
5. **If the saved name is still mangled**, diagnose the local file, link value, server headers, and receiving client separately. Try another supported and testable method; otherwise disclose the limitation and give the exact expected basename.

**Transport encoding is not itself a defect:** a platform may encode URLs internally. The requirement is that the actual downloaded filename remains the canonical literal basename. Do not confuse the displayed or transmitted URL with the saved filename.

### D. Release evidence checklist

Record the following for **each** Windows and Web artifact:

| Check | Required result |
|---|---|
| Exact local ZIP basename | PASS |
| Archive-root layout and integrity | PASS |
| Intended link points to exact local artifact | PASS |
| HTTP filename headers (if accessible) | PASS or NOT ACCESSIBLE |
| Actual downloaded basename via user-facing link | PASS, FAIL, or NOT TESTED |
| Actual downloaded ZIP integrity | PASS, FAIL, or NOT TESTED |

A result of **NOT TESTED** must not be represented as PASS. If the actual download name cannot be tested, the files may be delivered with that limitation disclosed, but must not be described as **verified to download with the correct name**.

## 8. Deliverables and communication

- Deliver **both** Windows and Web ZIPs unless the user explicitly requests only one.
- Link using human-readable labels and state the **exact on-disk filenames** in prose.
- Explain that `%20` and similar sequences may appear in URL-encoded link targets but must **never** be present literally in actual release filenames; see §7 for the required filename-safe delivery priority and the distinction between link encoding and downloaded basenames.
- If the platform displays encoded filenames or download names incorrectly, verify each layer using §7 and report any untested or uncontrollable behavior instead of claiming the downloaded name is correct.
- Do not add extra copies with alternate names to the final handoff unless requested.
- State exactly what changed, what passed, and what still requires in-game testing.
- Do not call an incomplete diagnostic a fully repaired game.

## 9. Source-of-truth and version discipline

Before any new release:
1. Inspect the current source build, existing release ZIPs, and `Changelog.txt`.
2. Determine which prior build is the actual code baseline; do not assume the newest ZIP is the cleanest baseline.
3. Maintain a single release version across filenames, executable, UI labels, changelog, and documentation. Enforce the exact game/window/browser title `Pixel Hero Maker [v.N]` and the default export basename `SpriteSheet` as release invariants.
4. Keep diagnostic artifacts and intermediate comparisons in a separate working directory, **not** mixed into release ZIP roots.
5. Preserve a reproducible record of code changes and regression tests, including bare arms, clothed arms/gloves, custom swatches, all firearm frames, and weapon-specific exceptions.
6. Never assert universal outfit/firearm support without evidence across the relevant combinations.

## 10. Specific known pitfalls from this project

- Earlier releases accidentally created wrapper folders inside ZIPs and then nested them again on extraction.
- Filenames with underscores and diagnostic suffixes violated the user's original naming convention.
- Some downloadable filenames were created literally with `%20` / `%5B` instead of normal spaces/brackets.
- A changelog contained stale instructions referring to a v19 executable while packaging v23.
- v20 copied incorrect animation frames and introduced stray weapon artwork.
- v22 reconstructed arm gaps using skin colors, damaging sleeves and gloves.
- v23's known-outfit and optional-reference strategy was not a universal fix.
- A complete firearm repair must consider every affected frame, actual clothing layers, palette swatches, and different weapon-specific marker patterns.

## 11. Mandatory UI title and sprite-sheet export default (2026-11-17 request)

These settings are standing requirements for **every future release**, including rebuilds that make unrelated repairs.

### A. Title visible on the game window

- The exact visible name must be `Pixel Hero Maker [v.N]`, with only `N` replaced by the release's number.
- Remove all appended *edition*, *patch*, *diagnostic*, *platform*, or descriptive names from the visible game window. Do not change the existing package-name distinction: the Web ZIP is still `Pixel Hero Maker [v.N] (Web).zip`.
- For the Windows build, check whichever title the player actually sees: native game window, launcher window if present, and any game-bearing browser window the executable opens. For the Web build, check the browser tab's `document.title` and any app-displayed window heading when it represents the game title.
- Where relevant, change the HTML `<title>`, startup `document.title` assignments, launcher/native window text, and build/application name metadata. Avoid a cosmetic HTML-only fix that is overwritten at runtime by the game or launcher.
- Keep changelog release subtitles **inside the changelog**; they must not be appended to the application-facing name.

### B. Native sprite-sheet export dialog

- Change the **prepopulated/default export basename** from `PixelHero-Idle-20x` (or any analogous animation/sizing-derived default) to exactly `SpriteSheet`.
- For existing PNG export, the suggested filename must be `SpriteSheet.png`; preserve the ordinary `.png` extension, output image data, sprite frames, grid, size, transparency, and export options.
- Do not automatically rename an exported file after a user enters a custom filename. This rule changes only the default suggestion; it does not prohibit user-specified names or platform-added collision suffixes when a same-named file already exists.
- Apply the same default to native sprite-sheet export on both Web and Windows; inspect the actual download/save workflow rather than only static strings in source. If different exporters exist, distinguish them and confirm the normal user-facing sprite-sheet export.

### C. Verification and reporting

- Before releasing, compare the real visible title and export dialog on both platforms with the exact required strings, across at least one ordinary sprite-sheet export.
- Distinguish **source strings changed**, **browser/Web functionally tested**, and **Windows functionally tested**. Do not claim completion if only a rules document or one platform was updated.
- Add a concise `Changelog.txt` entry for the version where this behavior first changes, without rewriting historical entries; leave the prior firearm/outfit/swatch correction untouched unless another explicit fix calls for edits.

**Release gate:** If naming, structure, changelog, Windows/Web parity, or verification is uncertain, do not publish the files as finished. Resolve the discrepancy or clearly label the limitation.
