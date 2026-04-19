import { useState, useMemo, useCallback, useEffect } from 'react'
import type { GroupBy, Location, LocationState } from '../types'
import { groupLocations } from '../grouping'
import GroupHeader from './GroupHeader'
import LocationRow from './LocationRow'
import ItemPoolPanel from './ItemPoolPanel'

interface LocationListProps {
  locations: Location[]
  groupBy: GroupBy
  locationStates: Record<string, LocationState>
  assignedItemIds: Set<string>
  onToggleChecked: (locationId: string) => void
  onAssignItem: (locationId: string, itemId: string | null) => void
  onSetNote: (locationId: string, note: string) => void
}

const DEFAULT_LOCATION_STATE: LocationState = {
  checked: false,
  assignedItemId: null,
  note: '',
}

export default function LocationList({
  locations,
  groupBy,
  locationStates,
  assignedItemIds,
  onToggleChecked,
  onAssignItem,
  onSetNote,
}: LocationListProps) {
  const groups = useMemo(
    () => groupLocations(locations, groupBy, locationStates),
    [locations, groupBy, locationStates],
  )

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(groups.map((g) => g.id)),
  )
  const [showCodes, setShowCodes] = useState(false)
  const [openPickerRowId, setOpenPickerRowId] = useState<string | null>(null)
  const [openPoolGroupIds, setOpenPoolGroupIds] = useState<Set<string>>(
    () => new Set(),
  )

  // Reset expanded groups when groupBy changes
  useEffect(() => {
    setExpandedGroups(new Set(groups.map((g) => g.id)))
    setOpenPickerRowId(null)
    setOpenPoolGroupIds(new Set())
  }, [groupBy]) // eslint-disable-line react-hooks/exhaustive-deps

  const expandAll = useCallback(() => {
    setExpandedGroups(new Set(groups.map((g) => g.id)))
  }, [groups])

  const collapseAll = useCallback(() => {
    setExpandedGroups(new Set())
    setOpenPickerRowId(null)
    setOpenPoolGroupIds(new Set())
  }, [])

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

  const togglePool = useCallback((groupId: string) => {
    setOpenPoolGroupIds((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }, [])

  return (
    <div className="pb-20">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-ink-700/60">
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-1 text-[11px] uppercase tracking-wider text-ink-200 border border-ink-500 rounded bg-ink-700/60 hover:bg-ink-600 hover:text-gold-200 hover:border-gold-700/40 transition-colors"
          >
            Expand all
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1 text-[11px] uppercase tracking-wider text-ink-200 border border-ink-500 rounded bg-ink-700/60 hover:bg-ink-600 hover:text-gold-200 hover:border-gold-700/40 transition-colors"
          >
            Collapse all
          </button>
        </div>

        <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-ink-200 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showCodes}
            onChange={(e) => setShowCodes(e.target.checked)}
            className="peer sr-only"
          />
          <span className="w-4 h-4 rounded-sm border border-ink-400 bg-ink-800 flex items-center justify-center peer-checked:bg-gradient-to-br peer-checked:from-gold-500 peer-checked:to-gold-700 peer-checked:border-gold-400 transition-colors">
            <svg
              viewBox="0 0 12 12"
              className={`w-3 h-3 text-ink-900 ${showCodes ? 'block' : 'hidden'}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="2.5 6.5 5 9 9.5 3" />
            </svg>
          </span>
          <span>Show codes</span>
        </label>
      </div>

      {/* Groups */}
      {groups.map((group) => {
        const isExpanded = expandedGroups.has(group.id)
        const isPoolOpen = openPoolGroupIds.has(group.id)
        const checkedCount = group.locations.filter(
          (loc) => locationStates[loc.id]?.checked,
        ).length

        return (
          <div key={group.id}>
            <GroupHeader
              name={group.name}
              checkedCount={checkedCount}
              totalCount={group.locations.length}
              isExpanded={isExpanded}
              isPoolOpen={isPoolOpen}
              onToggle={() => toggleGroup(group.id)}
              onTogglePool={() => togglePool(group.id)}
            />

            {isPoolOpen && (
              <ItemPoolPanel
                tiers={group.tiers}
                assignedItemIds={assignedItemIds}
              />
            )}

            {isExpanded &&
              group.locations.map((loc) => (
                <LocationRow
                  key={loc.id}
                  location={loc}
                  state={locationStates[loc.id] ?? DEFAULT_LOCATION_STATE}
                  isPickerOpen={openPickerRowId === loc.id}
                  assignedItemIds={assignedItemIds}
                  onToggleChecked={() => onToggleChecked(loc.id)}
                  onAssignItem={(itemId) => onAssignItem(loc.id, itemId)}
                  onSetNote={(note) => onSetNote(loc.id, note)}
                  onOpenPicker={() => setOpenPickerRowId(loc.id)}
                  onClosePicker={() => setOpenPickerRowId(null)}
                  showCodes={showCodes}
                />
              ))}
          </div>
        )
      })}
    </div>
  )
}
