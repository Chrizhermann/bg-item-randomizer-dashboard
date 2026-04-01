# Unified Main-Process Store

**Date**: 2026-04-02
**Status**: Approved

## Problem

The app has two Electron BrowserWindows (main app + overlay) that need shared state. Currently state lives in localStorage per renderer, and Electron doesn't reliably fire StorageEvent between windows. Result: overlay and main window are isolated — checking a box in one doesn't appear in the other.

Three separate state systems exist, none syncing properly:
- Sessions (checked, assigned, notes) — localStorage, read by store.ts
- Overlay settings (keybinding, monitor) — localStorage + JSON file in main process
- Window bounds — JSON file in main process only

## Solution

Single source of truth in the Electron main process, backed by one JSON file.

## Store Shape

One JSON file at `app.getPath('userData')/store.json`:

```typescript
interface AppStore {
  settings: {
    keybinding: string        // default: 'F9'
    monitorId: number         // Electron display ID
    overlayBounds?: Bounds
    mainBounds?: Bounds
  }
  sessions: Record<string, SessionState>
  activeSessionName: string | null
}
```

Replaces: `overlay-settings.json`, `bg-randomizer-sessions`, `bg-randomizer-active-session`, `bg-randomizer-settings` in localStorage.

## IPC Contract

```
Renderer → Main (request/response):
  'store:get'   ()                          → AppStore
  'store:patch'  (patch: DeepPartial<AppStore>) → void

Main → Renderer (push):
  'store:changed' (store: AppStore)
```

### Flow

1. **Startup**: Renderer calls `store:get` to populate React state
2. **User action**: Renderer sends `store:patch` with changed fields, optimistically updates local React state
3. **Main process**: Deep-merges patch into store → writes to disk (debounced) → broadcasts `store:changed` to all windows
4. **Side effects**: Main checks if keybinding/monitorId changed, re-registers shortcut or repositions overlay

### Deep Merge Rules

- Objects merge recursively
- `null` deletes the key (session deletion, reset)
- Primitives and arrays replace entirely

## Main Process Store Manager

```typescript
// electron/store.ts
class AppStoreManager {
  get(): AppStore
  patch(partial: DeepPartial<AppStore>): AppStore
  // private: read(), write() (debounced 500ms)
}
```

Side effects triggered after patch when relevant settings change.

## Renderer Hook

```typescript
function useAppStore() {
  // 1. Load initial state via store:get
  // 2. Listen for store:changed broadcasts
  // 3. patch() — optimistic local update + fire-and-forget IPC
  return { store, patch }
}
```

Action methods (toggleChecked, assignItem, etc.) become thin wrappers around `patch`.

Browser fallback: when `window.electronAPI` is undefined, falls back to localStorage for degraded single-window dev mode.

## Preload API

```typescript
electronAPI = {
  isOverlay: boolean,
  isElectron: true,
  storeGet: () => AppStore,
  storePatch: (patch) => void,
  onStoreChanged: (callback) => unsubscribe,
  getDisplays: () => DisplayInfo[],
}
```

`updateKeybinding` and `updateMonitor` removed — settings changes go through `storePatch`.

## File Changes

| File | Change |
|------|--------|
| `electron/store.ts` | New — AppStoreManager class |
| `electron/main.ts` | Slim down — use store manager, keep side-effects |
| `electron/preload.ts` | Rewrite — store IPC + getDisplays |
| `src/electron-api.d.ts` | Update to match preload |
| `src/store.ts` | Rewrite — useAppStore hook with IPC |
| `src/settings.ts` | Delete — absorbed into unified store |
| `src/types.ts` | Add AppStore, DeepPartial types |
| `src/deep-merge.ts` | New — shared deepMerge utility |
| `src/App.tsx` | Replace useTrackerStore + useSettings with useAppStore |
| `src/components/SettingsPanel.tsx` | Use patch() instead of direct IPC |
| Components receiving props | No change |

## Migration

On first launch after upgrade: if old `overlay-settings.json` exists, merge into new store, delete old file. localStorage data ignored (never read).
