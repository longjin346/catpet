import type { ValidationResult, ValidationIssue } from '../utils/config'

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = dataUrl
  })
}

function getImageData(img: HTMLImageElement): ImageData {
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 400 / Math.max(img.naturalWidth, img.naturalHeight))
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(img.naturalHeight * scale)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

function avgBrightness(imageData: ImageData): number {
  const { data } = imageData
  let sum = 0
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  return sum / (data.length / 4)
}

// Simple sharpness: mean absolute gradient
function sharpnessScore(imageData: ImageData): number {
  const { data, width, height } = imageData
  let sum = 0
  let count = 0
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const i = (y * width + x) * 4
      const right = (y * width + x + 1) * 4
      const below = ((y + 1) * width + x) * 4
      const gx = Math.abs(data[i] - data[right])
      const gy = Math.abs(data[i] - data[below])
      sum += Math.sqrt(gx * gx + gy * gy)
      count++
    }
  }
  return count > 0 ? sum / count : 0
}

export async function validatePhoto(dataUrl: string): Promise<ValidationResult> {
  const issues: ValidationIssue[] = []

  let img: HTMLImageElement
  try {
    img = await loadImageFromDataUrl(dataUrl)
  } catch {
    return { passed: false, issues: [{ type: 'no_cat', message: "Couldn't load this image. Try a different file.", severity: 'error' }] }
  }

  // Size check
  if (img.naturalWidth < 300 || img.naturalHeight < 300) {
    issues.push({
      type: 'too_small',
      message: `Image is ${img.naturalWidth}×${img.naturalHeight}px. Photos at least 500×500px work best.`,
      severity: 'warning',
    })
  }

  const imageData = getImageData(img)

  // Brightness check
  const brightness = avgBrightness(imageData)
  if (brightness < 45) {
    issues.push({
      type: 'too_dark',
      message: 'This photo is quite dark. A brighter image will make your pet look crisper.',
      severity: 'warning',
    })
  }

  // Blur check
  const sharpness = sharpnessScore(imageData)
  if (sharpness < 6) {
    issues.push({
      type: 'too_blurry',
      message: 'This photo looks blurry. A sharper image will give your pet more detail.',
      severity: 'warning',
    })
  }

  const hasError = issues.some(i => i.severity === 'error')
  return { passed: !hasError, issues }
}
