# Unified Main-Process Store — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace fragmented localStorage + JSON state with a single Electron main-process store, IPC contract, and cross-window broadcast sync.

**Architecture:** Main process owns one JSON file (`store.json`). Renderers read/write via IPC (`store:get`, `store:patch`). Main broadcasts `store:changed` to all windows after every patch. Renderers keep optimistic local state.

**Tech Stack:** Electron IPC (`ipcMain.handle`, `ipcRenderer.invoke`, `webContents.send`), React hooks, JSON file persistence.

**Design doc:** `docs/plans/2026-04-02-unified-store-design.md`

---

### Task 0: Add shared types (`AppStore`, `DeepPartial`)

**Files:**
- Modify: `src/types.ts:54-57` (replace `OverlaySettings`, add `AppStore`, `DeepPartial`, `Bounds`)

**Step 1: Update types**

Replace the `OverlaySettings` interface and add new types at the end of `src/types.ts`:

```typescript
export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export interface OverlaySettings {
  keybinding: string
  monitorId: number
  overlayBounds?: Bounds
  mainBounds?: Bounds
}

export interface AppStore {
  settings: OverlaySettings
  sessions: Record<string, SessionState>
  activeSessionName: string | null
}

export type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> | null }
  : T
```

Note: `OverlaySettings` now includes `Bounds` fields (previously only in electron/main.ts). This unifies the type.

**Step 2: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Errors in files that import `OverlaySettings` (because we added fields) — that's fine, we'll fix them in later tasks.

**Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add AppStore and DeepPartial types for unified store"
```

---

### Task 1: Create `deepMerge` utility

**Files:**
- Create: `src/deep-merge.ts`

**Step 1: Write deepMerge**

Create `src/deep-merge.ts`:

```typescript
/**
 * Deep merge source into target.
 * - Objects merge recursively
 * - null deletes the key
 * - Primitives and arrays replace entirely
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Record<string, unknown>,
): T {
  const result = { ...target }

  for (const key of Object.keys(source)) {
    const sourceVal = source[key]

    if (sourceVal === null) {
      delete (result as Record<string, unknown>)[key]
      continue
    }

    const targetVal = (target as Record<string, unknown>)[key]

    if (
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      typeof targetVal === 'object' &&
      targetVal !== null &&
      !Array.isArray(targetVal)
    ) {
      ;(result as Record<string, unknown>)[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>,
      )
    } else {
      ;(result as Record<string, unknown>)[key] = sourceVal
    }
  }

  return result
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | head -5`
Expected: No new errors from this file.

**Step 3: Commit**

```bash
git add src/deep-merge.ts
git commit -m "feat: add deepMerge utility for store patch operations"
```

---

### Task 2: Create `AppStoreManager` in main process

**Files:**
- Create: `electron/store.ts`

**Step 1: Write the store manager**

Create `electron/store.ts`:

```typescript
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { app, BrowserWindow } from 'electron'

interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

interface OverlaySettings {
  keybinding: string
  monitorId: number
  overlayBounds?: Bounds
  mainBounds?: Bounds
}

interface LocationState {
  checked: boolean
  assignedItemId: string | null
  note: string
}

interface SessionState {
  name: string
  createdAt: string
  locationStates: Record<string, LocationState>
}

export interface AppStore {
  settings: OverlaySettings
  sessions: Record<string, SessionState>
  activeSessionName: string | null
}

const DEFAULT_STORE: AppStore = {
  settings: {
    keybinding: 'F9',
    monitorId: 0,
  },
  sessions: {},
  activeSessionName: null,
}

/**
 * Deep merge source into target.
 * - Objects merge recursively
 * - null deletes the key
 * - Primitives and arrays replace entirely
 */
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Record<string, unknown>,
): T {
  const result = { ...target }

  for (const key of Object.keys(source)) {
    const sourceVal = source[key]

    if (sourceVal === null) {
      delete (result as Record<string, unknown>)[key]
      continue
    }

    const targetVal = (target as Record<string, unknown>)[key]

    if (
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      typeof targetVal === 'object' &&
      targetVal !== null &&
      !Array.isArray(targetVal)
    ) {
      ;(result as Record<string, unknown>)[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>,
      )
    } else {
      ;(result as Record<string, unknown>)[key] = sourceVal
    }
  }

  return result
}

