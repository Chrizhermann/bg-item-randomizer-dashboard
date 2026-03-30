import { useState, useMemo, useCallback, useEffect } from 'react'
import type { GroupBy, LocationState } from '../types'
import { locations } from '../data-loader'
import { groupLocations } from '../grouping'
import GroupHeader from './GroupHeader'
import LocationRow from './LocationRow'

interface LocationListProps {
  groupBy: GroupBy
  locationStates: Record<string, LocationState>
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
  groupBy,
  locationStates,
  onToggleChecked,
  onAssignItem,
  onSetNote,
}: LocationListProps) {
  const groups = useMemo(
    () => groupLocations(locations, groupBy, locationStates),
    [groupBy, locationStates],
  )

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(groups.map((g) => g.id)),
  )
  const [showCodes, setShowCodes] = useState(false)

  // Reset expanded groups when groupBy changes (group IDs change entirely)
  useEffect(() => {
    setExpandedGroups(new Set(groups.map((g) => g.id)))
  }, [groupBy]) // eslint-disable-line react-hooks/exhaustive-deps

  const expandAll = useCallback(() => {
    setExpandedGroups(new Set(groups.map((g) => g.id)))
  }, [groups])

  const collapseAll = useCallback(() => {
    setExpandedGroups(new Set())
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

  return (
    <div className="pb-20">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="px-2 py-1 text-xs bg-stone-700 text-stone-300 rounded hover:bg-stone-600 transition-colors"
          >
            Expand all
          </button>
          <button
            onClick={collapseAll}
            className="px-2 py-1 text-xs bg-stone-700 text-stone-300 rounded hover:bg-stone-600 transition-colors"
          >
            Collapse all
          </button>
        </div>

        <label className="flex items-center gap-2 text-sm text-stone-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showCodes}
            onChange={(e) => setShowCodes(e.target.checked)}
            className="accent-amber-500"
          />
          Show codes
        </label>
      </div>

      {/* Groups */}
      {groups.map((group) => {
        const isExpanded = expandedGroups.has(group.id)
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
              onToggle={() => toggleGroup(group.id)}
            />

            {isExpanded &&
              group.locations.map((loc) => (
                <LocationRow
                  key={loc.id}
                  location={loc}
                  state={locationStates[loc.id] ?? DEFAULT_LOCATION_STATE}
                  onToggleChecked={() => onToggleChecked(loc.id)}
                  onAssignItem={(itemId) => onAssignItem(loc.id, itemId)}
                  onSetNote={(note) => onSetNote(loc.id, note)}
                  showCodes={showCodes}
                />
              ))}
          </div>
        )
      })}
    </div>
  )
}
