import type { GroupBy } from '../types'

interface HeaderProps {
  totalLocations: number
  checkedCount: number
  groupBy: GroupBy
  onGroupByChange: (groupBy: GroupBy) => void
  sessionName: string | null
  onManageSessions: () => void
}

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'tier', label: 'Tier' },
  { value: 'area', label: 'Area' },
  { value: 'status', label: 'Status' },
]

export default function Header({
  totalLocations,
  checkedCount,
  groupBy,
  onGroupByChange,
  sessionName,
  onManageSessions,
}: HeaderProps) {
  const progressPct =
    totalLocations > 0 ? (checkedCount / totalLocations) * 100 : 0

  return (
    <header className="sticky top-0 z-10 bg-stone-800 border-b border-stone-700 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        {/* Left: title + progress */}
        <div className="flex items-center gap-6 min-w-0">
          <h1 className="text-lg font-bold text-amber-400 whitespace-nowrap">
            BG Item Randomizer
          </h1>

          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm text-stone-400 whitespace-nowrap">
              {checkedCount}/{totalLocations} checked
            </span>
            <div className="w-32 h-2 bg-stone-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right: group-by toggle + session button */}
        <div className="flex items-center gap-3">
          <div className="flex rounded-md overflow-hidden border border-stone-600">
            {GROUP_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onGroupByChange(opt.value)}
                className={`px-3 py-1 text-sm font-medium transition-colors ${
                  groupBy === opt.value
                    ? 'bg-amber-600 text-stone-100'
                    : 'bg-stone-700 text-stone-400 hover:bg-stone-600 hover:text-stone-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={onManageSessions}
            className="px-3 py-1.5 text-sm bg-stone-700 border border-stone-600 rounded-md text-stone-300 hover:bg-stone-600 hover:text-stone-100 transition-colors truncate max-w-[200px]"
          >
            {sessionName ?? 'No Session'}
          </button>
        </div>
      </div>
    </header>
  )
}
