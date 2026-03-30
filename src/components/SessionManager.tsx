import { useState, useRef } from 'react'
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
    if (e.key === 'Enter') {
      handleCreate()
    }
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
        setError(
          err instanceof Error ? err.message : 'Failed to import session.',
        )
      }
    }
    reader.readAsText(file)
    // Reset so re-selecting the same file triggers onChange
    e.target.value = ''
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-stone-800 border border-stone-700 rounded-lg shadow-xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-700">
          <h2 className="text-lg font-semibold text-stone-100">
            Session Manager
          </h2>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-100 transition-colors text-xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Create new session */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="New session name..."
              className="flex-1 px-3 py-2 bg-stone-700 border border-stone-600 rounded-md text-stone-100 placeholder:text-stone-500 text-sm focus:outline-none focus:border-amber-500"
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="px-4 py-2 bg-amber-600 text-stone-100 rounded-md text-sm font-medium hover:bg-amber-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Create
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          {/* Session list */}
          <div className="max-h-60 overflow-y-auto space-y-1">
            {sessionList.length === 0 && (
              <p className="text-sm text-stone-500 text-center py-4">
                No sessions yet. Create one above.
              </p>
            )}
            {sessionList.map((session) => {
              const isActive = session.name === activeSessionName
              const locationCount = Object.keys(
                session.locationStates,
              ).length
              const checkedCount = Object.values(
                session.locationStates,
              ).filter((s) => s.checked).length

              return (
                <div
                  key={session.name}
                  onClick={() => onSwitchSession(session.name)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
                    isActive
                      ? 'border border-amber-500 bg-stone-700/50'
                      : 'border border-transparent hover:bg-stone-700/50'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-100 truncate">
                      {session.name}
                    </p>
                    <p className="text-xs text-stone-500">
                      {checkedCount}/{locationCount} tracked
                      {' \u00b7 '}
                      {new Date(session.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteSession(session.name)
                    }}
                    className="ml-3 text-stone-500 hover:text-red-400 transition-colors text-sm shrink-0"
                    aria-label={`Delete session ${session.name}`}
                  >
                    Delete
                  </button>
                </div>
              )
            })}
          </div>

          {/* Export / Import */}
          <div className="flex gap-2 pt-2 border-t border-stone-700">
            <button
              onClick={handleExport}
              disabled={!activeSessionName}
              className="flex-1 px-3 py-2 bg-stone-700 border border-stone-600 rounded-md text-sm text-stone-300 hover:bg-stone-600 hover:text-stone-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Export
            </button>
            <button
              onClick={handleImportClick}
              className="flex-1 px-3 py-2 bg-stone-700 border border-stone-600 rounded-md text-sm text-stone-300 hover:bg-stone-600 hover:text-stone-100 transition-colors"
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
