# README + Release Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a discoverable alpha build: a README that a BG streamer can land on, and a GitHub Actions workflow that publishes a rolling `latest` release with Windows / macOS / Linux artifacts on every push to `main`.

**Architecture:** `package.json` gets multi-platform `electron-builder` targets and a `0.2.0-alpha` version bump. A single `release.yml` workflow uses a 3-runner matrix to build per platform, then a final job replaces the `latest` GitHub Release with all three artifacts. README is gamer-first; dev instructions go at the bottom.

**Tech Stack:** electron-builder 26.8, GitHub Actions, Node 20, softprops/action-gh-release@v2.

**Design doc:** `docs/plans/2026-04-19-readme-and-release-workflow-design.md`

---

## Task 1: Update package.json (version + multi-platform build config)

**Files:**
- Modify: `package.json`

**Step 1: Bump version and add mac/linux build config**

Change `"version": "0.0.0"` → `"version": "0.2.0-alpha"`.

Inside the existing `"build"` object, add (alongside the existing `win`, `portable`, `nsis` entries):

```json
"mac": {
  "target": ["dmg"],
  "icon": "public/icon.png",
  "category": "public.app-category.games"
},
"linux": {
  "target": ["AppImage"],
  "icon": "public/icon.png",
  "category": "Game"
},
"dmg": { "artifactName": "BG-Randomizer-${version}.dmg" },
"appImage": { "artifactName": "BG-Randomizer-${version}.AppImage" }
```

**Step 2: Validate JSON**

Run: `node -e "console.log(require('./package.json').version)"`
Expected: `0.2.0-alpha`

**Step 3: Verify build section**

Run: `node -e "const p = require('./package.json'); console.log(Object.keys(p.build))"`
Expected output contains: `appId`, `productName`, `directories`, `files`, `win`, `portable`, `nsis`, `mac`, `linux`, `dmg`, `appImage`

No commit yet — all changes committed together in Task 7.

---

## Task 2: Stage hero screenshots in docs/images/

**Files:**
- Create: `docs/images/tracker.png` (copied from `webapp-tracker.png`)
- Create: `docs/images/overlay.png` (copied from `audit-26-overlay-mode.png` or `audit-28-overlay-full.png`)

**Step 1: Create directory**

Run: `mkdir -p docs/images`

**Step 2: Copy screenshots**

Run:
```bash
cp webapp-tracker.png docs/images/tracker.png
cp audit-28-overlay-full.png docs/images/overlay.png
```

**Step 3: Verify**

Run: `ls docs/images/`
Expected: `overlay.png  tracker.png`

These are the only images that get tracked — all other loose PNGs are excluded in Task 3.

---

## Task 3: Update .gitignore

**Files:**
- Modify: `.gitignore`

**Step 1: Append entries**

Add to `.gitignore`:
```
# Local screenshots / audit artifacts (not docs/images/)
/audit-*.png
/webapp-*.png
/snapshot-header.md
/.playwright-mcp/

# Build output
/release/

# OS
.DS_Store
```

Note the leading `/` — these only match the repo root, so `docs/images/*.png` still tracks correctly.

**Step 2: Verify docs/images/ is NOT ignored**

Run: `git check-ignore -v docs/images/tracker.png`
Expected: exit code 1 (not ignored). If it prints a match, the pattern is wrong.

Run: `git check-ignore -v audit-01-initial-load.png`
Expected: a line indicating `.gitignore` matched — this file IS ignored.

---

## Task 4: Create README.md

**Files:**
- Create: `README.md`

**Step 1: Write the README**

