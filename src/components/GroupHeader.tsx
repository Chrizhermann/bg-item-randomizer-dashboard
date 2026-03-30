interface GroupHeaderProps {
  name: string
  checkedCount: number
  totalCount: number
  isExpanded: boolean
  onToggle: () => void
}

export default function GroupHeader({
  name,
  checkedCount,
  totalCount,
  isExpanded,
  onToggle,
}: GroupHeaderProps) {
  const isComplete = checkedCount === totalCount && totalCount > 0

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
    </button>
  )
}
