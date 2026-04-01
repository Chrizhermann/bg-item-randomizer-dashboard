import { app, BrowserWindow, globalShortcut, screen, ipcMain } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface Settings {
  keybinding: string
  monitorId: number
}

const DEFAULT_SETTINGS: Settings = { keybinding: 'F9', monitorId: 0 }

let mainWindow: BrowserWindow | null = null
let isVisible = false // starts hidden
let currentKeybinding = ''
let currentSettings: Settings = { ...DEFAULT_SETTINGS }

// --- Settings persistence (JSON file for pre-renderer startup) ---

function settingsPath(): string {
  const dir = app.getPath('userData')
  return join(dir, 'overlay-settings.json')
}

function readSettings(): Settings {
  try {
    const raw = readFileSync(settingsPath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<Settings>
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function writeSettings(settings: Settings): void {
  try {
    const dir = app.getPath('userData')
    mkdirSync(dir, { recursive: true })
    writeFileSync(settingsPath(), JSON.stringify(settings, null, 2))
  } catch {
    // Best effort
  }
}

// --- Monitor helpers ---

function getTargetDisplay(monitorId: number) {
  const displays = screen.getAllDisplays()
  return displays.find((d) => d.id === monitorId) ?? screen.getPrimaryDisplay()
}

function positionWindow(monitorId: number) {
  if (!mainWindow) return
  const display = getTargetDisplay(monitorId)
  const { x, y, width, height } = display.workArea
  mainWindow.setBounds({
    x: x + width - 400,
    y: y + 50,
    width: 380,
    height: height - 100,
  })
}

// --- Keybinding ---

function registerKeybinding(accelerator: string) {
  if (currentKeybinding) {
    globalShortcut.unregister(currentKeybinding)
  }
  const success = globalShortcut.register(accelerator, () => {
    if (!mainWindow) return
    if (isVisible) {
      mainWindow.hide()
    } else {
      mainWindow.show()
    }
    isVisible = !isVisible
  })
  if (success) {
    currentKeybinding = accelerator
  }
}

// --- Window creation ---

function createWindow() {
  const display = getTargetDisplay(currentSettings.monitorId)
  const { x, y, width, height } = display.workArea

  mainWindow = new BrowserWindow({
    width: 380,
    height: height - 100,
    x: x + width - 400,
    y: y + 50,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: true,
    show: false, // starts hidden
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  })

  mainWindow.setIgnoreMouseEvents(false)

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL + '?mode=overlay')
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'), {
      search: 'mode=overlay',
    })
  }
}

// --- IPC handlers ---

function setupIPC() {
  ipcMain.handle('update-keybinding', (_event, key: string) => {
    currentSettings.keybinding = key
    writeSettings(currentSettings)
    registerKeybinding(key)
  })

  ipcMain.handle('update-monitor', (_event, monitorId: number) => {
    currentSettings.monitorId = monitorId
    writeSettings(currentSettings)
    positionWindow(monitorId)
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
  currentSettings = readSettings()

  setupIPC()
  createWindow()
  registerKeybinding(currentSettings.keybinding)
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  app.quit()
})