```markdown
# BG Item Randomizer Dashboard

Tracker for [Fredrik Lindgren's Baldur's Gate 1/2 Item Randomiser mod](https://github.com/FredrikLindgren/bgee-itemrandomiser). A web app and a transparent Electron overlay you can keep on top while you play.

![Tracker](docs/images/tracker.png)

## Download (alpha)

Grab the latest build from the [**Releases page**](../../releases/latest):

| Platform | File | Notes |
|----------|------|-------|
| Windows  | `BG-Randomizer-0.2.0-alpha.exe`       | Portable, no install. SmartScreen may warn — choose "Run anyway". |
| macOS    | `BG-Randomizer-0.2.0-alpha.dmg`       | Untested. Right-click → Open to bypass Gatekeeper. |
| Linux    | `BG-Randomizer-0.2.0-alpha.AppImage`  | Untested. `chmod +x` then run. |

macOS and Linux builds are produced by CI but have **not been tested by the maintainer** — please [open an issue](../../issues) if something breaks.

## Features

- Track every randomized item across BG1 and BG2
- Group locations by tier, area, or completion status
- Session support — run multiple playthroughs side-by-side
- Notes, party-member assignment, and item-code display
- Search by item name or code

## Overlay mode (for streamers & players)

![Overlay](docs/images/overlay.png)

- Launch the desktop app — it opens an always-on-top transparent window
- Press **F9** to toggle visibility
- Click the **IR** badge to expand the checklist, click again to collapse
- **Drag the IR badge** to reposition the overlay anywhere on screen
- State syncs with the web app via localStorage

## Status

Alpha. Things change fast:
- localStorage format may change between releases (your session data could wipe)
- macOS and Linux builds are built but not tested
- No auto-update yet — re-download when you want the latest

## For developers

```bash
git clone https://github.com/Chrizhermann/bg-item-randomizer-dashboard
cd bg-item-randomizer-dashboard
npm install

npm run dev              # start web app + Electron overlay
npm run build            # production build
npm run package          # build Windows .exe locally
npm run extract-data     # regenerate data from game files (needs BG install)
```

See [`CLAUDE.md`](CLAUDE.md) for architecture notes.

## Credits

- Original mod: [Fredrik Lindgren](https://github.com/FredrikLindgren) — Baldur's Gate Item Randomiser
- Dashboard: Christopher Hermann
```

**Step 2: Verify links**

Run: `grep -oE '\[.*?\]\(.*?\)' README.md`
Expected: sanity-check each link — the relative paths (`docs/images/*`, `CLAUDE.md`, `../../releases/latest`) should be correct for GitHub rendering.

---

## Task 5: Create .github/workflows/release.yml

**Files:**
- Create: `.github/workflows/release.yml`

**Step 1: Create directory**

Run: `mkdir -p .github/workflows`

**Step 2: Write the workflow**

```yaml
name: Release (latest)

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: release
  cancel-in-progress: true

permissions:
  contents: write

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: windows-latest
            builder_flag: --win
          - os: macos-latest
            builder_flag: --mac
          - os: ubuntu-latest
            builder_flag: --linux
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - run: npm run build

      - name: Build platform artifact
        run: npx electron-builder ${{ matrix.builder_flag }} --publish never

      - uses: actions/upload-artifact@v4
        with:
          name: release-${{ matrix.os }}
          path: |
            release/*.exe
            release/*.dmg
            release/*.AppImage
          if-no-files-found: error
          retention-days: 7

  release:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          path: artifacts
          merge-multiple: true

      - name: List artifacts
        run: ls -la artifacts/

      - name: Delete old latest release and tag
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh release delete latest --yes --cleanup-tag --repo ${{ github.repository }} || echo "no existing latest release"

      - uses: softprops/action-gh-release@v2
        with:
          tag_name: latest
          name: Latest build
          body: |
            Rolling alpha build from `main` @ ${{ github.sha }}.

            - Windows: portable `.exe` (no install)
            - macOS: `.dmg` (untested — please report issues)
            - Linux: `.AppImage` (untested — please report issues)

            Built: ${{ github.event.head_commit.timestamp }}
          files: artifacts/**/*
          make_latest: true
          prerelease: true
```

Cross-platform detection via the `include` matrix is more reliable than nested `runner.os` ternaries.

**Step 3: Validate YAML locally (optional but quick)**

Run: `node -e "const yaml=require('yaml'); yaml.parse(require('fs').readFileSync('.github/workflows/release.yml','utf8'))"` 

If `yaml` module not available, skip — GitHub will reject on push if the YAML is invalid.

---

## Task 6: Verify local build still works

**Step 1: Build client + electron bundle**

Run: `npm run build`
Expected: successful build, no errors about the new mac/linux config (electron-builder config only matters at package time, not build time).

**Step 2: Dry-run electron-builder config parse (optional)**

Run: `npx electron-builder --help 2>&1 | head -5`
Expected: help output, no config parse errors.

Do **not** run full `npm run package` — it only builds Windows locally and takes minutes. The workflow will verify all three platforms.