export class AppStoreManager {
  private store: AppStore
  private filePath: string
  private writeTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    this.filePath = join(app.getPath('userData'), 'store.json')
    this.store = this.read()
    this.migrate()
  }

  get(): AppStore {
    return structuredClone(this.store)
  }

  patch(partial: Record<string, unknown>): AppStore {
    this.store = deepMerge(this.store, partial) as unknown as AppStore
    this.scheduleWrite()
    this.broadcast()
    return this.get()
  }

  /** Broadcast current store to all renderer windows */
  private broadcast() {
    const snapshot = this.get()
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('store:changed', snapshot)
      }
    }
  }

  /** Debounced write to disk (500ms) */
  private scheduleWrite() {
    if (this.writeTimer) clearTimeout(this.writeTimer)
    this.writeTimer = setTimeout(() => this.writeToDisk(), 500)
  }

  /** Force immediate write (call on app quit) */
  flush() {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer)
      this.writeTimer = null
    }
    this.writeToDisk()
  }

  private writeToDisk() {
    try {
      mkdirSync(dirname(this.filePath), { recursive: true })
      writeFileSync(this.filePath, JSON.stringify(this.store, null, 2))
    } catch {
      // Best effort
    }
  }

  private read(): AppStore {
    try {
      const raw = readFileSync(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<AppStore>
      return {
        settings: { ...DEFAULT_STORE.settings, ...parsed.settings },
        sessions: parsed.sessions ?? {},
        activeSessionName: parsed.activeSessionName ?? null,
      }
    } catch {
      return structuredClone(DEFAULT_STORE)
    }
  }

  /** Migrate from old overlay-settings.json if it exists */
  private migrate() {
    const oldPath = join(app.getPath('userData'), 'overlay-settings.json')
    if (!existsSync(oldPath)) return

    try {
      const raw = readFileSync(oldPath, 'utf-8')
      const old = JSON.parse(raw) as Record<string, unknown>
      // Merge old settings into current store settings
      this.store.settings = {
        ...this.store.settings,
        ...(old as Partial<OverlaySettings>),
      }
      this.writeToDisk()
      unlinkSync(oldPath)
    } catch {
      // Migration failed — ignore, old file stays
    }
  }
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | head -5`
Expected: Clean or only pre-existing errors.

**Step 3: Commit**

```bash
git add electron/store.ts
git commit -m "feat: add AppStoreManager with JSON persistence and cross-window broadcast"
```

---

### Task 3: Rewrite `electron/preload.ts`

**Files:**
- Rewrite: `electron/preload.ts` (full file, 13 lines → ~22 lines)

**Step 1: Rewrite preload**

Replace entire contents of `electron/preload.ts`:

```typescript
import { contextBridge, ipcRenderer } from 'electron'

const isOverlay = new URLSearchParams(window.location.search).get('mode') === 'overlay'

contextBridge.exposeInMainWorld('electronAPI', {
  isOverlay,
  isElectron: true,

  // Store
  storeGet: () => ipcRenderer.invoke('store:get'),
  storePatch: (patch: unknown) => ipcRenderer.invoke('store:patch', patch),
  onStoreChanged: (callback: (store: unknown) => void) => {
    const handler = (_event: unknown, store: unknown) => callback(store)
    ipcRenderer.on('store:changed', handler as (...args: unknown[]) => void)
    return () => {
      ipcRenderer.removeListener('store:changed', handler as (...args: unknown[]) => void)
    }
  },

  // Electron-only queries
  getDisplays: () => ipcRenderer.invoke('get-displays') as Promise<{ id: number; label: string }[]>,
})
```

**Step 2: Update `src/electron-api.d.ts`**

Replace entire contents:

```typescript
interface ElectronAPI {
  isOverlay: boolean
  isElectron: boolean
  storeGet: () => Promise<import('./types').AppStore>
  storePatch: (patch: import('./types').DeepPartial<import('./types').AppStore>) => Promise<void>
  onStoreChanged: (callback: (store: import('./types').AppStore) => void) => () => void
  getDisplays: () => Promise<{ id: number; label: string }[]>
}

interface Window {
  electronAPI?: ElectronAPI
}
```

**Step 3: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Errors in files still using old API (`updateKeybinding`, `updateMonitor`) — fixed in later tasks.

**Step 4: Commit**

```bash
git add electron/preload.ts src/electron-api.d.ts
git commit -m "feat: rewrite preload with store IPC and typed API"
```

---

### Task 4: Rewrite `electron/main.ts` to use `AppStoreManager`

**Files:**
- Rewrite: `electron/main.ts` (248 lines → ~130 lines)

**Step 1: Rewrite main.ts**

Replace entire contents of `electron/main.ts`:

```typescript
import { app, BrowserWindow, globalShortcut, screen, ipcMain } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { AppStoreManager } from './store'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let overlayVisible = false
let currentKeybinding = ''
let storeManager: AppStoreManager

// --- Monitor helpers ---

function getTargetDisplay(monitorId: number) {
  const displays = screen.getAllDisplays()
  return displays.find((d) => d.id === monitorId) ?? screen.getPrimaryDisplay()
}

function positionOverlay(monitorId: number) {
  if (!overlayWindow) return
  const display = getTargetDisplay(monitorId)
  const { x, y, width, height } = display.workArea
  storeManager.patch({
    settings: {
      overlayBounds: {
        x: x + width - 400,
        y: y + 50,
        width: 380,
        height: height - 100,
      },
    },
  })
  overlayWindow.setBounds(storeManager.get().settings.overlayBounds!)
}

// --- Keybinding ---

function registerKeybinding(accelerator: string) {
  if (currentKeybinding) {
    globalShortcut.unregister(currentKeybinding)
  }
  const success = globalShortcut.register(accelerator, () => {
    if (!overlayWindow) return
    if (overlayVisible) {
      overlayWindow.hide()
    } else {
      overlayWindow.show()
    }
    overlayVisible = !overlayVisible
  })
  if (success) {
    currentKeybinding = accelerator
  }
}

// --- Side effects after store patch ---

function handleSideEffects(
  oldSettings: { keybinding: string; monitorId: number },
  newSettings: { keybinding: string; monitorId: number },
) {
  if (newSettings.keybinding !== oldSettings.keybinding) {
    registerKeybinding(newSettings.keybinding)
  }
  if (newSettings.monitorId !== oldSettings.monitorId) {
    positionOverlay(newSettings.monitorId)
  }
}

// --- Window bounds saving ---

let saveBoundsTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSaveBounds() {
  if (saveBoundsTimer) clearTimeout(saveBoundsTimer)
  saveBoundsTimer = setTimeout(() => {
    const patch: Record<string, unknown> = { settings: {} }
    const settings = patch.settings as Record<string, unknown>
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      settings.overlayBounds = overlayWindow.getBounds()
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      settings.mainBounds = mainWindow.getBounds()
    }
    storeManager.patch(patch)
  }, 500)
}

