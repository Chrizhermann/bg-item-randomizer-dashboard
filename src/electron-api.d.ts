interface ElectronAPI {
  isOverlay: boolean
  isElectron: boolean
  storeGet: () => Promise<import('./types').AppStore>
  storePatch: (patch: import('./types').DeepPartial<import('./types').AppStore>) => Promise<void>
  onStoreChanged: (callback: (store: import('./types').AppStore) => void) => () => void
  getDisplays: () => Promise<{ id: number; label: string }[]>
  quit: () => Promise<void>
  setOverlayMode: (mode: 'anchor' | 'expanded' | 'settings') => void
  startDrag: () => void
  stopDrag: () => void
}

interface Window {
  electronAPI?: ElectronAPI
}
