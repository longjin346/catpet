import { Tray, Menu, nativeImage, MenuItemConstructorOptions } from 'electron'
import path from 'path'

let tray: Tray | null = null
let overlayVisible = true
let catName = 'CatPet'

// Stored callbacks so the menu can be rebuilt when toggle state changes
let _onSettings:    () => void
let _onPreferences: () => void
let _onToggle:      () => void
let _onQuit:        () => void

function rebuildMenu() {
  if (!tray) return
  const template: MenuItemConstructorOptions[] = [
    {
      label: overlayVisible ? 'Hide Cat' : 'Show Cat',
      click: _onToggle,
    },
    { type: 'separator' },
    { label: 'Upload Photos',  click: _onSettings    },
    { label: 'Preferences',    click: _onPreferences },
    { type: 'separator' },
    { label: 'Quit CatPet',    click: _onQuit        },
  ]
  tray.setContextMenu(Menu.buildFromTemplate(template))
}

export function setupTray(
  onSettings:    () => void,
  onPreferences: () => void,
  onToggle:      () => void,
  onQuit:        () => void,
): void {
  _onSettings    = onSettings
  _onPreferences = onPreferences
  _onToggle      = onToggle
  _onQuit        = onQuit

  const iconPath = path.join(__dirname, '../build/icon.png')
  let icon: Electron.NativeImage
  try {
    icon = nativeImage.createFromPath(iconPath)
    if (icon.isEmpty()) icon = nativeImage.createEmpty()
  } catch {
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)
  tray.setToolTip(catName)
  rebuildMenu()

  // Left-click toggles the overlay
  tray.on('click', onToggle)
}

export function updateTrayTooltip(name: string): void {
  catName = name ? `CatPet — ${name}` : 'CatPet'
  tray?.setToolTip(catName)
}

export function updateTrayToggle(visible: boolean): void {
  overlayVisible = visible
  rebuildMenu()
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
