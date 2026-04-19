# Item Picker Redesign

## Problem
- Item assignment popup is a heavy full-screen modal for a quick action
- Trigger is a tiny "+" button, easy to miss
- No way to see the item pool for a group at a glance
- No indication of which items are already assigned elsewhere

## Design

### Group Header — Item Pool Panel
- Each group header gets a pool toggle button
- Expands a panel between header and location rows
- Shows all items for the group's tier(s) in a compact multi-column grid
- Items assigned anywhere in the session shown with strikethrough + muted
- Shows "X/Y assigned" count

### Location Row — Inline Item Picker
- Click row (not checkbox) or "+" to expand inline picker below the row
- Only one row expanded at a time (auto-collapse previous)
- Contains: search input (auto-focused), compact item list, note input
- Items assigned elsewhere shown with strikethrough
- Current assignment highlighted in amber
- Click to assign/unassign, auto-collapses
- Escape closes, right-click still works

### "Already Picked" Tracking
- Derive assigned item set from all locationStates in the session
- Pass down to both pool panel and inline picker
- Strikethrough + muted style for assigned items everywhere

## Key Changes
- `LocationGroup` gains `tiers: string[]` field
- New `ItemPoolPanel` component
- `ItemPopup` replaced by `InlineItemPicker` (inline, not modal)
- `LocationRow` manages expand state (lifted to `LocationList`)
- `GroupHeader` gets pool toggle
- `LocationList` tracks expandedRowId and expandedPoolId
