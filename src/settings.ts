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
