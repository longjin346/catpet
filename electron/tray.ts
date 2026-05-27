import { Tray, Menu, nativeImage, app } from 'electron'
import path from 'path'

let tray: Tray | null = null

export function setupTray(
  onSettings:     () => void,
  onPreferences:  () => void,
  onQuit:         () => void,
) {
  // Use a bundled icon; fall back to an empty 16x16 image in dev
  const iconPath = path.join(__dirname, '../build/icon.png')
  let icon: Electron.NativeImage

  try {
    icon = nativeImage.createFromPath(iconPath)
    if (icon.isEmpty()) {
      icon = nativeImage.createEmpty()
    }
  } catch {
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)
  tray.setToolTip('CatPet')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Upload Photos',
      click: onSettings,
    },
    {
      label: 'Preferences',
      click: onPreferences,
    },
    { type: 'separator' },
    {
      label: 'Quit CatPet',
      click: onQuit,
    },
  ])

  tray.setContextMenu(contextMenu)

  // Left-click also opens settings
  tray.on('click', onSettings)
}

export function destroyTray() {
  tray?.destroy()
  tray = null
}
