interface ElectronAPI {
  isOverlay: boolean
  updateKeybinding: (key: string) => Promise<void>
  updateMonitor: (monitorId: number) => Promise<void>
  getDisplays: () => Promise<{ id: number; label: string }[]>
}

interface Window {
  electronAPI?: ElectronAPI
}
