import { removeBackground as imglyRemoveBg } from '@imgly/background-removal'

export type ProgressCallback = (fraction: number) => void

export async function removeBackground(
  base64DataUrl: string,
  onProgress?: ProgressCallback
): Promise<string> {
  // Convert data URL → Blob via fetch (works in browser/Electron renderer)
  const res = await fetch(base64DataUrl)
  const inputBlob = await res.blob()

  const outputBlob = await imglyRemoveBg(inputBlob, {
    model: 'isnet_quint8', // fastest quantized model; switch to 'isnet' for higher quality
    output: { format: 'image/png', quality: 1 },
    progress: onProgress
      ? (_key: string, current: number, total: number) => {
          if (total > 0) onProgress(current / total)
        }
      : undefined,
  })

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read output blob'))
    reader.readAsDataURL(outputBlob)
  })
}