// --- URL helpers ---

function loadApp(win: BrowserWindow, query?: string) {
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL + (query ? `?${query}` : ''))
  } else {
    win.loadFile(join(__dirname, '../dist/index.html'), {
      search: query ?? '',
    })
  }
}

// --- Window creation ---

function createMainWindow() {
  const { settings } = storeManager.get()
  const bounds = settings.mainBounds ?? { width: 1100, height: 800 }

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 600,
    minHeight: 400,
    title: 'BG Randomizer',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  })

  mainWindow.on('moved', scheduleSaveBounds)
  mainWindow.on('resized', scheduleSaveBounds)
  mainWindow.on('closed', () => { mainWindow = null })

  loadApp(mainWindow)
}

function createOverlayWindow() {
  const { settings } = storeManager.get()
  const display = getTargetDisplay(settings.monitorId)
  const { x, y, width, height } = display.workArea

  const bounds = settings.overlayBounds ?? {
    x: x + width - 400,
    y: y + 50,
    width: 380,
    height: height - 100,
  }

  overlayWindow = new BrowserWindow({
    ...bounds,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  })

  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  overlayWindow.on('moved', scheduleSaveBounds)
  overlayWindow.on('resized', scheduleSaveBounds)
  overlayWindow.on('closed', () => { overlayWindow = null })

  loadApp(overlayWindow, 'mode=overlay')
}

