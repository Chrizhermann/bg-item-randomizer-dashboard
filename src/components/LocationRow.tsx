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
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' && target.getAttribute('type') === 'checkbox') return
    if (isPickerOpen) onClosePicker()
    else onOpenPicker()
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    if (isPickerOpen) onClosePicker()
    else onOpenPicker()
  }

  return (
    <div>
      <div
        className={`group relative flex items-center gap-3 px-5 py-1.5 border-b border-ink-800/70 cursor-pointer transition-all ${
          isPickerOpen
            ? 'bg-gold-900/30 border-l-2 border-l-gold-500/70 pl-[18px]'
            : 'hover:bg-ink-700/40 border-l-2 border-l-transparent'
        }`}
        onClick={handleRowClick}
        onContextMenu={handleContextMenu}
      >
        <label className="flex items-center shrink-0 cursor-pointer" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={state.checked}
            onChange={onToggleChecked}
            className="peer sr-only"
          />
          <span
            className={`w-4 h-4 rounded-sm border flex items-center justify-center transition-all ${
              state.checked
                ? 'bg-gradient-to-br from-gold-500 to-gold-700 border-gold-400 shadow-[inset_0_1px_0_rgba(246,233,201,0.3)]'
                : 'border-ink-400 bg-ink-800 group-hover:border-gold-600'
            }`}
          >
            {state.checked && (
              <svg
                viewBox="0 0 12 12"
                className="w-3 h-3 text-ink-900"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="2.5 6.5 5 9 9.5 3" />
              </svg>
            )}
          </span>
        </label>

        <span
          className={`flex-1 min-w-0 truncate transition-colors ${
            state.checked
              ? 'line-through text-ink-300 italic'
              : 'text-ink-100'
          }`}
          style={{ fontFamily: 'var(--font-body)', fontSize: '15px', lineHeight: '1.4' }}
        >
          {description}
        </span>

        {showCodes && (
          <span
            className="text-[10px] uppercase tracking-wider text-ink-300 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {location.area}/{location.target}
          </span>
        )}

        {assignedItem && (
          <span
            className="flex items-center gap-1.5 text-xs px-2.5 py-0.5 shrink-0 max-w-[40%] truncate bg-gold-700/20 text-gold-200 border border-gold-600/30 rounded-sm"
            style={{ fontFamily: 'var(--font-body)' }}
            title={assignedItem.resref}
          >
            <span className="w-1 h-1 rounded-full bg-gold-400 shrink-0" aria-hidden />
            <span className="truncate">{assignedItem.displayName || assignedItem.resref}</span>
          </span>
        )}

        {state.note && (
          <span
            className="shrink-0 cursor-default text-gold-300/80 text-sm"
            title={state.note}
            aria-label="has note"
          >
            ❦
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
