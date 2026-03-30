import { useState, useRef, useEffect, useMemo } from 'react'
import { itemsByTier } from '../data-loader'

interface ItemPopupProps {
  tier: string
  currentItemId: string | null
  currentNote: string
  onAssignItem: (itemId: string | null) => void
  onSetNote: (note: string) => void
  onClose: () => void
}

export default function ItemPopup({
  tier,
  currentItemId,
  currentNote,
  onAssignItem,
  onSetNote,
  onClose,
}: ItemPopupProps) {
  const [search, setSearch] = useState('')
  const [note, setNote] = useState(currentNote)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

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

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={handleOverlayClick}
    >
      <div className="bg-stone-800 border border-stone-600 rounded-lg w-96 max-h-[70vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-600">
          <h3 className="text-amber-400 font-semibold text-sm">
            Assign Item (Tier {tier})
          </h3>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-200 transition-colors text-lg leading-none"
          >
            &times;
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-stone-600">
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items..."
            className="w-full bg-stone-700 border border-stone-600 rounded px-3 py-1.5 text-sm text-stone-200 placeholder-stone-500 outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto">
          {currentItemId !== null && (
            <button
              onClick={handleClear}
              className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-stone-700/50 transition-colors border-b border-stone-700"
            >
              Clear assignment
            </button>
          )}

          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-sm text-stone-500 text-center">
              No items found
            </div>
          ) : (
            filtered.map((item) => {
              const isAssigned = item.id === currentItemId
              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-stone-700/50 transition-colors ${
                    isAssigned
                      ? 'bg-amber-600/20 text-amber-300'
                      : 'text-stone-200'
                  }`}
                >
                  <span>{item.displayName || item.resref}</span>
                  <span className="ml-2 text-xs font-mono text-stone-500">
                    {item.resref}
                  </span>
                </button>
              )
            })
          )}
        </div>

        {/* Note textarea */}
        <div className="px-4 py-3 border-t border-stone-600">
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={handleNoteBlur}
            placeholder="Add a note..."
            className="w-full bg-stone-700 border border-stone-600 rounded px-3 py-1.5 text-sm text-stone-200 placeholder-stone-500 outline-none focus:border-amber-500 transition-colors resize-none"
          />
        </div>
      </div>
    </div>
  )
}