// --- IPC ---

function setupIPC() {
  ipcMain.handle('store:get', () => storeManager.get())

  ipcMain.handle('store:patch', (_event, patch: Record<string, unknown>) => {
    const oldSettings = storeManager.get().settings
    storeManager.patch(patch)
    const newSettings = storeManager.get().settings
    handleSideEffects(oldSettings, newSettings)
  })

  ipcMain.handle('get-displays', () => {
    return screen.getAllDisplays().map((d) => ({
      id: d.id,
      label: `Display ${d.id} (${d.size.width}x${d.size.height})`,
    }))
  })
}

// --- App lifecycle ---

app.whenReady().then(() => {
  storeManager = new AppStoreManager()

  // Fix default monitorId (0) to actual primary display ID
  const { settings } = storeManager.get()
  if (settings.monitorId === 0) {
    storeManager.patch({ settings: { monitorId: screen.getPrimaryDisplay().id } })
  }

  setupIPC()
  createMainWindow()
  createOverlayWindow()
  registerKeybinding(storeManager.get().settings.keybinding)
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  storeManager.flush()
})

app.on('window-all-closed', () => {
  app.quit()
})
```

**Step 2: Verify electron code compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Errors only in renderer files (store.ts, settings.ts, App.tsx, SettingsPanel.tsx) — those are next.

**Step 3: Commit**

```bash
git add electron/main.ts
git commit -m "feat: rewrite main process to use AppStoreManager"
```

---

### Task 5: Rewrite `src/store.ts` — the `useAppStore` hook

**Files:**
- Rewrite: `src/store.ts` (254 lines → ~170 lines)
- Delete: `src/settings.ts`

**Step 1: Rewrite store.ts**

Replace entire contents of `src/store.ts`:

```typescript
import { useState, useCallback, useEffect } from 'react'
import type { AppStore, DeepPartial, LocationState, SessionState } from './types'
import { deepMerge } from './deep-merge'

const DEFAULT_LOCATION_STATE: LocationState = {
  checked: false,
  assignedItemId: null,
  note: '',
}

const DEFAULT_STORE: AppStore = {
  settings: {
    keybinding: 'F9',
    monitorId: 0,
  },
  sessions: {},
  activeSessionName: null,
}

// --- localStorage fallback for browser-only dev mode ---

const LS_KEY = 'bg-randomizer-store'

