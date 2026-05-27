export interface BBox {
  minX: number
  maxX: number
  minY: number
  maxY: number
  w: number
  h: number
}

export interface SilhouetteResult {
  bbox: BBox
  /**
   * Which side the cat's head is on.
   * Detected by finding which horizontal end has the topmost pixel — cats'
   * ears are typically the highest point in a side-view photo.
   */
  headSide: 'left' | 'right'
}

const ALPHA_THRESHOLD = 20

export function analyzeSilhouette(imageData: ImageData): SilhouetteResult {
  const { data, width, height } = imageData

  let minX = width, maxX = 0, minY = height, maxY = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > ALPHA_THRESHOLD) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  // Guard: empty image
  if (minX >= maxX || minY >= maxY) {
    return {
      bbox: { minX: 0, maxX: width, minY: 0, maxY: height, w: width, h: height },
      headSide: 'right',
    }
  }

  const bbox: BBox = { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY }

  // Head-side detection: compare topmost pixel in left 35% vs right 35%.
  // The end with the lower Y (higher on screen) is the head — ears/head are
  // typically the highest point of a side-view cat.
  const leftEnd  = Math.floor(minX + bbox.w * 0.35)
  const rightStart = Math.ceil(maxX - bbox.w * 0.35)
  let leftTopY = maxY
  let rightTopY = maxY

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (data[(y * width + x) * 4 + 3] > ALPHA_THRESHOLD) {
        if (x <= leftEnd  && y < leftTopY)  leftTopY  = y
        if (x >= rightStart && y < rightTopY) rightTopY = y
      }
    }
  }

  return { bbox, headSide: leftTopY <= rightTopY ? 'left' : 'right' }
}
