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
      className={`flex items-center gap-2 px-2.5 py-0.5 text-xs cursor-pointer hover:bg-gold-500/10 transition-colors ${
        state.checked ? 'opacity-40' : ''
      }`}
      style={{ fontFamily: 'var(--font-body)' }}
    >
      <span
        className={`w-3 inline-block text-center leading-none shrink-0 ${
          state.checked ? 'text-gold-300' : 'text-ink-200'
        }`}
      >
        {state.checked ? '✓' : '·'}
      </span>

      <span
        className={`truncate ${
          state.checked ? 'line-through text-ink-200' : 'text-ink-50'
        }`}
      >
        {description}
      </span>

      {assignedItem && (
        <span className="text-gold-300 truncate max-w-[130px] ml-auto shrink-0 italic">
          {assignedItem.displayName || assignedItem.resref}
        </span>
      )}
    </div>
  )
}
