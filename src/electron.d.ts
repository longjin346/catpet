export {}

declare global {
  interface Window {
    catpet: {
      // Overlay click-through toggle
      setCatHover(isHovering: boolean): void
      // Window management
      openSettings(): void
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
    }
  }
}
