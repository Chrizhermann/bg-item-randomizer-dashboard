# BG Item Randomizer Dashboard

Tracker dashboard for the Baldur's Gate Item Randomiser mod (by Fredrik Lindgren). Two UI targets: React web app and Electron overlay.

## Quick Start

```bash
npm install
npm run dev          # Start web app + Electron overlay
npm run build        # Production build
npm run extract-data # Regenerate data from game files
```

## Architecture

- **Web app**: React + Vite + Tailwind CSS — full tracker with item codes, assignment, notes
- **Electron overlay**: Transparent always-on-top window — compact checklist for use while playing
- **Shared codebase**: Both targets use the same React components and localStorage state
- **Data pipeline**: Build-time script parses mod 2DA files + game ITM/TLK binaries → static JSON

## Key Directories

- `scripts/` — Data extraction (parse-2da.ts, read-tlk.ts, read-itm.ts, extract-data.ts)
- `src/data/` — Generated JSON (items, locations, groups, regions) — committed, manually curable
- `src/components/` — React components (Header, LocationList, ItemPopup, OverlayView, etc.)
- `src/store.ts` — localStorage-based state management (sessions, checked/assigned/notes)
- `src/grouping.ts` — Location grouping logic (tier, area, status)
- `electron/` — Electron main process and preload

## Game Data Source

Default: `C:/Games/Baldur's Gate II Enhanced Edition modded/`
Override with `BG_GAME_DIR` env variable.

## Overlay Mode

- Electron app opens with `?mode=overlay` automatically
- Test in browser: `http://localhost:5173/?mode=overlay`
- F9 toggles overlay visibility
- State is shared with the web app via localStorage
