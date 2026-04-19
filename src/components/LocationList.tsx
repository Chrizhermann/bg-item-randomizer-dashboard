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
