import { useState, useCallback, useEffect } from 'react'
import type { AppStore, DeepPartial, LocationState, SessionState } from './types'
import { deepMerge } from './deep-merge'

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
        const next = deepMerge(prev as unknown as Record<string, unknown>, p as Record<string, unknown>) as unknown as AppStore
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
