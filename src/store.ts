import { useState, useCallback } from 'react'
import type { LocationState, SessionState } from './types'

const SESSIONS_KEY = 'bg-randomizer-sessions'
const ACTIVE_SESSION_KEY = 'bg-randomizer-active-session'

const DEFAULT_LOCATION_STATE: LocationState = {
  checked: false,
  assignedItemId: null,
  note: '',
}

function loadSessions(): Record<string, SessionState> {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    if (raw) {
      return JSON.parse(raw) as Record<string, SessionState>
    }
  } catch {
    // Corrupted data — start fresh
  }
  return {}
}

function saveSessions(sessions: Record<string, SessionState>): void {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
}

function loadActiveSessionName(): string | null {
  return localStorage.getItem(ACTIVE_SESSION_KEY)
}

function saveActiveSessionName(name: string | null): void {
  if (name === null) {
    localStorage.removeItem(ACTIVE_SESSION_KEY)
  } else {
    localStorage.setItem(ACTIVE_SESSION_KEY, name)
  }
}

export function useTrackerStore() {
  const [sessions, setSessions] = useState<Record<string, SessionState>>(
    loadSessions,
  )
  const [activeSessionName, setActiveSessionName] = useState<string | null>(
    loadActiveSessionName,
  )

  const activeSession =
    activeSessionName !== null ? (sessions[activeSessionName] ?? null) : null

  const persistSessions = useCallback(
    (updater: (prev: Record<string, SessionState>) => Record<string, SessionState>) => {
      setSessions((prev) => {
        const next = updater(prev)
        saveSessions(next)
        return next
      })
    },
    [],
  )

  const persistActiveSessionName = useCallback((name: string | null) => {
    setActiveSessionName(name)
    saveActiveSessionName(name)
  }, [])

  const createSession = useCallback(
    (name: string) => {
      const session: SessionState = {
        name,
        createdAt: new Date().toISOString(),
        locationStates: {},
      }
      persistSessions((prev) => ({ ...prev, [name]: session }))
      persistActiveSessionName(name)
    },
    [persistSessions, persistActiveSessionName],
  )

  const switchSession = useCallback(
    (name: string) => {
      if (sessions[name]) {
        persistActiveSessionName(name)
      }
    },
    [sessions, persistActiveSessionName],
  )

  const deleteSession = useCallback(
    (name: string) => {
      persistSessions((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })

      setActiveSessionName((prevName) => {
        if (prevName === name) {
          // Need to read current sessions to find a replacement
          const current = loadSessions()
          delete current[name]
          const remaining = Object.keys(current)
          const newActive = remaining.length > 0 ? remaining[0] : null
          saveActiveSessionName(newActive)
          return newActive
        }
        return prevName
      })
    },
    [persistSessions],
  )

  const getLocationState = useCallback(
    (locationId: string): LocationState => {
      if (!activeSession) return { ...DEFAULT_LOCATION_STATE }
      return activeSession.locationStates[locationId] ?? {
        ...DEFAULT_LOCATION_STATE,
      }
    },
    [activeSession],
  )

  const updateLocationState = useCallback(
    (
      locationId: string,
      updater: (prev: LocationState) => LocationState,
    ) => {
      if (activeSessionName === null) return

      persistSessions((prevSessions) => {
        const session = prevSessions[activeSessionName]
        if (!session) return prevSessions

        const prev = session.locationStates[locationId] ?? {
          ...DEFAULT_LOCATION_STATE,
        }
        const updated = updater(prev)

        return {
          ...prevSessions,
          [activeSessionName]: {
            ...session,
            locationStates: {
              ...session.locationStates,
              [locationId]: updated,
            },
          },
        }
      })
    },
    [activeSessionName, persistSessions],
  )

  const toggleChecked = useCallback(
    (locationId: string) => {
      updateLocationState(locationId, (prev) => ({
        ...prev,
        checked: !prev.checked,
      }))
    },
    [updateLocationState],
  )

  const assignItem = useCallback(
    (locationId: string, itemId: string | null) => {
      updateLocationState(locationId, (prev) => ({
        ...prev,
        assignedItemId: itemId,
      }))
    },
    [updateLocationState],
  )

  const setNote = useCallback(
    (locationId: string, note: string) => {
      updateLocationState(locationId, (prev) => ({
        ...prev,
        note,
      }))
    },
    [updateLocationState],
  )

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
      persistSessions((prev) => ({ ...prev, [parsed.name]: parsed }))
      persistActiveSessionName(parsed.name)
    },
    [persistSessions, persistActiveSessionName],
  )

  return {
    sessions,
    activeSessionName,
    activeSession,
    createSession,
    switchSession,
    deleteSession,
    getLocationState,
    toggleChecked,
    assignItem,
    setNote,
    exportSession,
    importSession,
  }
}
