import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from 'fs'

// ---------------------------------------------------------------------------
// Interfaces — duplicated from src/types.ts because the Electron main process
// is built separately and cannot import from the renderer source tree.
// ---------------------------------------------------------------------------

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

export interface LocationState {
  checked: boolean
  assignedItemId: string | null
  note: string
}

export interface SessionState {
  name: string
  createdAt: string
  locationStates: Record<string, LocationState>
}

export interface AppStore {
  settings: OverlaySettings
  sessions: Record<string, SessionState>
  activeSessionName: string | null
}

/** Recursive partial where any value can also be `null` (meaning "delete this key"). */
export type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> | null }
  : T

// ---------------------------------------------------------------------------
// Deep merge — duplicated from src/utils because main process can't import it.
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Recursively merges `patch` into `base`, returning a new object.
 * - Plain objects are merged recursively.
 * - `null` values in the patch delete the corresponding key.
 * - All other values (primitives, arrays) overwrite.
 */
function deepMerge<T>(base: T, patch: DeepPartial<T>): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return patch as T
  }

  const result: Record<string, unknown> = { ...base }

  for (const key of Object.keys(patch)) {
    const patchVal = (patch as Record<string, unknown>)[key]

    if (patchVal === null) {
      delete result[key]
    } else if (isPlainObject(patchVal) && isPlainObject(result[key])) {
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        patchVal as DeepPartial<Record<string, unknown>>,
      )
    } else {
      result[key] = patchVal
    }
  }

  return result as T
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_STORE: AppStore = {
  settings: {
    keybinding: 'F9',
    monitorId: 0,
  },
  sessions: {},
  activeSessionName: null,
}

// ---------------------------------------------------------------------------
// AppStoreManager
// ---------------------------------------------------------------------------

export class AppStoreManager {
  private store: AppStore
  private readonly filePath: string
  private writeTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    const dir = app.getPath('userData')
    this.filePath = join(dir, 'store.json')

    this.store = this.load()
    this.migrateOldSettings()
  }

  /** Return a deep clone of the current store. */
  get(): AppStore {
    return JSON.parse(JSON.stringify(this.store)) as AppStore
  }

  /**
   * Deep-merge a partial update into the store.
   * Schedules a debounced disk write (500 ms) and broadcasts
   * `store:changed` with the full store to every open BrowserWindow.
   */
  patch(partial: DeepPartial<AppStore>): void {
    this.store = deepMerge(this.store, partial)
    this.scheduleDiskWrite()
    this.broadcast()
  }

  /**
   * Immediately write the store to disk. Call this on app quit
   * to ensure no pending changes are lost.
   */
  flush(): void {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer)
      this.writeTimer = null
    }
    this.writeToDisk()
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /** Load store.json from disk, falling back to defaults. */
  private load(): AppStore {
    try {
      const raw = readFileSync(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<AppStore>
      return deepMerge(DEFAULT_STORE, parsed as DeepPartial<AppStore>)
    } catch {
      return { ...DEFAULT_STORE, settings: { ...DEFAULT_STORE.settings } }
    }
  }

  /**
   * If the legacy `overlay-settings.json` exists, merge its values into
   * `store.settings` and delete the old file.
   */
  private migrateOldSettings(): void {
    const dir = app.getPath('userData')
    const oldPath = join(dir, 'overlay-settings.json')

    if (!existsSync(oldPath)) return

    try {
      const raw = readFileSync(oldPath, 'utf-8')
      const old = JSON.parse(raw) as Partial<OverlaySettings>

      // Merge old settings into the current store's settings
      this.store = deepMerge(this.store, {
        settings: old as DeepPartial<OverlaySettings>,
      })

      // Persist the migrated store and remove the old file
      this.writeToDisk()
      unlinkSync(oldPath)
    } catch {
      // Old file is corrupt or unreadable — ignore and move on.
      // Still try to clean it up so migration doesn't re-trigger.
      try {
        unlinkSync(oldPath)
      } catch {
        // Best effort
      }
    }
  }

  /** Schedule a disk write 500 ms from now (debounced). */
  private scheduleDiskWrite(): void {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer)
    }
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null
      this.writeToDisk()
    }, 500)
  }

  /** Write the store to disk synchronously. */
  private writeToDisk(): void {
    try {
      const dir = app.getPath('userData')
      mkdirSync(dir, { recursive: true })
      writeFileSync(this.filePath, JSON.stringify(this.store, null, 2))
    } catch {
      // Best effort — userData should always be writable, but don't crash.
    }
  }

  /** Send `store:changed` with the full store to every open BrowserWindow. */
  private broadcast(): void {
    const payload = this.get()
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('store:changed', payload)
      }
    }
  }
}