---

## Task 7: Commit release infrastructure

**Step 1: Stage the new files**

```bash
git add package.json
git add docs/images/tracker.png docs/images/overlay.png
git add .gitignore
git add README.md
git add .github/workflows/release.yml
```

**Step 2: Review the diff**

Run: `git status && git diff --cached --stat`

Expected staged files:
- `package.json` (modified)
- `.gitignore` (modified)
- `README.md` (new)
- `.github/workflows/release.yml` (new)
- `docs/images/tracker.png` (new)
- `docs/images/overlay.png` (new)

**Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
chore: add README, release workflow, and multi-platform build config

Bumps to 0.2.0-alpha. Adds a rolling 'latest' GitHub Release that
builds Windows/macOS/Linux artifacts on every push to main.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Commit prior uncommitted work

Before this plan, there was already a batch of uncommitted work on `main` — the overlay drag fix plus various modifications.

**Step 1: Check what's left after Task 7's commit**

Run: `git status`

Expected remaining modified files:
- `electron/main.ts`, `electron/preload.ts`
- `src/components/GroupHeader.tsx`, `Header.tsx`, `LocationList.tsx`, `LocationRow.tsx`, `OverlayAnchor.tsx`, `OverlayView.tsx`, `SettingsPanel.tsx`
- `src/data/locations.json`, `src/data/regions.json`
- `src/electron-api.d.ts`, `src/grouping.ts`

And untracked:
- `scripts/update-location-names.ts`
- `src/components/InlineItemPicker.tsx`, `ItemPoolPanel.tsx`
- `docs/plans/2026-04-01-item-picker-redesign.md`

The loose `webapp-*.png`, `audit-*.png`, `snapshot-header.md`, `.playwright-mcp/` should now be ignored — verify with `git status` (they should not appear as untracked).

**Step 2: Stage intentionally (no `git add -A`)**

```bash
git add electron/ src/ scripts/update-location-names.ts docs/plans/2026-04-01-item-picker-redesign.md
```

**Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: fix overlay drag bug and add inline item picker

Fixes horizontal window growth during drag by replacing setPosition()
with setBounds() using constant ANCHOR_SIZE (Electron #9477 workaround).
Also snaps window back to exact anchor size in stop-drag handler.

Adds inline item picker component and location/region data updates.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

**Step 4: Verify clean working tree**

Run: `git status`
Expected: `nothing to commit, working tree clean` (or only ignored untracked junk).

---

## Task 9: Push and monitor first release run

**Step 1: Push**

Run: `git push origin main`

**Step 2: Check the workflow triggered**

Wait ~5 seconds, then: `gh run list --limit 3 --workflow="Release (latest)"`
Expected: one run with status `queued` or `in_progress`.

**Step 3: Watch the run**

Run: `gh run watch`

This streams logs until completion. Total expected time: ~5-10 minutes (3 platforms in parallel, slowest = electron-builder on macOS).

**Step 4: Handle failures**

If the **Windows** job fails: must be fixed. This is the primary target.

If **macOS** or **Linux** fails:
1. Read the failing step: `gh run view <run-id> --log-failed`
2. Common causes:
   - Missing icon format (electron-builder wants `.icns` for mac, `.png` for linux — we're reusing `public/icon.png` which may need conversion)
   - Missing system dependencies on Linux
3. If the fix is trivial (e.g., add a dependency install step), fix + commit + push.
4. If non-trivial, **disable that platform in the matrix** with a comment `# TODO: re-enable, see issue #XX` and open a GitHub issue to track it. Do not block the Windows release.

**Step 5: Verify the release**

Run: `gh release view latest`
Expected: tag `latest`, 3 assets listed (exe, dmg, AppImage), `prerelease: true`.

**Step 6: Download and smoke-test the Windows exe**

From the Releases page, download `BG-Randomizer-0.2.0-alpha.exe`, run it, confirm the app opens and the overlay drag doesn't grow the window horizontally (the fix from prior work).

---

## Done criteria

- [ ] `latest` GitHub Release exists with at least the Windows `.exe`
- [ ] README renders correctly on the repo landing page (screenshots visible, Download links work)
- [ ] Downloaded Windows `.exe` launches and the overlay drag fix works
- [ ] macOS/Linux either included or explicitly disabled with a tracking issue
