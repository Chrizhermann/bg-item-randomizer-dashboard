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

  // Tell main process to resize the window when overlay state changes,
  // and set a data attribute on <html> so CSS can kill scrollbars in anchor mode
  useEffect(() => {
    if (isElectronOverlay) {
      window.electronAPI!.setOverlayMode(overlayState)
    }
    document.documentElement.dataset.overlayMode = overlayState
    return () => {
      delete document.documentElement.dataset.overlayMode
    }
  }, [overlayState, isElectronOverlay])

  // Anchor-only: the IR button fills the window exactly (48x48) with no transparent frame
  if (overlayState === 'anchor') {
    return (
      <div className="select-none h-screen w-screen overflow-hidden">
        <OverlayAnchor
          onLeftClick={handleAnchorLeftClick}
          onRightClick={handleAnchorRightClick}
          fillWindow
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

  // Expanded: full checklist with weathered-parchment backdrop
  return (
    <div className="h-screen overflow-y-auto bg-ink-900/85 backdrop-blur-md select-none border border-gold-700/20 rounded-md shadow-2xl">
      {/* Title bar */}
      <div
        className="sticky top-0 z-10 bg-ink-800/95 backdrop-blur-sm px-3 py-2 flex items-center justify-between border-b border-gold-700/25"
        style={isElectronOverlay ? undefined : { WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div
          className="flex items-center gap-2"
          style={isElectronOverlay ? undefined : { WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <OverlayAnchor
            onLeftClick={handleAnchorLeftClick}
            onRightClick={handleAnchorRightClick}
          />
          <div className="flex rounded overflow-hidden border border-ink-500 bg-ink-700/60">
            {GAME_FILTERS.map((f, i) => (
              <button
                key={f.value}
                onClick={() => setGameFilter(f.value)}
                className={`px-1.5 py-0.5 text-[10px] uppercase tracking-wider transition-colors ${
                  gameFilter === f.value
                    ? 'bg-gold-700 text-gold-50'
                    : 'text-ink-200 hover:bg-ink-600 hover:text-gold-200'
                } ${i > 0 ? 'border-l border-ink-500' : ''}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex rounded overflow-hidden border border-ink-500 bg-ink-700/60">
            <button
              onClick={expandAll}
              className="px-1.5 py-0.5 text-[10px] text-ink-200 hover:bg-ink-600 hover:text-gold-200 transition-colors"
              title="Expand all"
              aria-label="Expand all"
            >
              +
            </button>
            <button
              onClick={collapseAll}
              className="px-1.5 py-0.5 text-[10px] text-ink-200 hover:bg-ink-600 hover:text-gold-200 transition-colors border-l border-ink-500"
              title="Collapse all"
              aria-label="Collapse all"
            >
              −
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] text-gold-400/70 whitespace-nowrap tracking-[0.1em] uppercase"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Item Randomizer — {checkedCount}/{filteredLocations.length}
          </span>
          {isElectronOverlay && (
            <button
              onClick={() => window.electronAPI?.quit()}
              className="text-ink-300 hover:text-blood-400 text-xs leading-none transition-colors w-4 h-4 flex items-center justify-center"
              title="Quit application"
              aria-label="Quit"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {!hasSession && (
        <div
          className="px-3 py-2 bg-blood-600/30 text-blood-400 text-xs text-center italic border-b border-blood-600/30"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          No active session — create one in the web app.
        </div>
      )}

      <div style={isElectronOverlay ? undefined : { WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {groups.map((group) => {
          const isExpanded = !collapsedGroups.has(group.id)
          const groupCheckedCount = group.locations.filter(
            (loc) => locationStates[loc.id]?.checked,
          ).length
          const complete = groupCheckedCount === group.locations.length && group.locations.length > 0

          return (
            <div key={group.id}>
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center gap-2 px-3 py-1 text-[11px] bg-ink-800/60 hover:bg-ink-700/80 text-left transition-colors border-b border-ink-700/40"
              >
                <span
                  className="text-ink-200 text-[9px] transition-transform duration-200"
                  style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                  aria-hidden
                >
                  ▶
                </span>
                <span
                  className={`tracking-wider ${complete ? 'text-gold-300' : 'text-gold-200'}`}
                  style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}
                >
                  {group.name}
                </span>
                <span className="text-ink-200 tabular-nums text-[10px] ml-auto">
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
