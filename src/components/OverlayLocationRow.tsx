import type { Location, LocationState } from '../types'
import { itemById } from '../data-loader'

interface OverlayLocationRowProps {
  location: Location
  state: LocationState
  onToggleChecked: () => void
}

export default function OverlayLocationRow({
  location,
  state,
  onToggleChecked,
}: OverlayLocationRowProps) {
  const description = location.comment || location.target

  const assignedItem =
    state.assignedItemId !== null ? itemById.get(state.assignedItemId) : null

  return (
    <div
      onClick={onToggleChecked}
      className={`flex items-center gap-2 px-2 py-1 text-xs cursor-pointer hover:bg-white/5 transition-colors ${
        state.checked ? 'opacity-40' : ''
      }`}
    >
      <span className={state.checked ? 'text-green-400' : 'text-stone-500'}>
        {state.checked ? '✓' : '○'}
      </span>

      <span
        className={
          state.checked
            ? 'line-through text-stone-500'
            : 'text-stone-200'
        }
      >
        {description}
      </span>

      {assignedItem && (
        <span className="text-amber-400 truncate max-w-[120px]">
          {assignedItem.displayName || assignedItem.resref}
        </span>
      )}
    </div>
  )
}
