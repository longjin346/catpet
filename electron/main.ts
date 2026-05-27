import { app, BrowserWindow, ipcMain, screen } from 'electron'
import path from 'path'
import fs from 'fs'
import { setupTray } from './tray'

// Portable data path — stored next to the exe, not in %APPDATA%
const PORTABLE_DATA = app.isPackaged
  ? path.join(path.dirname(process.execPath), 'userdata')
  : path.join(app.getPath('userData'), 'catpet-dev')

// Override Electron's default data directories for portability
app.setPath('userData', PORTABLE_DATA)
app.setPath('appData', PORTABLE_DATA)

let overlayWin: BrowserWindow | null = null
let settingsWin: BrowserWindow | null = null

function createOverlayWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  overlayWin = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    resizable: false,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Fully click-through by default; renderer toggles on cat hover
  overlayWin.setIgnoreMouseEvents(true, { forward: true })

  overlayWin.setAlwaysOnTop(true, 'screen-saver')
  overlayWin.setVisibleOnAllWorkspaces(true)

  if (process.env.VITE_DEV_SERVER_URL) {
    overlayWin.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    overlayWin.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

function createSettingsWindow() {
  if (settingsWin) {
    settingsWin.focus()
    return
  }

  settingsWin = new BrowserWindow({
    width: 720,
    height: 600,
    title: 'CatPet Settings',
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const settingsUrl = process.env.VITE_DEV_SERVER_URL
    ? `${process.env.VITE_DEV_SERVER_URL}?view=settings`
    : `file://${path.join(__dirname, '../dist/index.html')}?view=settings`

  settingsWin.loadURL(settingsUrl)

  settingsWin.on('closed', () => {
    settingsWin = null
  })
}

// IPC: renderer tells us when mouse is over the cat sprite
ipcMain.on('cat-hover', (_event, isHovering: boolean) => {
  if (overlayWin) {
    overlayWin.setIgnoreMouseEvents(!isHovering, { forward: true })
  }
})

// IPC: open settings window from renderer or tray
ipcMain.on('open-settings', () => {
  createSettingsWindow()
})

app.whenReady().then(() => {
  // Ensure userdata directory exists
  if (!fs.existsSync(PORTABLE_DATA)) {
    fs.mkdirSync(PORTABLE_DATA, { recursive: true })
  }

  createOverlayWindow()
  setupTray(
    () => createSettingsWindow(),
    () => app.quit()
  )
})

app.on('window-all-closed', () => {
  // Keep app alive even if all windows close — lives in tray
})

app.on('activate', () => {
  if (!overlayWin) createOverlayWindow()
})
