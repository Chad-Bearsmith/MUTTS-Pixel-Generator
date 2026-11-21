# MUTTS Pixel Generator on GitHub

The public [GitHub repository](https://github.com/Chad-Bearsmith/MUTTS-Pixel-Generator) is the source for the [live playtest](https://chad-bearsmith.github.io/MUTTS-Pixel-Generator/).

1. Clone `Chad-Bearsmith/MUTTS-Pixel-Generator` with Git or GitHub Desktop. In Codex, select that repository in the workspace picker.
2. Run the verification and smoke tests in [Build and test notes](BUILD_AND_TEST.md). Keep local executables and release ZIPs outside Git.
3. Commit tested changes directly to `main` and push to `origin/main`.
4. Follow **Deploy public playtest** in the repository's [Actions tab](https://github.com/Chad-Bearsmith/MUTTS-Pixel-Generator/actions). The workflow stages the playable assets and publishes the Pages site after the smoke tests pass.

The repository's **Settings → Pages → Source** is set to **GitHub Actions**.

Pages runs integrity and smoke checks on each push to `main`. The separate **Source integrity and native smoke** workflow uses the same checks for pull requests and can also run manually.
