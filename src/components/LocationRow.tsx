import type { Location, LocationState } from '../types'
import { itemById } from '../data-loader'
import InlineItemPicker from './InlineItemPicker'

interface LocationRowProps {
  location: Location
  state: LocationState
  isPickerOpen: boolean
  assignedItemIds: Set<string>
  onToggleChecked: () => void
  onAssignItem: (itemId: string | null) => void
  onSetNote: (note: string) => void
  onOpenPicker: () => void
  onClosePicker: () => void
  showCodes: boolean
}

export default function LocationRow({
  location,
  state,
  isPickerOpen,
  assignedItemIds,
  onToggleChecked,
  onAssignItem,
  onSetNote,
  onOpenPicker,
  onClosePicker,
  showCodes,
}: LocationRowProps) {
  const description =
    location.comment || `${location.target} in ${location.area}`

  const assignedItem =
    state.assignedItemId !== null ? itemById.get(state.assignedItemId) : null

  const handleRowClick = (e: React.MouseEvent) => {
    // Don't open picker when clicking the checkbox
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' && target.getAttribute('type') === 'checkbox') return

    if (isPickerOpen) {
      onClosePicker()
    } else {
      onOpenPicker()
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    if (isPickerOpen) {
      onClosePicker()
    } else {
      onOpenPicker()
    }
  }

  return (
    <div>
      <div
        className={`relative flex items-center gap-3 px-4 py-2 border-b border-stone-800 cursor-pointer transition-colors ${
          isPickerOpen
            ? 'bg-stone-700/50'
            : 'hover:bg-stone-800/50'
        } ${state.checked ? 'opacity-60' : ''}`}
        onClick={handleRowClick}
        onContextMenu={handleContextMenu}
      >
        <input
          type="checkbox"
          checked={state.checked}
          onChange={onToggleChecked}
          className="accent-amber-500 shrink-0"
        />

        <span
          className={`text-sm ${
            state.checked ? 'line-through text-stone-500' : 'text-stone-200'
          }`}
        >
          {description}
        </span>

        {showCodes && (
          <span className="text-xs text-stone-600 font-mono shrink-0">
            {location.area}/{location.target}
          </span>
        )}

        {assignedItem && (
          <span className="text-xs bg-amber-600/20 text-amber-300 border border-amber-600/30 rounded px-2 py-0.5 shrink-0">
            {assignedItem.displayName || assignedItem.resref}
          </span>
        )}

        {state.note && (
          <span className="shrink-0 cursor-default" title={state.note}>
            📝
          </span>
        )}
      </div>

      {isPickerOpen && (
        <InlineItemPicker
          tier={location.tier}
          currentItemId={state.assignedItemId}
          currentNote={state.note}
          assignedItemIds={assignedItemIds}
          onAssignItem={onAssignItem}
          onSetNote={onSetNote}
          onClose={onClosePicker}
        />
      )}
    </div>
  )
}
