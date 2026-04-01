interface ElectronAPI {
  isOverlay: boolean
  isElectron: boolean
  storeGet: () => Promise<import('./types').AppStore>
  storePatch: (patch: import('./types').DeepPartial<import('./types').AppStore>) => Promise<void>
  onStoreChanged: (callback: (store: import('./types').AppStore) => void) => () => void
  getDisplays: () => Promise<{ id: number; label: string }[]>
}

interface Window {
  electronAPI?: ElectronAPI
}
