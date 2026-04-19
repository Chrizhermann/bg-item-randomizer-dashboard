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
    if (itemId === currentItemId) onAssignItem(null)
    else onAssignItem(itemId)
    onClose()
  }

  const handleClear = () => {
    onAssignItem(null)
    onClose()
  }

  const handleNoteBlur = () => {
    if (note !== currentNote) onSetNote(note)
  }

  return (
    <div
      ref={containerRef}
      className="border-b border-ink-700 bg-ink-800/80 backdrop-blur-sm"
    >
      {/* Search + note row */}
      <div className="flex items-center gap-2 px-5 py-2.5 border-b border-ink-700/70">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span
            className="text-[10px] uppercase tracking-widest text-gold-400/70 shrink-0"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Tier {tier}
          </span>
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items…"
            className="flex-1 min-w-0 bg-ink-700/60 border border-ink-500 rounded px-2.5 py-1 text-sm text-ink-50 placeholder-ink-300 outline-none focus:border-gold-600/60 focus:bg-ink-700 transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          />
        </div>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={handleNoteBlur}
          placeholder="Note…"
          className="w-44 bg-ink-700/60 border border-ink-500 rounded px-2.5 py-1 text-sm text-ink-50 placeholder-ink-300 italic outline-none focus:border-gold-600/60 focus:bg-ink-700 transition-colors"
          style={{ fontFamily: 'var(--font-body)' }}
        />
        {currentItemId !== null && (
          <button
            onClick={handleClear}
            className="text-[10px] uppercase tracking-wider text-blood-400 hover:text-blood-600 whitespace-nowrap transition-colors px-1"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Clear
          </button>
        )}
        <button
          onClick={onClose}
          className="text-ink-300 hover:text-ink-100 transition-colors text-base leading-none w-5 h-5 flex items-center justify-center"
          aria-label="Close picker"
        >
          ×
        </button>
      </div>

      {/* Item grid */}
      <div className="max-h-52 overflow-y-auto px-5 py-2">
        {filtered.length === 0 ? (
          <p
            className="text-xs text-ink-300 text-center py-3 italic"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            No items match.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-0.5">
            {filtered.map((item) => {
              const isCurrent = item.id === currentItemId
              const isAssignedElsewhere = !isCurrent && assignedItemIds.has(item.id)
              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  className={`text-left text-[13px] truncate rounded px-1.5 py-0.5 transition-colors ${
                    isCurrent
                      ? 'bg-gold-700/30 text-gold-200 font-semibold'
                      : isAssignedElsewhere
                        ? 'line-through text-ink-300 hover:text-ink-200'
                        : 'text-ink-100 hover:bg-ink-700/60 hover:text-gold-100'
                  }`}
                  style={{ fontFamily: 'var(--font-body)' }}
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
