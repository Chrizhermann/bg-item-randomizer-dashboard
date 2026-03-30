import { app, BrowserWindow, globalShortcut, screen } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let mainWindow: BrowserWindow | null = null
let isVisible = true

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width: 380,
    height: height - 100,
    x: width - 400,
    y: 50,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: true,
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

app.whenReady().then(() => {
  createWindow()

  globalShortcut.register('F9', () => {
    if (!mainWindow) return
    if (isVisible) {
      mainWindow.hide()
    } else {
      mainWindow.show()
    }
    isVisible = !isVisible
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  app.quit()
})