function loadFromLocalStorage(): AppStore {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return { ...DEFAULT_STORE, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return structuredClone(DEFAULT_STORE)
}

function saveToLocalStorage(store: AppStore) {
  localStorage.setItem(LS_KEY, JSON.stringify(store))
}

// --- Main hook ---

export function useAppStore() {
  const [store, setStore] = useState<AppStore | null>(null)
  const isElectron = !!window.electronAPI?.isElectron

  // Load initial state
  useEffect(() => {
    if (isElectron) {
      window.electronAPI!.storeGet().then(setStore)
    } else {
      setStore(loadFromLocalStorage())
    }
  }, [isElectron])

  // Listen for broadcasts from main process
  useEffect(() => {
    if (!isElectron) return
    return window.electronAPI!.onStoreChanged((newStore) => {
      setStore(newStore)
    })
  }, [isElectron])

  // Patch: optimistic local update + IPC (or localStorage fallback)
  const patch = useCallback(
    (p: DeepPartial<AppStore>) => {
      setStore((prev) => {
        if (!prev) return prev
        const next = deepMerge(prev, p as Record<string, unknown>) as unknown as AppStore
        if (!isElectron) saveToLocalStorage(next)
        return next
      })
      if (isElectron) {
        window.electronAPI!.storePatch(p)
      }
    },
    [isElectron],
  )

  // --- Action methods (same signatures as before) ---

  const activeSession =
    store?.activeSessionName != null
      ? (store.sessions[store.activeSessionName] ?? null)
      : null

  const createSession = useCallback(
    (name: string) => {
      const session: SessionState = {
        name,
        createdAt: new Date().toISOString(),
        locationStates: {},
      }
      patch({ sessions: { [name]: session }, activeSessionName: name })
    },
    [patch],
  )

  const switchSession = useCallback(
    (name: string) => {
      patch({ activeSessionName: name })
    },
    [patch],
  )

  const deleteSession = useCallback(
    (name: string) => {
      // null sentinel tells deepMerge to delete the key
      const sessionPatch = { [name]: null } as Record<string, null>
      const isActive = store?.activeSessionName === name
      const remaining = Object.keys(store?.sessions ?? {}).filter((n) => n !== name)
      patch({
        sessions: sessionPatch as unknown as DeepPartial<AppStore>['sessions'],
        ...(isActive ? { activeSessionName: remaining[0] ?? null } : {}),
      })
    },
    [patch, store?.activeSessionName, store?.sessions],
  )

  const toggleChecked = useCallback(
    (locationId: string) => {
      if (!store?.activeSessionName) return
      const current = activeSession?.locationStates[locationId]
      patch({
        sessions: {
          [store.activeSessionName]: {
            locationStates: {
              [locationId]: { checked: !(current?.checked ?? false) },
            },
          },
        },
      })
    },
    [patch, store?.activeSessionName, activeSession],
  )

  const assignItem = useCallback(
    (locationId: string, itemId: string | null) => {
      if (!store?.activeSessionName) return
      patch({
        sessions: {
          [store.activeSessionName]: {
            locationStates: {
              [locationId]: { assignedItemId: itemId },
            },
          },
        },
      })
    },
    [patch, store?.activeSessionName],
  )

  const setNote = useCallback(
    (locationId: string, note: string) => {
      if (!store?.activeSessionName) return
      patch({
        sessions: {
          [store.activeSessionName]: {
            locationStates: {
              [locationId]: { note },
            },
          },
        },
      })
    },
    [patch, store?.activeSessionName],
  )

  const resetSession = useCallback(() => {
    if (!store?.activeSessionName) return
    patch({
      sessions: {
        [store.activeSessionName]: {
          locationStates: {} as Record<string, LocationState>,
        },
      },
    })
  }, [patch, store?.activeSessionName])

  const exportSession = useCallback((): string | null => {
    if (!activeSession) return null
    return JSON.stringify(activeSession, null, 2)
  }, [activeSession])

  const importSession = useCallback(
    (json: string) => {
      const parsed = JSON.parse(json) as SessionState
      if (
        !parsed.name ||
        typeof parsed.name !== 'string' ||
        !parsed.createdAt ||
        typeof parsed.createdAt !== 'string' ||
        !parsed.locationStates ||
        typeof parsed.locationStates !== 'object'
      ) {
        throw new Error('Invalid session data')
      }
      patch({ sessions: { [parsed.name]: parsed }, activeSessionName: parsed.name })
    },
    [patch],
  )

  return {
    // Store is null until initial load completes
    loading: store === null,
    sessions: store?.sessions ?? {},
    activeSessionName: store?.activeSessionName ?? null,
    activeSession,
    settings: store?.settings ?? DEFAULT_STORE.settings,
    patch,
    createSession,
    switchSession,
    deleteSession,
    toggleChecked,
    assignItem,
    setNote,
    resetSession,
    exportSession,
    importSession,
  }
}
```

**Step 2: Delete settings.ts**

```bash
rm src/settings.ts
```

**Step 3: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Errors in `App.tsx` (still imports `useSettings`/`useTrackerStore`) — fixed next task.

**Step 4: Commit**

```bash
git add src/store.ts
git rm src/settings.ts
git commit -m "feat: rewrite store as useAppStore hook with IPC and localStorage fallback"
```

---

### Task 6: Update `App.tsx` — wire up `useAppStore`

**Files:**
- Modify: `src/App.tsx` (replace both hook imports, pass new props)

**Step 1: Rewrite App.tsx**

Replace entire contents of `src/App.tsx`:

```typescript
import { useState, useMemo } from 'react'
import type { GroupBy, GameFilter } from './types'
import { locations } from './data-loader'
import { useAppStore } from './store'
import Header from './components/Header'
import SessionManager from './components/SessionManager'
import LocationList from './components/LocationList'
import OverlayView from './components/OverlayView'

function useIsOverlay(): boolean {
  const params = new URLSearchParams(window.location.search)
  return (
    params.get('mode') === 'overlay' ||
    !!(window as any).electronAPI?.isOverlay
  )
}

function App() {
  const store = useAppStore()
  const isOverlay = useIsOverlay()
  const [groupBy, setGroupBy] = useState<GroupBy>('tier')
  const [gameFilter, setGameFilter] = useState<GameFilter>('all')
  const [showSessionManager, setShowSessionManager] = useState(
    () => store.activeSessionName === null,
  )

  const filteredLocations = useMemo(
    () =>
      gameFilter === 'all'
        ? locations
        : locations.filter((loc) => loc.game === gameFilter),
    [gameFilter],
  )

  const checkedCount = useMemo(() => {
    if (!store.activeSession) return 0
    return filteredLocations.filter(
      (loc) => store.activeSession!.locationStates[loc.id]?.checked,
    ).length
  }, [store.activeSession, filteredLocations])

  const totalLocations = filteredLocations.length

  const assignedItemIds = useMemo(() => {
    if (!store.activeSession) return new Set<string>()
    const ids = new Set<string>()
    for (const state of Object.values(store.activeSession.locationStates)) {
      if (state.assignedItemId) ids.add(state.assignedItemId)
    }
    return ids
  }, [store.activeSession])

  if (store.loading) {
    return null // Brief flash while IPC loads — <1ms in practice
  }

  if (isOverlay) {
    return (
      <OverlayView
        locationStates={store.activeSession?.locationStates ?? {}}
        onToggleChecked={store.toggleChecked}
        settings={store.settings}
        onUpdateSettings={(p) => store.patch({ settings: p })}
        hasSession={store.activeSessionName !== null}
      />
    )
  }

  return (
    <div className="min-h-screen bg-stone-900 text-stone-100">
      <Header
        totalLocations={totalLocations}
        checkedCount={checkedCount}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        gameFilter={gameFilter}
        onGameFilterChange={setGameFilter}
        sessionName={store.activeSessionName}
        onManageSessions={() => setShowSessionManager(true)}
        onResetSession={store.resetSession}
        settings={store.settings}
        onUpdateSettings={(p) => store.patch({ settings: p })}
      />

      <main className="p-4">
        {store.activeSessionName === null ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-stone-400 text-lg">No active session</p>
            <button
              onClick={() => setShowSessionManager(true)}
              className="px-4 py-2 bg-amber-600 text-stone-100 rounded-md font-medium hover:bg-amber-500 transition-colors"
            >
              Manage Sessions
            </button>
          </div>
        ) : (
          <LocationList
            locations={filteredLocations}
            groupBy={groupBy}
            locationStates={store.activeSession?.locationStates ?? {}}
            assignedItemIds={assignedItemIds}
            onToggleChecked={store.toggleChecked}
            onAssignItem={store.assignItem}
            onSetNote={store.setNote}
          />
        )}
      </main>

      {showSessionManager && (
        <SessionManager
          sessions={store.sessions}
          activeSessionName={store.activeSessionName}
          onCreateSession={store.createSession}
          onSwitchSession={store.switchSession}
          onDeleteSession={store.deleteSession}
          onExport={store.exportSession}
          onImport={store.importSession}
          onClose={() => setShowSessionManager(false)}
        />
      )}
    </div>
  )
}

