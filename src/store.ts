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
    (next: Record<string, SessionState>) => {
      setSessions(next)
      saveSessions(next)
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
      const next = { ...sessions, [name]: session }
      persistSessions(next)
      persistActiveSessionName(name)
    },
    [sessions, persistSessions, persistActiveSessionName],
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
      const next = { ...sessions }
      delete next[name]
      persistSessions(next)

      if (activeSessionName === name) {
        const remaining = Object.keys(next)
        persistActiveSessionName(remaining.length > 0 ? remaining[0] : null)
      }
    },
    [sessions, activeSessionName, persistSessions, persistActiveSessionName],
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
      if (activeSessionName === null || !sessions[activeSessionName]) return

      const session = sessions[activeSessionName]
      const prev = session.locationStates[locationId] ?? {
        ...DEFAULT_LOCATION_STATE,
      }
      const updated = updater(prev)

      const nextSession: SessionState = {
        ...session,
        locationStates: {
          ...session.locationStates,
          [locationId]: updated,
        },
      }
      const next = { ...sessions, [activeSessionName]: nextSession }
      persistSessions(next)
    },
    [sessions, activeSessionName, persistSessions],
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
      const next = { ...sessions, [parsed.name]: parsed }
      persistSessions(next)
      persistActiveSessionName(parsed.name)
    },
    [sessions, persistSessions, persistActiveSessionName],
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
