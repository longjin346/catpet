import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('catpet', {
  // Notify main process when mouse enters/leaves cat hitbox
  setCatHover: (isHovering: boolean) =>
    ipcRenderer.send('cat-hover', isHovering),

  // Open the settings window
  openSettings: () => ipcRenderer.send('open-settings'),
})
