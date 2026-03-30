import { useState } from 'react'
import type { Location, LocationState } from '../types'
import { itemById } from '../data-loader'
import ItemPopup from './ItemPopup'

interface LocationRowProps {
  location: Location
  state: LocationState
  onToggleChecked: () => void
  onAssignItem: (itemId: string | null) => void
  onSetNote: (note: string) => void
  showCodes: boolean
}

export default function LocationRow({
  location,
  state,
  onToggleChecked,
  onAssignItem,
  onSetNote,
  showCodes,
}: LocationRowProps) {
  const [showPopup, setShowPopup] = useState(false)

  const description =
    location.comment || `${location.target} in ${location.area}`

  const assignedItem =
    state.assignedItemId !== null ? itemById.get(state.assignedItemId) : null

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setShowPopup(true)
  }

  return (
    <div
      className={`relative flex items-center gap-3 px-4 py-2 border-b border-stone-800 hover:bg-stone-800/50 transition-colors ${
        state.checked ? 'opacity-60' : ''
      }`}
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

      <button
        onClick={() => setShowPopup(true)}
        className="ml-auto text-stone-600 hover:text-amber-400 transition-colors shrink-0"
      >
        +
      </button>

      {showPopup && (
        <ItemPopup
          tier={location.tier}
          currentItemId={state.assignedItemId}
          currentNote={state.note}
          onAssignItem={onAssignItem}
          onSetNote={onSetNote}
          onClose={() => setShowPopup(false)}
        />
      )}
    </div>
  )
}
