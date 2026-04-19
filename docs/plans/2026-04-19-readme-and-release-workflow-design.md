# README + Release Workflow Design

**Date:** 2026-04-19
**Status:** Approved

## Context

The project has no README and no CI. Releases are built manually via `npm run package`. Goal: make the project installable by a casual gamer who lands on the GitHub repo and wants to try it.

## Decisions

- **Release model:** Rolling `latest` GitHub Release, overwritten on every push to `main`. No semver ceremony — this is alpha software for casual users. Manual `workflow_dispatch` available as an escape hatch.
- **Platforms:** Windows, macOS, Linux. macOS/Linux are untested and explicitly flagged as such in the README. Cost is low; reach is nice.
- **README audience:** Gamers first (download link front and center, screenshots, feature list), developers at the bottom.
- **Versioning:** Bump `0.0.0` → `0.2.0-alpha` to match v0.2 roadmap and to signal alpha status in filenames.
- **No code signing** — Windows SmartScreen, macOS "unidentified developer", and AppImage "needs chmod +x" are accepted trade-offs for an alpha.

## Architecture

### 1. `package.json` changes

```json
{
  "version": "0.2.0-alpha",
  "build": {
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
  }
}
```

Existing `win.portable` config stays as-is.

### 2. `.github/workflows/release.yml`

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
        os: [windows-latest, macos-latest, ubuntu-latest]
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
        run: npx electron-builder --${{ runner.os == 'Windows' && 'win' || runner.os == 'macOS' && 'mac' || 'linux' }} --publish never
      - uses: actions/upload-artifact@v4
        with:
          name: release-${{ matrix.os }}
          path: |
            release/*.exe
            release/*.dmg
            release/*.AppImage
          if-no-files-found: error

  release:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          path: artifacts
          merge-multiple: true
      - name: Delete old latest release
        run: gh release delete latest --yes --cleanup-tag || true
        env: { GH_TOKEN: ${{ secrets.GITHUB_TOKEN }} }
      - uses: softprops/action-gh-release@v2
        with:
          tag_name: latest
          name: Latest build
          body: |
            Rolling alpha build from `main` @ ${{ github.sha }}.
            Windows: portable .exe — no install.
            macOS/Linux: untested. Please report issues.
          files: artifacts/**/*
          make_latest: true
          prerelease: true
```

### 3. `README.md`

Gamer-first structure:
1. Title + one-line pitch
2. Hero screenshot
3. **Download (alpha)** — direct links to latest release assets per platform, with "untested" caveat on mac/linux
4. **Features** — bullet list
5. **Overlay mode** — screenshot + F9 + drag IR badge
6. **Status** — alpha caveat (localStorage wipes, platform untested)
7. **For developers** — clone/install/dev/build commands, link to CLAUDE.md
8. **Credits** — link Fredrik Lindgren's mod

Screenshots: `webapp-tracker.png` as hero, one overlay shot. The `audit-*.png` files are excluded (they're UX audit artifacts).

### 4. `.gitignore` additions

```
audit-*.png
webapp-*.png
snapshot-header.md
.playwright-mcp/
release/
```

Most of these are already untracked; this prevents them from being accidentally staged.

### 5. Commit split

- Commit 1: `chore: add README, release workflow, and gitignore updates`
- Commit 2: `feat: overlay drag fix + prior uncommitted work`

Push `main` — first release job fires immediately.

## Open Risks

- First workflow run might fail on macOS/Linux due to unknown electron-builder quirks (e.g., missing icon format, missing dependencies). If so, disable that platform in the matrix and open a follow-up issue.
- SmartScreen/Gatekeeper warnings will confuse some users on first download. Mitigation: mention in README.
- The `delete old latest release` step is destructive — concurrency group prevents races, but a bad commit to main will replace a good release. Acceptable for alpha.

## Out of Scope

- Code signing certificates (would require $99/yr Apple cert, Windows EV cert)
- Auto-update via `electron-updater` (could add later once releases stabilize)
- Separate stable release channel
- Release notes / changelog generation
