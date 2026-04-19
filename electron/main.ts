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

// Overlay expanded bounds (persisted). Anchor mode derives position from these.
let overlayExpandedBounds: Electron.Rectangle | null = null
const ANCHOR_SIZE = 48

// --- Monitor helpers ---

function getTargetDisplay(monitorId: number) {
  const displays = screen.getAllDisplays()
  return displays.find((d) => d.id === monitorId) ?? screen.getPrimaryDisplay()
}

function defaultOverlayBounds(monitorId: number) {
  const display = getTargetDisplay(monitorId)
  const { x, y, width } = display.workArea
  const overlayWidth = 380
  return {
    x: x + Math.round((width - overlayWidth) / 2),
    y: y + 20,
    width: overlayWidth,
    height: 600,
  }
}

function positionOverlay(monitorId: number) {
  if (!overlayWindow) return
  const bounds = defaultOverlayBounds(monitorId)
  overlayExpandedBounds = bounds
  overlayWindow.setBounds(anchorBoundsFrom(bounds))
  storeManager.patch({ settings: { overlayBounds: bounds } })
}

function anchorBoundsFrom(expanded: Electron.Rectangle) {
  return {
    x: expanded.x + expanded.width - ANCHOR_SIZE,
    y: expanded.y,
    width: ANCHOR_SIZE,
    height: ANCHOR_SIZE,
  }
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
    if (overlayExpandedBounds) {
      patch.overlayBounds = overlayExpandedBounds
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
  mainWindow.on('closed', () => {
    mainWindow = null
    app.quit()
  })

  loadApp(mainWindow)
}

function createOverlayWindow() {
  const settings = storeManager.get().settings
  overlayExpandedBounds = settings.overlayBounds ?? defaultOverlayBounds(settings.monitorId)

  // Start in anchor mode (small window)
  const bounds = anchorBoundsFrom(overlayExpandedBounds)

  overlayWindow = new BrowserWindow({
    ...bounds,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false,
    },
  })

  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
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

  ipcMain.handle('app:quit', () => {
    app.quit()
  })

  // --- Overlay mode switching (anchor vs expanded) ---

  ipcMain.on('overlay:set-mode', (_event, mode: string) => {
    if (!overlayWindow || overlayWindow.isDestroyed() || !overlayExpandedBounds) return

    if (mode === 'anchor') {
      overlayWindow.setBounds(anchorBoundsFrom(overlayExpandedBounds))
    } else {
      // expanded or settings — full overlay size
      overlayWindow.setBounds(overlayExpandedBounds)
    }
  })

  // --- Overlay drag ---

  let dragInterval: ReturnType<typeof setInterval> | null = null

  ipcMain.on('overlay:start-drag', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win || win.isDestroyed()) return

    const cursor = screen.getCursorScreenPoint()
    const [winX, winY] = win.getPosition()
    const offsetX = cursor.x - winX
    const offsetY = cursor.y - winY

    if (dragInterval) clearInterval(dragInterval)
    dragInterval = setInterval(() => {
      if (!win || win.isDestroyed()) { clearInterval(dragInterval!); dragInterval = null; return }
      const point = screen.getCursorScreenPoint()
      // Use setBounds with constant size to avoid Electron DPI rounding bug (#9477)
      // setPosition() internally calls setBounds(getSize()) which accumulates rounding errors
      win.setBounds({
        x: point.x - offsetX,
        y: point.y - offsetY,
        width: ANCHOR_SIZE,
        height: ANCHOR_SIZE,
      })
    }, 16)
  })

  ipcMain.on('overlay:stop-drag', (event) => {
    if (dragInterval) { clearInterval(dragInterval); dragInterval = null }
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win || win.isDestroyed()) return

    // Use getPosition() only — avoid getBounds() which returns DPI-drifted size
    const [anchorX, anchorY] = win.getPosition()
    if (overlayExpandedBounds) {
      overlayExpandedBounds = {
        ...overlayExpandedBounds,
        x: anchorX + ANCHOR_SIZE - overlayExpandedBounds.width,
        y: anchorY,
      }
    }
    // Force window back to exact anchor dimensions to correct any DPI drift
    win.setBounds(anchorBoundsFrom(overlayExpandedBounds!))
    scheduleSaveBounds()
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
