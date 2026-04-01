# Overlay Settings & Anchor Button Design

Date: 2026-04-01

## Summary

Add a settings panel to the BG Item Randomizer overlay with configurable keybinding and monitor selection. Settings are synced between the web app and overlay via localStorage. The overlay gains a three-state model (hidden/anchor/expanded) with a tiny anchor button inspired by BG Radar Overlay.

## Overlay States

The overlay has three visual states:

1. **Hidden** -- completely invisible (initial state on launch)
2. **Anchor only** -- a tiny ~30x30px button pinned to the top-right of the selected monitor. Semi-transparent, minimal footprint during gameplay.
3. **Expanded** -- the full checklist overlay, anchored from the button's position

### Interactions

- **Keybinding (default F9)**: toggles Hidden <-> Anchor
- **Left-click anchor**: toggles Anchor <-> Expanded
- **Right-click anchor**: opens settings panel (replaces checklist in the same window space)

## Settings Panel

Compact panel shown on right-click anchor (overlay) or gear icon click (web app).

| Setting | Control | Default |
|---------|---------|---------|
| Toggle keybinding | "Press a key" recorder button | F9 |
| Monitor | Dropdown of detected displays | Primary display |

### Behavior

- Changes apply immediately (no save button)
- Persisted to localStorage under `bg-randomizer-settings`
- In overlay: panel appears in place of the checklist, close via X or right-click anchor again
- In web app: popover from a gear icon in the header

### Key Recorder

- Supports single keys (F1-F12) and modifier combos (Ctrl+F9, Alt+H, etc.)
- Click to enter listening mode, displays "Press a key..."
- Escape cancels recording without changing the binding

## Data Flow & Architecture

### Settings Store

localStorage key `bg-randomizer-settings`:
```json
{
  "keybinding": "F9",
  "monitorId": 0
}
```

### Preload API

`window.electronAPI` expands with:
- `updateKeybinding(key: string)` -- re-register global shortcut
- `updateMonitor(monitorId: number)` -- reposition window
- `getDisplays(): { id: number, label: string }[]` -- list available monitors

### Settings Change Flow

1. User changes setting in UI (overlay or web app)
2. New value written to localStorage
3. If in overlay renderer: immediately calls `electronAPI.updateKeybinding()` or `updateMonitor()`
4. If changed from web app: overlay renderer picks up change via `storage` event, relays via IPC

### Electron Main Process

- `ipcMain.handle('update-keybinding', ...)` -- unregister old, register new shortcut
- `ipcMain.handle('update-monitor', ...)` -- reposition window to selected display
- `ipcMain.handle('get-displays', ...)` -- return `screen.getAllDisplays()` info
- On startup: reads `settings.json` from app data dir (pre-renderer fallback)

### Startup Sequence

1. Main process reads `settings.json` from `app.getPath('userData')`
2. Registers keybinding, positions on correct monitor
3. Window starts hidden
4. Keybinding press -> shows anchor

## Component Structure

| Component | Location | Purpose |
|-----------|----------|---------|
| `SettingsPanel` | `src/components/SettingsPanel.tsx` | Shared settings UI -- key recorder + monitor dropdown |
| `KeybindingInput` | `src/components/KeybindingInput.tsx` | "Press a key" recorder widget |
| `OverlayAnchor` | `src/components/OverlayAnchor.tsx` | Tiny button -- left-click expand/collapse, right-click settings |
| `OverlayView` | modified | Three-state rendering: anchor, expanded checklist, or settings |
| `Header` | modified | Gear icon opens `SettingsPanel` popover |
| `electron/main.ts` | modified | IPC handlers, dynamic keybinding, monitor positioning |
| `electron/preload.ts` | modified | Exposes settings API |
| `src/settings.ts` | new | `useSettings()` hook, localStorage read/write, defaults |

### OverlayView State Machine

```
Hidden --(keybinding)--> Anchor --(left-click)--> Expanded
  ^                        |  ^                      |
  '--(keybinding)----------'  '--(left-click)--------'
                               |
                          (right-click)
                               |
                               v
                           Settings --(close/right-click)--> Anchor
```

## Architecture: localStorage + IPC Relay

Settings stored in localStorage (same pattern as sessions). Both web app and overlay renderer read/write directly. When the overlay renderer detects a change, it sends an IPC message to the main process to re-register the keybinding or reposition the window. Electron main also writes a `settings.json` mirror to `app.getPath('userData')` for pre-renderer startup.
