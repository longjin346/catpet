import { app, BrowserWindow, ipcMain, screen, dialog, session, globalShortcut } from 'electron'
import path from 'path'
import fs from 'fs'
import Store from 'electron-store'
import { setupTray, updateTrayTooltip, updateTrayToggle, updateTrayHungry } from './tray'

// Portable data path — next to exe when packaged, dev path otherwise
const PORTABLE_DATA = app.isPackaged
  ? path.join(path.dirname(process.execPath), 'userdata')
  : path.join(app.getPath('userData'), 'catpet-dev')

app.setPath('userData', PORTABLE_DATA)
app.setPath('appData', PORTABLE_DATA)

const store = new Store()

let overlayWin:     BrowserWindow | null = null
let settingsWin:    BrowserWindow | null = null
let prefsWin:       BrowserWindow | null = null
let onboardingWin:  BrowserWindow | null = null
let overlayShown    = false

function isFirstLaunch(): boolean {
  return !fs.existsSync(path.join(PORTABLE_DATA, 'cat.json'))
}

function showOverlay(): void {
  if (!overlayWin) return
  overlayWin.show()
  overlayShown = true
  updateTrayToggle(true)
}

function toggleOverlay(): void {
  if (!overlayWin) return
  if (overlayShown) {
    overlayWin.hide()
    overlayShown = false
    updateTrayToggle(false)
  } else {
    overlayWin.show()
    overlayShown = true
    updateTrayToggle(true)
  }
}

