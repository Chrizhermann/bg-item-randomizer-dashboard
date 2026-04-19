import { useState, useMemo, useCallback, useEffect } from 'react'
import type { LocationState, OverlaySettings, GameFilter } from '../types'
import { locations } from '../data-loader'
import { groupLocations } from '../grouping'
import OverlayLocationRow from './OverlayLocationRow'
import OverlayAnchor from './OverlayAnchor'
import SettingsPanel from './SettingsPanel'

type OverlayState = 'anchor' | 'expanded' | 'settings'

const COLLAPSED_KEY = 'bg-randomizer-overlay-collapsed'

function loadCollapsedGroups(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY)
    if (raw) return new Set(JSON.parse(raw) as string[])
  } catch { /* use default */ }
  return new Set()
}

function saveCollapsedGroups(collapsed: Set<string>) {
  localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]))
}

interface OverlayViewProps {
  locationStates: Record<string, LocationState>
  onToggleChecked: (locationId: string) => void
  settings: OverlaySettings
  onUpdateSettings: (patch: Partial<OverlaySettings>) => void
  hasSession: boolean
}

const DEFAULT_LOCATION_STATE: LocationState = {
  checked: false,
  assignedItemId: null,
  note: '',
}

const GAME_FILTERS: { value: GameFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'bg1', label: 'BG1' },
  { value: 'bg2', label: 'BG2' },
]

export default function OverlayView({
  locationStates,
  onToggleChecked,
  settings,
  onUpdateSettings,
  hasSession,
}: OverlayViewProps) {
  const [overlayState, setOverlayState] = useState<OverlayState>('anchor')
  const [gameFilter, setGameFilter] = useState<GameFilter>('all')
  const isElectronOverlay = !!window.electronAPI?.isOverlay

  const filteredLocations = useMemo(
    () => gameFilter === 'all' ? locations : locations.filter(loc => loc.game === gameFilter),
    [gameFilter],
  )

  const groups = useMemo(
    () => groupLocations(filteredLocations, 'tier', locationStates),
    [filteredLocations, locationStates],
  )

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(loadCollapsedGroups)

  const updateCollapsed = useCallback((updater: (prev: Set<string>) => Set<string>) => {
    setCollapsedGroups((prev) => {
      const next = updater(prev)
      saveCollapsedGroups(next)
      return next
    })
  }, [])

  const toggleGroup = useCallback((groupId: string) => {
    updateCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }, [updateCollapsed])

  const expandAll = useCallback(() => {
    updateCollapsed(() => new Set())
  }, [updateCollapsed])

  const collapseAll = useCallback(() => {
    updateCollapsed(() => new Set(groups.map((g) => g.id)))
  }, [updateCollapsed, groups])

  const checkedCount = useMemo(() => {
    return filteredLocations.filter(loc => locationStates[loc.id]?.checked).length
  }, [filteredLocations, locationStates])

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

  // Tell main process to resize the window when overlay state changes
  useEffect(() => {
    if (isElectronOverlay) {
      window.electronAPI!.setOverlayMode(overlayState)
    }
  }, [overlayState, isElectronOverlay])

  // Anchor-only: just the IR button, window is shrunk to fit
  if (overlayState === 'anchor') {
    return (
      <div className="select-none">
        <OverlayAnchor
          onLeftClick={handleAnchorLeftClick}
          onRightClick={handleAnchorRightClick}
        />
      </div>
    )
  }

  // Settings: anchor + settings panel
  if (overlayState === 'settings') {
    return (
      <div className="select-none">
        <div className="flex justify-end">
          <OverlayAnchor
            onLeftClick={handleAnchorLeftClick}
            onRightClick={handleAnchorRightClick}
          />
        </div>
        <div className="bg-black/90 rounded-lg mx-2 border border-stone-700">
          <SettingsPanel
            settings={settings}
            onUpdateSettings={onUpdateSettings}
            onClose={() => setOverlayState('anchor')}
          />
        </div>
      </div>
    )
  }

  // Expanded: full checklist with semi-transparent background
  return (
    <div className="h-screen overflow-y-auto bg-black/70 select-none">
      {/* Title bar */}
      <div
        className="sticky top-0 z-10 bg-black/80 px-3 py-2 flex items-center justify-between"
        style={isElectronOverlay ? undefined : { WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2" style={isElectronOverlay ? undefined : { WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <OverlayAnchor
            onLeftClick={handleAnchorLeftClick}
            onRightClick={handleAnchorRightClick}
          />
          {/* Game filter */}
          <div className="flex gap-0.5">
            {GAME_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setGameFilter(f.value)}
                className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                  gameFilter === f.value
                    ? 'bg-amber-600 text-white'
                    : 'bg-stone-700/50 text-stone-400 hover:bg-stone-600/50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {/* Expand/Collapse all */}
          <div className="flex gap-0.5">
            <button
              onClick={expandAll}
              className="px-1.5 py-0.5 text-[10px] rounded bg-stone-700/50 text-stone-400 hover:bg-stone-600/50 transition-colors"
              title="Expand all"
            >
              +
            </button>
            <button
              onClick={collapseAll}
              className="px-1.5 py-0.5 text-[10px] rounded bg-stone-700/50 text-stone-400 hover:bg-stone-600/50 transition-colors"
              title="Collapse all"
            >
              −
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-stone-500 whitespace-nowrap">
            BG 1/2 Item Randomizer Checklist — {checkedCount}/{filteredLocations.length}
          </span>
          {isElectronOverlay && (
            <button
              onClick={() => window.electronAPI?.quit()}
              className="text-stone-600 hover:text-red-400 text-xs leading-none transition-colors"
              title="Quit application"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* No session warning */}
      {!hasSession && (
        <div className="px-3 py-2 bg-red-900/50 text-red-300 text-xs text-center">
          No active session — create one in the web app
        </div>
      )}

      {/* Group list */}
      <div style={isElectronOverlay ? undefined : { WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {groups.map((group) => {
          const isExpanded = !collapsedGroups.has(group.id)
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
