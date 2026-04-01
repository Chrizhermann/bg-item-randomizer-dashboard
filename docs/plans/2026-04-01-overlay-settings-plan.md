# Overlay Settings & Anchor Button Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a settings panel (keybinding + monitor selection) to the overlay and web app, with a three-state overlay (hidden/anchor/expanded) inspired by BG Radar Overlay.

**Architecture:** Settings stored in localStorage (synced between web app and overlay renderer). Overlay renderer relays changes to Electron main process via IPC. Main process also reads a `settings.json` file at startup (pre-renderer fallback). The overlay window stays full-size but renders only the relevant state (transparent areas are click-through on Windows).

**Tech Stack:** React, Electron 41 (ESM), Tailwind CSS, localStorage, Electron IPC (`ipcMain.handle` / `ipcRenderer.invoke`), Node `fs` for startup config.

---

### Task 0: Add settings types and localStorage store

**Files:**
- Create: `src/settings.ts`
- Modify: `src/types.ts`

**Step 1: Add types to `src/types.ts`**

Add at the end of the file:

```typescript
export interface OverlaySettings {
  keybinding: string
  monitorId: number
}
```

**Step 2: Create `src/settings.ts`**

```typescript
import { useState, useEffect, useCallback } from 'react'
import type { OverlaySettings } from './types'

const SETTINGS_KEY = 'bg-randomizer-settings'

const DEFAULT_SETTINGS: OverlaySettings = {
  keybinding: 'F9',
  monitorId: 0,
}

export function loadSettings(): OverlaySettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<OverlaySettings>
      return { ...DEFAULT_SETTINGS, ...parsed }
    }
  } catch {
    // Corrupted data — use defaults
  }
  return { ...DEFAULT_SETTINGS }
}

export function saveSettings(settings: OverlaySettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function useSettings() {
  const [settings, setSettings] = useState<OverlaySettings>(loadSettings)

  // Listen for changes from other windows (web app <-> overlay sync)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === SETTINGS_KEY) {
        setSettings(loadSettings())
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const updateSettings = useCallback((patch: Partial<OverlaySettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      saveSettings(next)
      return next
    })
  }, [])

  return { settings, updateSettings }
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc -b --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/types.ts src/settings.ts
git commit -m "feat: add overlay settings types and localStorage store"
```

---

### Task 1: Expand Electron preload API

**Files:**
- Modify: `electron/preload.ts`

**Step 1: Add IPC methods to preload**

Replace the entire file:

```typescript
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  isOverlay: true,
  updateKeybinding: (key: string) => ipcRenderer.invoke('update-keybinding', key),
  updateMonitor: (monitorId: number) => ipcRenderer.invoke('update-monitor', monitorId),
  getDisplays: () => ipcRenderer.invoke('get-displays') as Promise<{ id: number; label: string }[]>,
})
```

**Step 2: Add TypeScript type declaration for `window.electronAPI`**

Create `src/electron-api.d.ts`:

```typescript
interface ElectronAPI {
  isOverlay: boolean
  updateKeybinding: (key: string) => Promise<void>
  updateMonitor: (monitorId: number) => Promise<void>
  getDisplays: () => Promise<{ id: number; label: string }[]>
}

interface Window {
  electronAPI?: ElectronAPI
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc -b --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add electron/preload.ts src/electron-api.d.ts
git commit -m "feat: expand preload API with settings IPC methods"
```

---

### Task 2: Update Electron main process

**Files:**
- Modify: `electron/main.ts`

This is the largest change. The main process gains:
- Settings JSON read/write for startup
- IPC handlers for keybinding, monitor, and display list
- Dynamic keybinding registration
- Monitor-aware window positioning
- Window starts hidden (keybinding toggles visibility)

**Step 1: Rewrite `electron/main.ts`**