export default App
```

**Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Errors in `SettingsPanel.tsx` (still uses old `updateKeybinding`/`updateMonitor` methods) — fixed next.

**Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire App.tsx to useAppStore, remove useSettings/useTrackerStore"
```

---

### Task 7: Update `SettingsPanel.tsx` — use `patch()` for settings

**Files:**
- Modify: `src/components/SettingsPanel.tsx`

**Step 1: Simplify SettingsPanel**

Replace entire contents of `src/components/SettingsPanel.tsx`:

```typescript
import { useState, useEffect } from 'react'
import type { OverlaySettings } from '../types'
import KeybindingInput from './KeybindingInput'

interface SettingsPanelProps {
  settings: OverlaySettings
  onUpdateSettings: (patch: Partial<OverlaySettings>) => void
  onClose?: () => void
}

interface DisplayInfo {
  id: number
  label: string
}

export default function SettingsPanel({
  settings,
  onUpdateSettings,
  onClose,
}: SettingsPanelProps) {
  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const isElectron = !!window.electronAPI

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getDisplays().then(setDisplays)
    }
  }, [])

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-amber-400">Settings</span>
        {onClose && (
          <button
            onClick={onClose}
            className="text-stone-500 hover:text-stone-300 transition-colors text-lg leading-none"
          >
            &times;
          </button>
        )}
      </div>

      {/* Keybinding */}
      <div className="space-y-1">
        <label className="text-xs text-stone-400">Toggle Overlay</label>
        <KeybindingInput
          value={settings.keybinding}
          onChange={(accelerator) => onUpdateSettings({ keybinding: accelerator })}
        />
      </div>

      {/* Monitor selection */}
      <div className="space-y-1">
        <label className="text-xs text-stone-400">Monitor</label>
        {isElectron && displays.length > 0 ? (
          <select
            value={settings.monitorId}
            onChange={(e) => onUpdateSettings({ monitorId: Number(e.target.value) })}
            className="w-full bg-stone-700 border border-stone-600 rounded px-2 py-1.5 text-sm text-stone-200 outline-none focus:border-amber-500 transition-colors"
          >
            {displays.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-stone-500">
            {isElectron ? 'Loading displays...' : 'Available in overlay mode'}
          </p>
        )}
      </div>
    </div>
  )
}
```

