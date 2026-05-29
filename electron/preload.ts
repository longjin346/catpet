import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('catpet', {
  // Overlay click-through
  setCatHover: (isHovering: boolean) =>
    ipcRenderer.send('cat-hover', isHovering),

  // Window management
  openSettings:     () => ipcRenderer.send('open-settings'),
  openPreferences:  () => ipcRenderer.send('open-preferences'),

  // Preferences change notification
  notifyPrefsChanged: () => ipcRenderer.send('prefs:changed'),
  onPrefsChanged: (callback: () => void): (() => void) => {
    const handler = () => callback()
    ipcRenderer.on('prefs:changed', handler)
    return () => ipcRenderer.removeListener('prefs:changed', handler)
  },

  // File operations
  openFileDialog: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:open-file'),

  readFile: (filePath: string): Promise<string> =>
    ipcRenderer.invoke('file:read', filePath),

  savePhoto: (slot: string, dataUrl: string): Promise<void> =>
    ipcRenderer.invoke('photo:save', slot, dataUrl),

  loadPhotos: (): Promise<Record<string, string>> =>
    ipcRenderer.invoke('photo:load-all'),

  deletePhoto: (slot: string): Promise<void> =>
    ipcRenderer.invoke('photo:delete', slot),

  // Key-value store
  storeGet: (key: string): Promise<unknown> =>
    ipcRenderer.invoke('store:get', key),

  storeSet: (key: string, value: unknown): Promise<void> =>
    ipcRenderer.invoke('store:set', key, value),

  // First-launch
  isFirstLaunch: (): Promise<boolean> =>
    ipcRenderer.invoke('app:is-first-launch'),

  // Signal to main that the cat is configured and ready to show
  catReady: () => ipcRenderer.send('cat:ready'),

  // Listen for overlay to reload cat data
  onCatLoaded: (callback: () => void): (() => void) => {
    const handler = () => callback()
    ipcRenderer.on('cat:loaded', handler)
    return () => ipcRenderer.removeListener('cat:loaded', handler)
  },

  // Hungry/feed cycle
  notifyHungry: (isHungry: boolean) => ipcRenderer.send('cat:hungry', isHungry),
  onFeed: (callback: () => void): (() => void) => {
    const handler = () => callback()
    ipcRenderer.on('cat:feed', handler)
    return () => ipcRenderer.removeListener('cat:feed', handler)
  },

  // Segment layers — PNG files per layer
  saveSegments: (slot: string, layers: Array<{ id: string; dataUrl: string }>): Promise<void> =>
    ipcRenderer.invoke('segments:save', slot, layers),

  loadSegments: (slot: string): Promise<Record<string, string> | null> =>
    ipcRenderer.invoke('segments:load', slot),

  // Rig definition — JSON with joints + layer anchors
  saveRig: (slot: string, rig: unknown): Promise<void> =>
    ipcRenderer.invoke('rig:save', slot, rig),

  loadRig: (slot: string): Promise<unknown | null> =>
    ipcRenderer.invoke('rig:load', slot),
})