function refreshTrayName(): void {
  const config = store.get('catConfig') as { name?: string } | undefined
  if (config?.name) updateTrayTooltip(config.name)
}

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
    show: false, // hidden until a cat is loaded
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  overlayWin.setIgnoreMouseEvents(true, { forward: true })
  overlayWin.setAlwaysOnTop(true, 'screen-saver')
  overlayWin.setVisibleOnAllWorkspaces(true)

  const url = process.env.VITE_DEV_SERVER_URL
  if (url) {
    overlayWin.loadURL(url)
  } else {
    overlayWin.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

function createOnboardingWindow() {
  if (onboardingWin) {
    onboardingWin.focus()
    return
  }

  onboardingWin = new BrowserWindow({
    width: 760,
    height: 620,
    title: 'CatPet — Welcome',
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const base = process.env.VITE_DEV_SERVER_URL ?? `file://${path.join(__dirname, '../dist/index.html')}`
  onboardingWin.loadURL(`${base}?view=onboarding`)

  onboardingWin.on('closed', () => {
    onboardingWin = null
  })
}

function createSettingsWindow() {
  if (settingsWin) {
    settingsWin.focus()
    return
  }

  settingsWin = new BrowserWindow({
    width: 820,
    height: 700,
    title: 'CatPet — Upload Photos',
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const base = process.env.VITE_DEV_SERVER_URL ?? `file://${path.join(__dirname, '../dist/index.html')}`
  settingsWin.loadURL(`${base}?view=settings`)

  settingsWin.on('closed', () => {
    settingsWin = null
  })
}

function createPreferencesWindow() {
  if (prefsWin) {
    prefsWin.focus()
    return
  }

  prefsWin = new BrowserWindow({
    width: 480,
    height: 660,
    title: 'CatPet — Preferences',
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const base = process.env.VITE_DEV_SERVER_URL ?? `file://${path.join(__dirname, '../dist/index.html')}`
  prefsWin.loadURL(`${base}?view=preferences`)

  prefsWin.on('closed', () => {
    prefsWin = null
  })
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.on('cat-hover', (_e, isHovering: boolean) => {
  overlayWin?.setIgnoreMouseEvents(!isHovering, { forward: true })
})

ipcMain.on('open-settings',     () => createSettingsWindow())
ipcMain.on('open-preferences',  () => createPreferencesWindow())
ipcMain.on('cat:hungry', (_e, isHungry: boolean) => updateTrayHungry(isHungry))

ipcMain.on('prefs:changed', () => {
  overlayWin?.webContents.send('prefs:changed')
})

ipcMain.handle('app:is-first-launch', () => isFirstLaunch())

ipcMain.handle('dialog:open-file', async () => {
  const win = settingsWin ?? overlayWin
  const result = await dialog.showOpenDialog(win!, {
    title: 'Choose a cat photo',
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'heic'] }],
    properties: ['openFile'],
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('file:read', (_e, filePath: string) => {
  const data = fs.readFileSync(filePath)
  const ext = path.extname(filePath).toLowerCase().slice(1)
  const mime = ext === 'png' ? 'image/png'
    : ext === 'webp' ? 'image/webp'
    : 'image/jpeg'
  return `data:${mime};base64,${data.toString('base64')}`
})

ipcMain.handle('photo:save', (_e, slot: string, dataUrl: string) => {
  const photosDir = path.join(PORTABLE_DATA, 'photos')
  if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true })
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
  fs.writeFileSync(path.join(photosDir, `${slot}.png`), Buffer.from(base64, 'base64'))
})

ipcMain.handle('photo:load-all', () => {
  const photosDir = path.join(PORTABLE_DATA, 'photos')
  const result: Record<string, string> = {}
  const roles = ['primary', 'face', 'sleep', 'action', 'back', 'texture']
  for (const role of roles) {
    const p = path.join(photosDir, `${role}.png`)
    if (fs.existsSync(p)) {
      result[role] = `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`
    }
  }
  return result
})

ipcMain.handle('photo:delete', (_e, slot: string) => {
  const p = path.join(PORTABLE_DATA, 'photos', `${slot}.png`)
  if (fs.existsSync(p)) fs.unlinkSync(p)
})

ipcMain.handle('store:get', (_e, key: string) => store.get(key))
ipcMain.handle('store:set', (_e, key: string, value: unknown) => { store.set(key, value) })

ipcMain.handle('segments:save', (_e, slot: string, layers: Array<{ id: string; dataUrl: string }>) => {
  const dir = path.join(PORTABLE_DATA, 'segments', slot)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  for (const layer of layers) {
    const base64 = layer.dataUrl.replace(/^data:image\/\w+;base64,/, '')
    fs.writeFileSync(path.join(dir, `${layer.id}.png`), Buffer.from(base64, 'base64'))
  }
})

ipcMain.handle('segments:load', (_e, slot: string) => {
  const dir = path.join(PORTABLE_DATA, 'segments', slot)
  if (!fs.existsSync(dir)) return null
  const result: Record<string, string> = {}
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'))
  if (files.length === 0) return null
  for (const file of files) {
    const id = path.basename(file, '.png')
    result[id] = `data:image/png;base64,${fs.readFileSync(path.join(dir, file)).toString('base64')}`
  }
  return result
})

ipcMain.handle('rig:save', (_e, slot: string, rig: unknown) => {
  const dir = path.join(PORTABLE_DATA, 'rig')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${slot}.json`), JSON.stringify(rig, null, 2))
})

ipcMain.handle('rig:load', (_e, slot: string) => {
  const p = path.join(PORTABLE_DATA, 'rig', `${slot}.json`)
  if (!fs.existsSync(p)) return null
  return JSON.parse(fs.readFileSync(p, 'utf8'))
})

ipcMain.on('cat:ready', () => {
  // Save cat.json marker so next launch skips onboarding
  if (!fs.existsSync(PORTABLE_DATA)) fs.mkdirSync(PORTABLE_DATA, { recursive: true })
  const configPath = path.join(PORTABLE_DATA, 'cat.json')
  if (!fs.existsSync(configPath)) fs.writeFileSync(configPath, '{}')

  // Show overlay and notify it to load the cat
  showOverlay()
  overlayWin?.webContents.send('cat:loaded')

  // Update tray tooltip with cat name
  refreshTrayName()

  // Close whichever upload window is open
  onboardingWin?.close()
  settingsWin?.close()
})

// ─── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  if (!fs.existsSync(PORTABLE_DATA)) fs.mkdirSync(PORTABLE_DATA, { recursive: true })

  // Required for SharedArrayBuffer used by ONNX WASM worker threads.
  // The dev server sets these via vite.config.ts; production needs them here.
  session.defaultSession.webRequest.onHeadersReceived((_details, callback) => {
    callback({
      responseHeaders: {
        ..._details.responseHeaders,
        'Cross-Origin-Opener-Policy':   ['same-origin'],
        'Cross-Origin-Embedder-Policy': ['require-corp'],
      },
    })
  })

  createOverlayWindow()

  if (isFirstLaunch()) {
    // First launch: guided onboarding wizard
    createOnboardingWindow()
  } else {
    // Returning user: show overlay with existing cat
    showOverlay()
  }

  setupTray(
    () => createSettingsWindow(),
    () => createPreferencesWindow(),
    () => toggleOverlay(),
    () => overlayWin?.webContents.send('cat:feed'),
    () => app.quit(),
  )

  // Set cat name in tray tooltip for returning users
  if (!isFirstLaunch()) refreshTrayName()

  // Global keyboard shortcuts
  globalShortcut.register('CommandOrControl+Shift+P', () => createSettingsWindow())
  globalShortcut.register('CommandOrControl+Shift+S', () => createPreferencesWindow())
  globalShortcut.register('CommandOrControl+Shift+H', () => toggleOverlay())
  globalShortcut.register('CommandOrControl+Shift+Q', () => app.quit())
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  // Keep alive in tray — don't quit when windows close
})

app.on('activate', () => {
  if (!overlayWin) createOverlayWindow()
})
