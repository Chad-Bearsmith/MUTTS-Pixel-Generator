# Publish Pixel Hero Maker to your **private** GitHub repository

**Recommended for Windows:** GitHub Desktop. Do NOT upload this handoff ZIP itself into a blank GitHub repository; GitHub does not unpack a ZIP into source files. Instead unzip it on your computer and commit the files inside the folder.

1. Install and sign in to GitHub Desktop: https://desktop.github.com/.
2. Extract `PixelHero-Codex-GitHub-Handoff.zip`. It contains one folder named `PixelHero-Codex-Repository` with all actual source files and hidden `.gitignore`/`.gitattributes` files. Don't create a second nested folder while copying.
3. In GitHub Desktop choose **File → Add local repository…**, select the extracted `PixelHero-Codex-Repository` folder. If Desktop says this folder is not a Git repository, select **create a repository here**, then choose that folder. Or use **File → New repository…**, name it `pixel-hero-maker`, create it, and copy the *contents* of the extracted folder into the newly created repository folder.
4. In the **Changes** tab, review the file list. Use a commit message such as `Import Pixel Hero Maker v89 experimental source and Codex handoff`. Click **Commit to main** (or the branch shown).
5. Click **Publish repository**. Choose your GitHub account, repository name `pixel-hero-maker`, and **leave `Keep this code private` checked**. Publish it.
6. Select **Repository → View on GitHub** and confirm `README.md`, `AGENTS.md`, `docs/CODEX_HANDOFF.md`, `game/`, `tests/`, and `prototype/` appear as directories/files, not as one uploaded ZIP. Confirm the lock/private label. Do not upload the entire release ZIP to repository root.
7. Open Codex/ChatGPT Cloud and connect GitHub when prompted, then choose `pixel-hero-maker` in the reusable environment/repository selector. Ensure your GitHub authorization allows access to this private repo. A separate ChatGPT GitHub *reading* connection is not necessarily the same permission as Codex task Git access.
8. Start with the analysis-only prompt in `docs/CODEX_FIRST_PROMPT.md` and review its findings before asking Codex to implement v.90.

**Why Desktop rather than uploading via GitHub's website?** This archive contains many files including `WebGL.data` around 29 MB. GitHub's browser uploader has a smaller per-file limit and doesn't expand ZIPs. Desktop commits/pushes the files using Git and is suitable for the initial upload.

**GitHub is the persistent copy once pushed.** Local edits do not reach GitHub until you commit and push; Codex cloud tasks can also have separate workspaces. Review/merge or push completed work so your repo is the ongoing source of truth.

**Official help:**
- https://docs.github.com/en/desktop/overview/creating-your-first-repository-using-github-desktop
- https://docs.github.com/en/desktop/adding-and-cloning-repositories/adding-an-existing-project-to-github-using-github-desktop
- https://help.openai.com/en/articles/20001545-using-codex-cloud
