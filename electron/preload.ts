import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  isOverlay: true,
  updateKeybinding: (key: string) => ipcRenderer.invoke('update-keybinding', key),
  updateMonitor: (monitorId: number) => ipcRenderer.invoke('update-monitor', monitorId),
  getDisplays: () => ipcRenderer.invoke('get-displays') as Promise<{ id: number; label: string }[]>,
})