```typescript
import { app, BrowserWindow, globalShortcut, screen, ipcMain } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface Settings {
  keybinding: string
  monitorId: number
}

const DEFAULT_SETTINGS: Settings = { keybinding: 'F9', monitorId: 0 }

let mainWindow: BrowserWindow | null = null
let isVisible = false // starts hidden
let currentKeybinding = ''
let currentSettings: Settings = { ...DEFAULT_SETTINGS }

// --- Settings persistence (JSON file for pre-renderer startup) ---

function settingsPath(): string {
  const dir = app.getPath('userData')
  return join(dir, 'overlay-settings.json')
}

function readSettings(): Settings {
  try {
    const raw = readFileSync(settingsPath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<Settings>
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function writeSettings(settings: Settings): void {
  try {
    const dir = app.getPath('userData')
    mkdirSync(dir, { recursive: true })
    writeFileSync(settingsPath(), JSON.stringify(settings, null, 2))
  } catch {
    // Best effort
  }
}

// --- Monitor helpers ---

function getTargetDisplay(monitorId: number) {
  const displays = screen.getAllDisplays()
  return displays.find((d) => d.id === monitorId) ?? screen.getPrimaryDisplay()
}

function positionWindow(monitorId: number) {
  if (!mainWindow) return
  const display = getTargetDisplay(monitorId)
  const { x, y, width, height } = display.workArea
  mainWindow.setBounds({
    x: x + width - 400,
    y: y + 50,
    width: 380,
    height: height - 100,
  })
}

// --- Keybinding ---

function registerKeybinding(accelerator: string) {
  if (currentKeybinding) {
    globalShortcut.unregister(currentKeybinding)
  }
  const success = globalShortcut.register(accelerator, () => {
    if (!mainWindow) return
    if (isVisible) {
      mainWindow.hide()
    } else {
      mainWindow.show()
    }
    isVisible = !isVisible
  })
  if (success) {
    currentKeybinding = accelerator
  }
}

// --- Window creation ---

function createWindow() {
  const display = getTargetDisplay(currentSettings.monitorId)
  const { x, y, width, height } = display.workArea

  mainWindow = new BrowserWindow({
    width: 380,
    height: height - 100,
    x: x + width - 400,
    y: y + 50,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: true,
    show: false, // starts hidden
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  })

  mainWindow.setIgnoreMouseEvents(false)

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL + '?mode=overlay')
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'), {
      search: 'mode=overlay',
    })
  }
}

// --- IPC handlers ---

function setupIPC() {
  ipcMain.handle('update-keybinding', (_event, key: string) => {
    currentSettings.keybinding = key
    writeSettings(currentSettings)
    registerKeybinding(key)
  })

  ipcMain.handle('update-monitor', (_event, monitorId: number) => {
    currentSettings.monitorId = monitorId
    writeSettings(currentSettings)
    positionWindow(monitorId)
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
  currentSettings = readSettings()

  setupIPC()
  createWindow()
  registerKeybinding(currentSettings.keybinding)
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  app.quit()
})
```

**Step 2: Verify Electron starts**

Run: `npm run dev`
Expected: Electron starts, window is hidden, F9 (or configured key) shows the overlay

**Step 3: Commit**

```bash
git add electron/main.ts
git commit -m "feat: add IPC handlers, dynamic keybinding, monitor positioning to Electron main"
```

---

### Task 3: Create KeybindingInput component

**Files:**
- Create: `src/components/KeybindingInput.tsx`

**Step 1: Create the component**

This component shows the current keybinding as a button. Clicking enters "listening" mode where the next keypress is captured and formatted as an Electron accelerator string.

```typescript
import { useState, useCallback, useEffect, useRef } from 'react'

interface KeybindingInputProps {
  value: string
  onChange: (accelerator: string) => void
}

function keyEventToAccelerator(e: KeyboardEvent): string | null {
  // Ignore bare modifier keys
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null

  const parts: string[] = []
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')

  // Normalize key name to Electron accelerator format
  let key = e.key
  if (key === ' ') key = 'Space'
  else if (key.length === 1) key = key.toUpperCase()
  // F1-F24 are already correct from e.key

  parts.push(key)
  return parts.join('+')
}

export default function KeybindingInput({ value, onChange }: KeybindingInputProps) {
  const [listening, setListening] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const startListening = useCallback(() => {
    setListening(true)
  }, [])

  useEffect(() => {
    if (!listening) return

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.key === 'Escape') {
        setListening(false)
        return
      }

      const accelerator = keyEventToAccelerator(e)
      if (accelerator) {
        onChange(accelerator)
        setListening(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [listening, onChange])

  // Close listening if user clicks away
  useEffect(() => {
    if (!listening) return

    const handleClick = (e: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setListening(false)
      }
    }

    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [listening])

  return (
    <button
      ref={buttonRef}
      onClick={startListening}
      className={`px-3 py-1.5 text-sm rounded border transition-colors font-mono ${
        listening
          ? 'bg-amber-600/20 border-amber-500 text-amber-300 animate-pulse'
          : 'bg-stone-700 border-stone-600 text-stone-200 hover:border-stone-500'
      }`}
    >
      {listening ? 'Press a key...' : value}
    </button>
  )
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc -b --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/KeybindingInput.tsx
git commit -m "feat: add KeybindingInput press-a-key recorder component"
```

