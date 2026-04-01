import { useState, useMemo } from 'react'
import type { GroupBy, GameFilter } from './types'
import { locations } from './data-loader'
import { useTrackerStore } from './store'
import { useSettings } from './settings'
import Header from './components/Header'
import SessionManager from './components/SessionManager'
import LocationList from './components/LocationList'
import OverlayView from './components/OverlayView'

function useIsOverlay(): boolean {
  const params = new URLSearchParams(window.location.search)
  return (
    params.get('mode') === 'overlay' ||
    !!(window as any).electronAPI?.isOverlay
  )
}

function App() {
  const store = useTrackerStore()
  const isOverlay = useIsOverlay()
  const { settings, updateSettings } = useSettings()
  const [groupBy, setGroupBy] = useState<GroupBy>('tier')
  const [gameFilter, setGameFilter] = useState<GameFilter>('all')
  const [showSessionManager, setShowSessionManager] = useState(
    () => store.activeSessionName === null,
  )

  const filteredLocations = useMemo(
    () =>
      gameFilter === 'all'
        ? locations
        : locations.filter((loc) => loc.game === gameFilter),
    [gameFilter],
  )

  const checkedCount = useMemo(() => {
    if (!store.activeSession) return 0
    return filteredLocations.filter(
      (loc) => store.activeSession!.locationStates[loc.id]?.checked,
    ).length
  }, [store.activeSession, filteredLocations])

  const totalLocations = filteredLocations.length

  const assignedItemIds = useMemo(() => {
    if (!store.activeSession) return new Set<string>()
    const ids = new Set<string>()
    for (const state of Object.values(store.activeSession.locationStates)) {
      if (state.assignedItemId) ids.add(state.assignedItemId)
    }
    return ids
  }, [store.activeSession])

  if (isOverlay) {
    return (
      <OverlayView
        locationStates={store.activeSession?.locationStates ?? {}}
        onToggleChecked={store.toggleChecked}
        settings={settings}
        onUpdateSettings={updateSettings}
      />
    )
  }

  return (
    <div className="min-h-screen bg-stone-900 text-stone-100">
      <Header
        totalLocations={totalLocations}
        checkedCount={checkedCount}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        gameFilter={gameFilter}
        onGameFilterChange={setGameFilter}
        sessionName={store.activeSessionName}
        onManageSessions={() => setShowSessionManager(true)}
        settings={settings}
        onUpdateSettings={updateSettings}
      />

      <main className="p-4">
        {store.activeSessionName === null ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-stone-400 text-lg">No active session</p>
            <button
              onClick={() => setShowSessionManager(true)}
              className="px-4 py-2 bg-amber-600 text-stone-100 rounded-md font-medium hover:bg-amber-500 transition-colors"
            >
              Manage Sessions
            </button>
          </div>
        ) : (
          <LocationList
            locations={filteredLocations}
            groupBy={groupBy}
            locationStates={store.activeSession?.locationStates ?? {}}
            assignedItemIds={assignedItemIds}
            onToggleChecked={store.toggleChecked}
            onAssignItem={store.assignItem}
            onSetNote={store.setNote}
          />
        )}
      </main>

      {showSessionManager && (
        <SessionManager
          sessions={store.sessions}
          activeSessionName={store.activeSessionName}
          onCreateSession={store.createSession}
          onSwitchSession={store.switchSession}
          onDeleteSession={store.deleteSession}
          onExport={store.exportSession}
          onImport={store.importSession}
          onClose={() => setShowSessionManager(false)}
        />
      )}
    </div>
  )
}

export default App
