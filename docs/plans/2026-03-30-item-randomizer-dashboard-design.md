# BG Item Randomizer Dashboard — Design Document

**Date:** 2026-03-30
**Status:** Approved

## Purpose

A tracker dashboard for the Baldur's Gate Item Randomiser mod (by Fredrik Lindgren) that helps players — especially streamers — track which randomized item locations they've checked and what they found. Inspired by Zelda randomizer trackers (EmoTracker, PopTracker).

Supports BG1 + BG2 via EET (Enhanced Edition Trilogy). The randomiser shuffles items within power-level tiers, so a tier-1 item only appears at tier-1 locations. There is no spoiler log — tracking is manual.

## Two UI Targets

### 1. Web App
- React + Vite + Tailwind CSS
- Full-featured tracker with item codes, display names, notes
- Runs in browser, no server needed
- localStorage persistence

### 2. Electron Overlay
- Reuses React components from the web app
- Transparent, always-on-top, borderless window
- Compact checklist (display names only, no codes)
- For use while playing (not just streaming)

## Data Pipeline

### Input
- Randomiser mod 2DA files: `items/base/{bg1,bg2}.2da`, `locations/base/{bg1,bg2}.2da`
- Game ITM files + TLK string table for display names
- Source: `C:\Games\Baldur's Gate II Enhanced Edition modded`

### Extraction (build-time Node.js script)
1. Parse 2DA files → item list (tier, token, resource code, source, comment)
2. Parse 2DA files → location list (tier, target, area code, comment)
3. Read ITM files → get TLK string ref → look up display name
4. Generate initial area-region mapping from area codes
5. Output: `src/data/items.json`, `src/data/locations.json`, `src/data/regions.json`

### Output
Static JSON committed to the repo. Editable for manual curation of area groupings.

## Web App UI

### Header
- App title
- Progress summary ("47/239 locations checked")
- "Categorize by" toggle: **Tier** | **Area** | **Status**

### Main Content (grouped list)
- Collapsible group headers: name + progress count ("Tier 3 — 4/18 checked")
- Location rows:
  - Checkbox (click to toggle checked)
  - Location description (from 2DA comment)
  - Area code + target (e.g., `ar0301` / `maevar.cre`)
  - Found item badge (if assigned)
  - Note icon (if note exists)
  - "+" button → opens item assignment popup

### Item Assignment Popup (right-click or "+" button)
- Shows only items from the location's tier
- Each item: display name + resource code
- Click to assign/unassign
- Text field for freeform note
- Close button

## Electron Overlay

- Transparent, borderless, always-on-top window
- Compact single-column checklist
- Display names only (no resource codes)
- Check/uncheck locations
- Draggable, resizable
- Collapsible groups
- Semi-transparent dark background
- F9 toggle show/hide

## State Management

- Tracker state: checked locations, assigned items, notes
- Stored in localStorage, keyed by session name (supports multiple playthroughs)
- Export/import as JSON for backup/sharing
- Static data (items, locations) is read-only from bundled JSON

## Categorization

### Tier Grouping (v1 default)
Tiers from the randomiser mod:
- BG1 items: tiers 24-31
- BG2 SoA items: tiers 1-7
- BG2 ToB items: tiers 10-13
- Scroll tiers: sa-se (BG1), s4-s9 (BG2)

### Area Grouping (v1, requires curation)
Initial mapping generated from area codes in 2DA data. Will be manually curated after first field test. Regions group nearby areas visited together (e.g., "Athkatla - Docks" bundles ar0300-ar0334).

### Status Grouping
- Unchecked first, then checked. Useful late-game to see what remains.

## Interaction Model

- **Left-click** location → toggle checked/unchecked
- **Right-click** or **"+" button** → tier-filtered item assignment popup
- **Text note** field in popup for freeform annotations
- Overlay: check/uncheck only (item assignment in web app)

## Project Structure

```
bg-item-randomizer-dashboard/
├── scripts/              # Build-time data extraction
│   └── extract-data.ts
├── src/
│   ├── data/             # Generated static JSON
│   ├── components/       # Shared React components
│   ├── web/              # Web app entry point
│   └── overlay/          # Electron overlay entry point
├── electron/             # Electron main process
├── public/
├── docs/
│   └── plans/
└── package.json
```

## Future Enhancements (GitHub Issues)

- OBS browser source / broadcast view mode
- Automatic game-state reading (game connector)
- Map view with location pins
- Logic engine (accessibility color coding)
- Multi-device sync / backend
- Area grouping curation tooling
