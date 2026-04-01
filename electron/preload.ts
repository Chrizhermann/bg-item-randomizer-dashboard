import { contextBridge, ipcRenderer } from 'electron'

const isOverlay = new URLSearchParams(window.location.search).get('mode') === 'overlay'

contextBridge.exposeInMainWorld('electronAPI', {
  isOverlay,
  isElectron: true,

  // Store
  storeGet: () => ipcRenderer.invoke('store:get'),
  storePatch: (patch: unknown) => ipcRenderer.invoke('store:patch', patch),
  onStoreChanged: (callback: (store: unknown) => void) => {
    const handler = (_event: unknown, store: unknown) => callback(store)
    ipcRenderer.on('store:changed', handler as (...args: unknown[]) => void)
    return () => {
      ipcRenderer.removeListener('store:changed', handler as (...args: unknown[]) => void)
    }
  },

  // Electron-only queries
  getDisplays: () => ipcRenderer.invoke('get-displays') as Promise<{ id: number; label: string }[]>,
})
