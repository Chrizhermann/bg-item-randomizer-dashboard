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
