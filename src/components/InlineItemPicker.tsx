import { useState, useRef, useEffect, useMemo } from 'react'
import { itemsByTier } from '../data-loader'

interface InlineItemPickerProps {
  tier: string
  currentItemId: string | null
  currentNote: string
  assignedItemIds: Set<string>
  onAssignItem: (itemId: string | null) => void
  onSetNote: (note: string) => void
  onClose: () => void
}

export default function InlineItemPicker({
  tier,
  currentItemId,
  currentNote,
  assignedItemIds,
  onAssignItem,
  onSetNote,
  onClose,
}: InlineItemPickerProps) {
  const [search, setSearch] = useState('')
  const [note, setNote] = useState(currentNote)
  const searchRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const noteRef = useRef(note)
  const currentNoteRef = useRef(currentNote)
  const onSetNoteRef = useRef(onSetNote)
  noteRef.current = note
  currentNoteRef.current = currentNote
  onSetNoteRef.current = onSetNote

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // Save note on unmount
  useEffect(() => {
    return () => {
      if (noteRef.current !== currentNoteRef.current) {
        onSetNoteRef.current(noteRef.current)
      }
    }
  }, [])

  // Escape key closes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const tierItems = useMemo(() => itemsByTier.get(tier) ?? [], [tier])

  const filtered = useMemo(() => {
    if (!search) return tierItems
    const q = search.toLowerCase()
    return tierItems.filter(
      (item) =>
        item.displayName.toLowerCase().includes(q) ||
        item.resref.toLowerCase().includes(q),
    )
  }, [tierItems, search])

  const handleItemClick = (itemId: string) => {
    if (itemId === currentItemId) {
      onAssignItem(null)
    } else {
      onAssignItem(itemId)
    }
    onClose()
  }

  const handleClear = () => {
    onAssignItem(null)
    onClose()
  }

  const handleNoteBlur = () => {
    if (note !== currentNote) {
      onSetNote(note)
    }
  }

  return (
    <div
      ref={containerRef}
      className="border-b border-stone-700 bg-stone-900/80"
    >
      {/* Search + note row */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-stone-800">
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items..."
          className="flex-1 bg-stone-700 border border-stone-600 rounded px-2 py-1 text-sm text-stone-200 placeholder-stone-500 outline-none focus:border-amber-500 transition-colors"
        />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={handleNoteBlur}
          placeholder="Note..."
          className="w-40 bg-stone-700 border border-stone-600 rounded px-2 py-1 text-sm text-stone-200 placeholder-stone-500 outline-none focus:border-amber-500 transition-colors"
        />
        {currentItemId !== null && (
          <button
            onClick={handleClear}
            className="text-xs text-red-400 hover:text-red-300 whitespace-nowrap transition-colors"
          >
            Clear
          </button>
        )}
        <button
          onClick={onClose}
          className="text-stone-500 hover:text-stone-300 transition-colors text-lg leading-none"
        >
          &times;
        </button>
      </div>

      {/* Item grid */}
      <div className="max-h-48 overflow-y-auto px-4 py-2">
        {filtered.length === 0 ? (
          <p className="text-xs text-stone-500 text-center py-2">
            No items found
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-0.5">
            {filtered.map((item) => {
              const isCurrent = item.id === currentItemId
              const isAssignedElsewhere =
                !isCurrent && assignedItemIds.has(item.id)
              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  className={`text-left text-xs truncate rounded px-1 py-0.5 transition-colors ${
                    isCurrent
                      ? 'bg-amber-600/30 text-amber-300 font-medium'
                      : isAssignedElsewhere
                        ? 'line-through text-stone-600 hover:text-stone-400'
                        : 'text-stone-300 hover:bg-stone-700/50 hover:text-stone-100'
                  }`}
                  title={`${item.displayName || item.resref} (${item.resref})`}
                >
                  {item.displayName || item.resref}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