The key change: `handleKeybindingChange` and `handleMonitorChange` no longer call `electronAPI.updateKeybinding/updateMonitor` directly. They just call `onUpdateSettings`, which flows through `patch({ settings: ... })` in App.tsx, which goes through IPC → main process → side effects.

**Step 2: Verify full compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Clean — all files should compile now.

**Step 3: Commit**

```bash
git add src/components/SettingsPanel.tsx
git commit -m "refactor: simplify SettingsPanel to use unified store patch"
```

---

### Task 8: Verify, test, and rebuild

**Files:** None — verification only.

**Step 1: Full type check**

Run: `npx tsc --noEmit`
Expected: Clean.

**Step 2: Production build**

Run: `npm run build`
Expected: Clean build.

**Step 3: Manual test in dev mode**

Run: `npm run dev`

Test checklist:
- [ ] Main window opens with session manager
- [ ] Create a session → overlay shows it (F9 to toggle)
- [ ] Check a box in main window → appears checked in overlay
- [ ] Check a box in overlay → appears checked in main window
- [ ] Change keybinding in settings → new key toggles overlay
- [ ] Change monitor in settings → overlay repositions
- [ ] Drag overlay → close and reopen → position restored
- [ ] Reset session → both windows clear
- [ ] Export/import session works

**Step 4: Build portable exe**

Run: `npm run package`
Expected: `release/BG-Randomizer-0.0.0.exe` built successfully.

**Step 5: Commit any fixes**

If any issues found during testing, fix and commit.

---

### Task 9: Clean up dead code

**Files:**
- Check: no remaining references to old localStorage keys, `useSettings`, `useTrackerStore`
- Check: no remaining references to `updateKeybinding`, `updateMonitor` IPC channels

**Step 1: Search for dead references**

```bash
grep -r "useTrackerStore\|useSettings\|SESSIONS_KEY\|ACTIVE_SESSION_KEY\|SETTINGS_KEY\|update-keybinding\|update-monitor\|bg-randomizer-sessions\|bg-randomizer-active-session\|bg-randomizer-settings" src/ electron/ --include="*.ts" --include="*.tsx"
```

Expected: No matches (all removed).

**Step 2: Verify no unused imports**

Run: `npx tsc --noEmit`
Expected: Clean.

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: clean up dead references to old state systems"
```
