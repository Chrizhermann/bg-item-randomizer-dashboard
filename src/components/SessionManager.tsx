import { useState, useRef, useEffect } from 'react'
import type { SessionState } from '../types'

interface SessionManagerProps {
  sessions: Record<string, SessionState>
  activeSessionName: string | null
  onCreateSession: (name: string) => void
  onSwitchSession: (name: string) => void
  onDeleteSession: (name: string) => void
  onExport: () => string | null
  onImport: (json: string) => void
  onClose: () => void
}

export default function SessionManager({
  sessions,
  activeSessionName,
  onCreateSession,
  onSwitchSession,
  onDeleteSession,
  onExport,
  onImport,
  onClose,
}: SessionManagerProps) {
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Escape closes the modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const sessionList = Object.values(sessions).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  function handleCreate() {
    const trimmed = newName.trim()
    if (!trimmed) return
    if (sessions[trimmed]) {
      setError('A session with that name already exists.')
      return
    }
    setError(null)
    onCreateSession(trimmed)
    setNewName('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleCreate()
  }

  function handleExport() {
    const json = onExport()
    if (!json) return
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeSessionName ?? 'session'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportClick() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        onImport(reader.result as string)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to import session.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-ink-800 border border-gold-700/40 rounded-md shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-ink-600 bg-ink-700/60">
          <h2
            className="text-gold-200 tracking-[0.06em] text-lg"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}
          >
            Session Manager
          </h2>
          <button
            onClick={onClose}
            className="text-ink-200 hover:text-gold-200 transition-colors text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="divider-gilt opacity-30" />

        <div className="p-5 space-y-4">
          {/* Create new session */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="New session name…"
              className="flex-1 px-3 py-2 bg-ink-700 border border-ink-500 rounded text-ink-50 placeholder:text-ink-300 text-sm focus:outline-none focus:border-gold-600/60 focus:bg-ink-700/80 transition-colors"
              style={{ fontFamily: 'var(--font-body)' }}
              autoFocus
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="px-4 py-2 bg-gradient-to-b from-gold-600 to-gold-700 text-gold-50 rounded text-sm font-medium hover:from-gold-500 hover:to-gold-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-[inset_0_1px_0_rgba(246,233,201,0.15)]"
            >
              Create
            </button>
          </div>

          {error && (
            <p className="text-sm text-blood-400 italic" style={{ fontFamily: 'var(--font-body)' }}>
              {error}
            </p>
          )}

          {/* Session list */}
          <div className="max-h-60 overflow-y-auto space-y-1 -mx-1 px-1">
            {sessionList.length === 0 && (
              <p
                className="text-sm text-ink-300 text-center py-5 italic"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                No sessions yet. Begin a new chronicle above.
              </p>
            )}
            {sessionList.map((session) => {
              const isActive = session.name === activeSessionName
              const locationCount = Object.keys(session.locationStates).length
              const checkedCount = Object.values(session.locationStates).filter(
                (s) => s.checked,
              ).length

              return (
                <div
                  key={session.name}
                  onClick={() => onSwitchSession(session.name)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded cursor-pointer transition-colors border ${
                    isActive
                      ? 'border-gold-600/50 bg-gold-900/20 shadow-[inset_0_0_0_1px_rgba(212,163,74,0.15)]'
                      : 'border-transparent hover:bg-ink-700/60 hover:border-ink-500'
                  }`}
                >
                  <div className="min-w-0">
                    <p
                      className={`text-sm truncate ${isActive ? 'text-gold-200 font-semibold' : 'text-ink-50'}`}
                      style={{ fontFamily: 'var(--font-body)', fontSize: '15px' }}
                    >
                      {session.name}
                    </p>
                    <p
                      className="text-[11px] text-ink-200 tabular-nums mt-0.5"
                      style={{ fontFamily: 'var(--font-body)' }}
                    >
                      <span className={isActive ? 'text-gold-300' : 'text-ink-100'}>
                        {checkedCount}
                      </span>
                      <span className="text-ink-300 mx-0.5">/</span>
                      <span>{locationCount}</span>
                      <span className="mx-2 text-ink-300">·</span>
                      <span className="italic">
                        {new Date(session.createdAt).toLocaleDateString()}
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (
                        window.confirm(
                          `Delete session "${session.name}"? This cannot be undone.`,
                        )
                      ) {
                        onDeleteSession(session.name)
                      }
                    }}
                    className="ml-3 text-[10px] uppercase tracking-wider text-ink-300 hover:text-blood-400 transition-colors shrink-0 px-2"
                    aria-label={`Delete session ${session.name}`}
                  >
                    Delete
                  </button>
                </div>
              )
            })}
          </div>

          {/* Export / Import */}
          <div className="flex gap-2 pt-3 border-t border-ink-600">
            <button
              onClick={handleExport}
              disabled={!activeSessionName}
              className="flex-1 px-3 py-2 bg-ink-700 border border-ink-500 rounded text-sm text-ink-100 hover:bg-ink-600 hover:text-gold-200 hover:border-gold-700/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider text-[11px]"
            >
              Export
            </button>
            <button
              onClick={handleImportClick}
              className="flex-1 px-3 py-2 bg-ink-700 border border-ink-500 rounded text-sm text-ink-100 hover:bg-ink-600 hover:text-gold-200 hover:border-gold-700/40 transition-colors uppercase tracking-wider text-[11px]"
            >
              Import
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
