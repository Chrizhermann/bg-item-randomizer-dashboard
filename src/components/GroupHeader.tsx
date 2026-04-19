interface GroupHeaderProps {
  name: string
  checkedCount: number
  totalCount: number
  isExpanded: boolean
  isPoolOpen: boolean
  onToggle: () => void
  onTogglePool: () => void
}

export default function GroupHeader({
  name,
  checkedCount,
  totalCount,
  isExpanded,
  isPoolOpen,
  onToggle,
  onTogglePool,
}: GroupHeaderProps) {
  const isComplete = checkedCount === totalCount && totalCount > 0

  const handlePoolClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onTogglePool()
  }

  return (
    <button
      onClick={onToggle}
      className="sticky top-[57px] z-[5] w-full flex items-center gap-3 px-4 py-2 bg-stone-800 hover:bg-stone-700/50 border-b border-stone-700 text-left transition-colors"
    >
      <span
        className="text-stone-400 text-sm transition-transform duration-200"
        style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
      >
        ▶
      </span>

      <span className="font-medium text-amber-300">{name}</span>

      <span className="text-sm text-stone-500">
        {checkedCount}/{totalCount}
      </span>

      {isComplete && (
        <span className="text-sm text-green-500">Complete</span>
      )}

      <span
        onClick={handlePoolClick}
        className={`ml-auto text-xs px-2 py-0.5 rounded border transition-colors ${
          isPoolOpen
            ? 'bg-amber-600/20 text-amber-400 border-amber-600/30'
            : 'text-stone-500 border-stone-600 hover:text-stone-300 hover:border-stone-500'
        }`}
      >
        Items
      </span>
    </button>
  )
}
