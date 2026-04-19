import { useState } from 'react'
import SettingsPanel from './SettingsPanel'
import type { GroupBy, GameFilter, OverlaySettings } from '../types'

interface HeaderProps {
  totalLocations: number
  checkedCount: number
  groupBy: GroupBy
  onGroupByChange: (groupBy: GroupBy) => void
  gameFilter: GameFilter
  onGameFilterChange: (filter: GameFilter) => void
  sessionName: string | null
  onManageSessions: () => void
  onResetSession: () => void
  settings: OverlaySettings
  onUpdateSettings: (patch: Partial<OverlaySettings>) => void
}

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'tier', label: 'Tier' },
  { value: 'area', label: 'Area' },
  { value: 'status', label: 'Status' },
]

const GAME_FILTER_OPTIONS: { value: GameFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'bg1', label: 'BG1' },
  { value: 'bg2', label: 'BG2' },
]

export default function Header({
  totalLocations,
  checkedCount,
  groupBy,
  onGroupByChange,
  gameFilter,
  onGameFilterChange,
  sessionName,
  onManageSessions,
  onResetSession,
  settings,
  onUpdateSettings,
}: HeaderProps) {
  const [showSettings, setShowSettings] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
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

        {/* Right: game filter + group-by toggle + session button */}
        <div className="flex items-center gap-3">
          <div className="flex rounded-md overflow-hidden border border-stone-600">
            {GAME_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onGameFilterChange(opt.value)}
                className={`px-3 py-1 text-sm font-medium transition-colors ${
                  gameFilter === opt.value
                    ? 'bg-amber-600 text-stone-100'
                    : 'bg-stone-700 text-stone-400 hover:bg-stone-600 hover:text-stone-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

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

          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`px-2 py-1.5 text-sm rounded-md border transition-colors ${
                showSettings
                  ? 'bg-amber-600/20 text-amber-400 border-amber-600/30'
                  : 'bg-stone-700 border-stone-600 text-stone-400 hover:bg-stone-600 hover:text-stone-200'
              }`}
              title="Settings"
            >
              &#9881;
            </button>

            {showSettings && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-stone-800 border border-stone-700 rounded-lg shadow-xl z-50">
                <SettingsPanel
                  settings={settings}
                  onUpdateSettings={onUpdateSettings}
                  onClose={() => setShowSettings(false)}
                />
              </div>
            )}
          </div>

          {sessionName && (
            confirmReset ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-red-400">Reset all progress?</span>
                <button
                  onClick={() => { onResetSession(); setConfirmReset(false) }}
                  className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-500 transition-colors"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="px-2 py-1 text-xs bg-stone-600 text-stone-300 rounded hover:bg-stone-500 transition-colors"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmReset(true)}
                className="px-2 py-1.5 text-sm bg-stone-700 border border-stone-600 rounded-md text-stone-400 hover:bg-red-900/50 hover:text-red-300 hover:border-red-800 transition-colors"
                title="Reset session progress"
              >
                Reset
              </button>
            )
          )}

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
