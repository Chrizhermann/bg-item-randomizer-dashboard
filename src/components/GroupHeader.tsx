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
  const progress = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0

  const handlePoolClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onTogglePool()
  }

  return (
    <div className="sticky top-[57px] z-[5]">
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-5 py-2 text-left transition-colors bg-ink-700/95 backdrop-blur-sm hover:bg-ink-600/80 border-y border-ink-600 ${
          isComplete ? 'border-b-gold-700/40' : ''
        }`}
      >
        <span
          className="text-ink-200 text-[10px] transition-transform duration-200 w-3 flex-shrink-0"
          style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
          aria-hidden
        >
          ▶
        </span>

        <h2
          className={`tracking-[0.04em] text-[17px] ${
            isComplete ? 'text-gold-300' : 'text-gold-200'
          }`}
          style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}
        >
          {name}
        </h2>

        <span
          className="text-xs tabular-nums text-ink-200"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          <span className={isComplete ? 'text-gold-300 font-semibold' : 'text-ink-100'}>
            {checkedCount}
          </span>
          <span className="text-ink-300 mx-0.5">/</span>
          <span>{totalCount}</span>
        </span>

        {isComplete && (
          <span
            className="text-[10px] uppercase tracking-widest text-gold-300 italic border-b border-gold-600/40 pb-px"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Complete
          </span>
        )}

        {/* tiny inline progress glyph — doubles as visual rhythm */}
        <span className="hidden sm:flex items-center gap-0.5 ml-1" aria-hidden>
          {Array.from({ length: 5 }).map((_, i) => {
            const threshold = (i + 1) * 20
            const filled = progress >= threshold
            const partial = !filled && progress >= threshold - 20
            return (
              <span
                key={i}
                className={`w-1 h-2 rounded-[1px] transition-colors ${
                  filled
                    ? 'bg-gold-400'
                    : partial
                      ? 'bg-gold-700/60'
                      : 'bg-ink-500'
                }`}
              />
            )
          })}
        </span>

        <span
          onClick={handlePoolClick}
          className={`ml-auto text-[10px] uppercase tracking-wider px-2.5 py-1 rounded border transition-colors cursor-pointer ${
            isPoolOpen
              ? 'bg-gold-700/25 text-gold-200 border-gold-600/40'
              : 'text-ink-200 border-ink-500 hover:text-gold-200 hover:border-gold-700/50'
          }`}
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Pool
        </span>
      </button>
      {/* gilt underline */}
      <div className="divider-gilt opacity-40" />
    </div>
  )
}