---

### Task 4: Create SettingsPanel component

**Files:**
- Create: `src/components/SettingsPanel.tsx`

This is the shared settings UI used in both the overlay (right-click anchor) and web app (gear icon popover). It reads display info from `electronAPI` when available, or shows a non-functional monitor dropdown in the web app.

**Step 1: Create the component**

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

  const handleKeybindingChange = (accelerator: string) => {
    onUpdateSettings({ keybinding: accelerator })
    if (window.electronAPI) {
      window.electronAPI.updateKeybinding(accelerator)
    }
  }

  const handleMonitorChange = (monitorId: number) => {
    onUpdateSettings({ monitorId })
    if (window.electronAPI) {
      window.electronAPI.updateMonitor(monitorId)
    }
  }

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
          onChange={handleKeybindingChange}
        />
      </div>

      {/* Monitor selection */}
      <div className="space-y-1">
        <label className="text-xs text-stone-400">Monitor</label>
        {isElectron && displays.length > 0 ? (
          <select
            value={settings.monitorId}
            onChange={(e) => handleMonitorChange(Number(e.target.value))}
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

**Step 2: Verify TypeScript compiles**

Run: `npx tsc -b --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/SettingsPanel.tsx
git commit -m "feat: add shared SettingsPanel component with keybinding and monitor controls"
```

---

### Task 5: Create OverlayAnchor component

**Files:**
- Create: `src/components/OverlayAnchor.tsx`

A tiny ~30x30px semi-transparent button. Left-click toggles expanded view, right-click opens settings.

**Step 1: Create the component**

```typescript
interface OverlayAnchorProps {
  onLeftClick: () => void
  onRightClick: () => void
}

export default function OverlayAnchor({
  onLeftClick,
  onRightClick,
}: OverlayAnchorProps) {
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    onRightClick()
  }

  return (
    <div className="flex justify-end p-2">
      <button
        onClick={onLeftClick}
        onContextMenu={handleContextMenu}
        className="w-8 h-8 rounded bg-amber-600/60 hover:bg-amber-500/80 border border-amber-500/40 flex items-center justify-center transition-colors"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        title="Left-click: toggle overlay | Right-click: settings"
      >
        <span className="text-xs font-bold text-amber-100">BG</span>
      </button>
    </div>
  )
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc -b --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/OverlayAnchor.tsx
git commit -m "feat: add OverlayAnchor tiny toggle button component"
```

---

### Task 6: Rewrite OverlayView for three-state rendering

**Files:**
- Modify: `src/components/OverlayView.tsx`

The OverlayView becomes a state machine with three visual states: `anchor`, `expanded`, `settings`. The entire window is always present (full size), but only the active state renders content; the rest is fully transparent and click-through.

**Step 1: Rewrite OverlayView**

```typescript
import { useState, useMemo, useCallback, useEffect } from 'react'
import type { LocationState, OverlaySettings } from '../types'
import { locations } from '../data-loader'
import { groupLocations } from '../grouping'
import OverlayLocationRow from './OverlayLocationRow'
import OverlayAnchor from './OverlayAnchor'
import SettingsPanel from './SettingsPanel'

type OverlayState = 'anchor' | 'expanded' | 'settings'

interface OverlayViewProps {
  locationStates: Record<string, LocationState>
  onToggleChecked: (locationId: string) => void
  settings: OverlaySettings
  onUpdateSettings: (patch: Partial<OverlaySettings>) => void
}

const DEFAULT_LOCATION_STATE: LocationState = {
  checked: false,
  assignedItemId: null,
  note: '',
}

export default function OverlayView({
  locationStates,
  onToggleChecked,
  settings,
  onUpdateSettings,
}: OverlayViewProps) {
  const [overlayState, setOverlayState] = useState<OverlayState>('anchor')

  const groups = useMemo(
    () => groupLocations(locations, 'tier', locationStates),
    [locationStates],
  )

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(groups.map((g) => g.id)),
  )

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }, [])

  const checkedCount = useMemo(() => {
    return Object.values(locationStates).filter((s) => s.checked).length
  }, [locationStates])

  const handleAnchorLeftClick = useCallback(() => {
    setOverlayState((prev) => (prev === 'expanded' ? 'anchor' : 'expanded'))
  }, [])

  const handleAnchorRightClick = useCallback(() => {
    setOverlayState((prev) => (prev === 'settings' ? 'anchor' : 'settings'))
  }, [])

  // Escape key returns to anchor from expanded or settings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && overlayState !== 'anchor') {
        setOverlayState('anchor')
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [overlayState])

  // Anchor-only state: just the tiny button, rest is transparent
  if (overlayState === 'anchor') {
    return (
      <div className="h-screen select-none">
        <OverlayAnchor
          onLeftClick={handleAnchorLeftClick}
          onRightClick={handleAnchorRightClick}
        />
      </div>
    )
  }

  // Settings state
  if (overlayState === 'settings') {
    return (
      <div className="h-screen select-none">
        <OverlayAnchor
          onLeftClick={handleAnchorLeftClick}
          onRightClick={handleAnchorRightClick}
        />
        <div className="bg-black/80 rounded-lg mx-2 border border-stone-700">
          <SettingsPanel
            settings={settings}
            onUpdateSettings={onUpdateSettings}
            onClose={() => setOverlayState('anchor')}
          />
        </div>
      </div>
    )
  }

  // Expanded state: full checklist
  return (
    <div className="h-screen overflow-y-auto bg-black/70 select-none">
      {/* Title bar — draggable for Electron */}
      <div
        className="sticky top-0 z-10 bg-black/80 px-3 py-2 flex items-center justify-between"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <OverlayAnchor
            onLeftClick={handleAnchorLeftClick}
            onRightClick={handleAnchorRightClick}
          />
        </div>
        <span className="text-xs font-bold text-amber-400">BG Randomizer</span>
        <span className="text-xs text-stone-500">
          {checkedCount}/{locations.length}
        </span>
      </div>

      {/* Group list — not draggable */}
      <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {groups.map((group) => {
          const isExpanded = expandedGroups.has(group.id)
          const groupCheckedCount = group.locations.filter(
            (loc) => locationStates[loc.id]?.checked,
          ).length

          return (
            <div key={group.id}>
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center gap-2 px-3 py-1 text-xs bg-stone-900/50 hover:bg-stone-800/50 text-left transition-colors"
              >
                <span
                  className="text-stone-500 text-[10px] transition-transform duration-200"
                  style={{
                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  }}
                >
                  ▶
                </span>
                <span className="text-amber-300 font-medium">{group.name}</span>
                <span className="text-stone-600">
                  {groupCheckedCount}/{group.locations.length}
                </span>
              </button>

              {isExpanded &&
                group.locations.map((loc) => (
                  <OverlayLocationRow
                    key={loc.id}
                    location={loc}
                    state={locationStates[loc.id] ?? DEFAULT_LOCATION_STATE}
                    onToggleChecked={() => onToggleChecked(loc.id)}
                  />
                ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc -b --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/OverlayView.tsx
git commit -m "feat: rewrite OverlayView with three-state anchor/expanded/settings rendering"
```

---

### Task 7: Add settings gear icon to Header

**Files:**
- Modify: `src/components/Header.tsx`

Add a gear icon button to the header that opens a SettingsPanel popover.

**Step 1: Modify Header**

Add new props and a settings popover state. The gear icon goes between the session button and the group-by toggles.

New props to add:
```typescript
import type { OverlaySettings } from '../types'
// Add to HeaderProps:
settings: OverlaySettings
onUpdateSettings: (patch: Partial<OverlaySettings>) => void
```

Add state and render a settings popover:
- `const [showSettings, setShowSettings] = useState(false)`
- Gear button: `onClick={() => setShowSettings(!showSettings)}`
- When `showSettings` is true, render `<SettingsPanel>` as an absolute-positioned dropdown below the gear icon

**Step 2: Implementation**

Add to imports:
```typescript
import { useState } from 'react'
import SettingsPanel from './SettingsPanel'
import type { GroupBy, GameFilter, OverlaySettings } from '../types'
```

Add to HeaderProps interface:
```typescript
settings: OverlaySettings
onUpdateSettings: (patch: Partial<OverlaySettings>) => void
```

Add to the destructured props:
```typescript
settings,
onUpdateSettings,
```

Add state inside the component:
```typescript
const [showSettings, setShowSettings] = useState(false)
```

Add the gear button and popover in the right section, before the session button:
```tsx
<div className="relative">
  <button
    onClick={() => setShowSettings(!showSettings)}
    className={`px-2 py-1.5 text-sm rounded-md border transition-colors ${
      showSettings
        ? 'bg-amber-600/20 text-amber-400 border-amber-600/30'
        : 'bg-stone-700 border-stone-600 text-stone-400 hover:bg-stone-600 hover:text-stone-200'
    }`}
    title="Settings"
  >
    &#9881;
  </button>

  {showSettings && (
    <div className="absolute right-0 top-full mt-2 w-72 bg-stone-800 border border-stone-700 rounded-lg shadow-xl z-50">
      <SettingsPanel
        settings={settings}
        onUpdateSettings={onUpdateSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  )}
</div>
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc -b --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/Header.tsx
git commit -m "feat: add settings gear icon with popover to Header"
```

---

### Task 8: Wire up App.tsx

**Files:**
- Modify: `src/App.tsx`

Connect the settings hook to both the OverlayView and Header. Add `storage` event relay for cross-window sync.

**Step 1: Update App.tsx**

Add import:
```typescript
import { useSettings } from './settings'
```

Inside `App()`, add:
```typescript
const { settings, updateSettings } = useSettings()
```

Update the overlay branch:
```tsx
if (isOverlay) {
  return (
    <OverlayView
      locationStates={store.activeSession?.locationStates ?? {}}
      onToggleChecked={store.toggleChecked}
      settings={settings}
      onUpdateSettings={updateSettings}
    />
  )
}
```

Update the Header:
```tsx
<Header
  totalLocations={totalLocations}
  checkedCount={checkedCount}
  groupBy={groupBy}
  onGroupByChange={setGroupBy}
  gameFilter={gameFilter}
  onGameFilterChange={setGameFilter}
  sessionName={store.activeSessionName}
  onManageSessions={() => setShowSessionManager(true)}
  settings={settings}
  onUpdateSettings={updateSettings}
/>
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc -b --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire settings hook into App for overlay and header"
```

---

### Task 9: Manual integration testing

**No files changed — testing only.**

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Test web app settings**

- Open `http://localhost:5173` in browser
- Verify gear icon appears in header
- Click gear icon — settings popover opens
- Click keybinding button — shows "Press a key..."
- Press F10 — button shows "F10"
- Press Escape while listening — cancels, reverts to previous key
- Monitor dropdown shows "Available in overlay mode" (not in Electron)
- Click gear icon again — popover closes

**Step 3: Test overlay anchor states**

- Open `http://localhost:5173/?mode=overlay` in browser
- Verify tiny "BG" anchor button appears in top-right
- Left-click anchor — overlay expands to full checklist
- Left-click anchor again — collapses to anchor only
- Right-click anchor — settings panel appears
- Right-click anchor again — settings panel closes
- Press Escape — returns to anchor from any state

**Step 4: Test Electron overlay**

- Overlay starts hidden
- Press F9 — anchor button appears
- Left-click to expand, verify checklist works
- Right-click for settings, verify monitor dropdown shows displays
- Change keybinding to F10, verify F10 now toggles
- Change monitor (if multi-monitor), verify overlay repositions

**Step 5: Test cross-window sync**

- Open web app in browser and overlay in Electron simultaneously
- Change keybinding in web app settings
- Verify overlay picks up the new keybinding (via storage event + IPC relay)

**Step 6: Final commit**

If any fixes were needed during testing, commit them:
```bash
git add -A
git commit -m "fix: address issues found during overlay settings integration testing"
```
