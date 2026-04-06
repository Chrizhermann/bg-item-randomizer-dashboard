import { app, BrowserWindow, globalShortcut, screen, ipcMain } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { AppStoreManager } from './store'
import type { OverlaySettings } from './store'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let overlayVisible = false
let currentKeybinding = ''
let storeManager: AppStoreManager

// --- Monitor helpers ---

function getTargetDisplay(monitorId: number) {
  const displays = screen.getAllDisplays()
  return displays.find((d) => d.id === monitorId) ?? screen.getPrimaryDisplay()
}

function positionOverlay(monitorId: number) {
  if (!overlayWindow) return
  const display = getTargetDisplay(monitorId)
  const { x, y, width, height } = display.workArea
  const bounds = {
    x: x + width - 400,
    y: y + 50,
    width: 380,
    height: height - 100,
  }
  overlayWindow.setBounds(bounds)
  storeManager.patch({ settings: { overlayBounds: bounds } })
}

// --- Keybinding ---

function registerKeybinding(accelerator: string) {
  if (currentKeybinding) {
    globalShortcut.unregister(currentKeybinding)
  }
  const success = globalShortcut.register(accelerator, () => {
    if (!overlayWindow) return
    if (overlayVisible) {
      overlayWindow.hide()
    } else {
      overlayWindow.show()
    }
    overlayVisible = !overlayVisible
  })
  if (success) {
    currentKeybinding = accelerator
  }
}

// --- Side effects after store patch ---

function handleSideEffects(oldSettings: OverlaySettings, newSettings: OverlaySettings) {
  if (oldSettings.keybinding !== newSettings.keybinding) {
    registerKeybinding(newSettings.keybinding)
  }
  if (oldSettings.monitorId !== newSettings.monitorId) {
    positionOverlay(newSettings.monitorId)
  }
}

// --- Bounds persistence (debounced) ---

let boundsTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSaveBounds() {
  if (boundsTimer) clearTimeout(boundsTimer)
  boundsTimer = setTimeout(() => {
    const patch: Record<string, unknown> = {}
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      patch.overlayBounds = overlayWindow.getBounds()
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      patch.mainBounds = mainWindow.getBounds()
    }
    storeManager.patch({ settings: patch })
  }, 500)
}

// --- URL helpers ---

function loadApp(win: BrowserWindow, query?: string) {
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL + (query ? `?${query}` : ''))
  } else {
    win.loadFile(join(__dirname, '../dist/index.html'), {
      search: query ?? '',
    })
  }
}

// --- Window creation ---

function createMainWindow() {
  const settings = storeManager.get().settings
  const bounds = settings.mainBounds ?? { width: 1100, height: 800 }

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 600,
    minHeight: 400,
    title: 'BG Randomizer',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false,
    },
  })

  mainWindow.on('moved', scheduleSaveBounds)
  mainWindow.on('resized', scheduleSaveBounds)
  mainWindow.on('closed', () => { mainWindow = null })

  loadApp(mainWindow)
}

function createOverlayWindow() {
  const settings = storeManager.get().settings
  const display = getTargetDisplay(settings.monitorId)
  const { x, y, width, height } = display.workArea

  const bounds = settings.overlayBounds ?? {
    x: x + width - 400,
    y: y + 50,
    width: 380,
    height: height - 100,
  }

  overlayWindow = new BrowserWindow({
    ...bounds,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false,
    },
  })

  overlayWindow.setAlwaysOnTop(true, 'screen-saver')

  overlayWindow.on('moved', scheduleSaveBounds)
  overlayWindow.on('resized', scheduleSaveBounds)
  overlayWindow.on('closed', () => { overlayWindow = null })

  loadApp(overlayWindow, 'mode=overlay')
}

// --- IPC handlers ---

function setupIPC() {
  ipcMain.handle('store:get', () => storeManager.get())

  ipcMain.handle('store:patch', (_event, patch: unknown) => {
    const oldSettings = storeManager.get().settings
    storeManager.patch(patch as Record<string, unknown>)
    const newSettings = storeManager.get().settings
    handleSideEffects(oldSettings, newSettings)
  })

  ipcMain.handle('get-displays', () => {
    return screen.getAllDisplays().map((d) => ({
      id: d.id,
      label: `Display ${d.id} (${d.size.width}x${d.size.height})`,
    }))
  })
}

// --- App lifecycle ---

app.whenReady().then(() => {
  storeManager = new AppStoreManager()

  // Fix default monitorId (0) to actual primary display ID
  const settings = storeManager.get().settings
  if (settings.monitorId === 0) {
    storeManager.patch({ settings: { monitorId: screen.getPrimaryDisplay().id } })
  }

  setupIPC()
  createMainWindow()
  createOverlayWindow()
  registerKeybinding(storeManager.get().settings.keybinding)
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  storeManager?.flush()
})

app.on('window-all-closed', () => {
  app.quit()
})
