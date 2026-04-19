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
    <header className="sticky top-0 z-10 bg-ink-800/95 backdrop-blur-sm border-b border-ink-600 px-5 py-3 shadow-[0_1px_0_0_rgba(146,104,40,0.15)]">
      <div className="flex items-center justify-between gap-5">
        {/* Left: title + progress */}
        <div className="flex items-center gap-6 min-w-0">
          <h1
            className="text-[22px] leading-none text-gold-300 whitespace-nowrap tracking-[0.08em]"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}
          >
            Item Randomizer
          </h1>

          <div className="flex items-center gap-3 min-w-0">
            <span
              className="text-sm text-ink-200 tabular-nums whitespace-nowrap"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              <span className="text-gold-200 font-semibold">{checkedCount}</span>
              <span className="text-ink-300 mx-1">/</span>
              <span>{totalLocations}</span>
              <span className="text-ink-300 ml-2 text-xs uppercase tracking-widest">
                found
              </span>
            </span>
            <div className="w-40 h-1.5 bg-ink-700 rounded-full overflow-hidden ring-1 ring-ink-600">
              <div
                className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-gold-600 via-gold-400 to-gold-300 shadow-[0_0_8px_rgba(212,163,74,0.4)]"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right: filters + session controls */}
        <div className="flex items-center gap-3">
          <SegmentedControl
            options={GAME_FILTER_OPTIONS}
            value={gameFilter}
            onChange={onGameFilterChange}
          />

          <SegmentedControl
            options={GROUP_OPTIONS}
            value={groupBy}
            onChange={onGroupByChange}
          />

          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`w-9 h-8 text-sm rounded border transition-colors flex items-center justify-center ${
                showSettings
                  ? 'bg-gold-700/25 text-gold-200 border-gold-600/40'
                  : 'bg-ink-700 border-ink-500 text-ink-200 hover:bg-ink-600 hover:text-gold-200 hover:border-gold-700/40'
              }`}
              title="Settings"
              aria-label="Settings"
            >
              <span className="text-base leading-none">⚙</span>
            </button>

            {showSettings && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-ink-800 border border-ink-500 rounded-lg shadow-2xl z-50 overflow-hidden">
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
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-blood-400 italic">Reset all progress?</span>
                <button
                  onClick={() => { onResetSession(); setConfirmReset(false) }}
                  className="px-2.5 py-1 text-xs font-medium bg-blood-600 text-gold-50 rounded hover:bg-blood-400 transition-colors"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="px-2.5 py-1 text-xs bg-ink-600 text-ink-100 rounded hover:bg-ink-500 transition-colors"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmReset(true)}
                className="px-3 py-1.5 text-xs uppercase tracking-wider bg-ink-700 border border-ink-500 rounded text-ink-200 hover:bg-blood-600/20 hover:text-blood-400 hover:border-blood-600/40 transition-colors"
                title="Reset session progress"
              >
                Reset
              </button>
            )
          )}

          <button
            onClick={onManageSessions}
            className="px-3.5 py-1.5 text-sm bg-ink-700 border border-ink-500 rounded text-ink-100 hover:bg-ink-600 hover:text-gold-200 hover:border-gold-700/40 transition-colors truncate max-w-[220px]"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {sessionName ?? <span className="italic text-ink-300">No session</span>}
          </button>
        </div>
      </div>
    </header>
  )
}

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}

function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <div className="flex rounded overflow-hidden border border-ink-500 bg-ink-700">
      {options.map((opt, i) => {
        const isActive = value === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 text-xs uppercase tracking-wider font-medium transition-colors ${
              isActive
                ? 'bg-gradient-to-b from-gold-600 to-gold-700 text-gold-50 shadow-inner'
                : 'text-ink-200 hover:bg-ink-600 hover:text-gold-200'
            } ${i > 0 ? 'border-l border-ink-500' : ''}`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
