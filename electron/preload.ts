import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  isOverlay: true,
})
