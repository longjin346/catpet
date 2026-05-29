export {}

declare global {
  interface Window {
    catpet: {
      // Overlay click-through toggle
      setCatHover(isHovering: boolean): void
      // Window management
      openSettings(): void
      openPreferences(): void
      // Preferences sync
      notifyPrefsChanged(): void
      onPrefsChanged(callback: () => void): () => void
      // File operations
      openFileDialog(): Promise<string | null>
      readFile(filePath: string): Promise<string> // returns base64 data URL
      savePhoto(slot: string, dataUrl: string): Promise<void>
      loadPhotos(): Promise<Record<string, string>> // slot → data URL
      deletePhoto(slot: string): Promise<void>
      // Key-value store (electron-store)
      storeGet(key: string): Promise<unknown>
      storeSet(key: string, value: unknown): Promise<void>
      // First-launch
      isFirstLaunch(): Promise<boolean>
      // Cat lifecycle
      catReady(): void
      // Notifications from main to renderer
      onCatLoaded(callback: () => void): () => void
      // Hungry/feed cycle
      notifyHungry(isHungry: boolean): void
      onFeed(callback: () => void): () => void
      // Segment layers (id → PNG data URL)
      saveSegments(slot: string, layers: Array<{ id: string; dataUrl: string }>): Promise<void>
      loadSegments(slot: string): Promise<Record<string, string> | null>
      // Rig definition JSON
      saveRig(slot: string, rig: unknown): Promise<void>
      loadRig(slot: string): Promise<unknown | null>
    }
  }
}
