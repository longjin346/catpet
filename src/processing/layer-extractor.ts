export interface RegionRect {
  x1: number
  y1: number
  x2: number
  y2: number
}

/** smoothstep — removes the abrupt kink at the feather boundary */
function ss(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t
  return c * c * (3 - 2 * c)
}

/**
 * Returns 0–1 mask value for pixel (px, py) given a core rect and feather radius.
 * Full opacity inside the core, smooth falloff in the feather zone, 0 outside.
 */
function maskAt(px: number, py: number, r: RegionRect, feather: number): number {
  return (
    ss((px - (r.x1 - feather)) / feather) *
    ss(((r.x2 + feather) - px) / feather) *
    ss((py - (r.y1 - feather)) / feather) *
    ss(((r.y2 + feather) - py) / feather)
  )
}

/**
 * Copies srcCtx.canvas, applies a soft rectangular mask, and returns a PNG
 * data URL.  Only the non-transparent source pixels within the region (plus
 * its feather zone) are kept; everything else becomes transparent.
 */
export function extractLayer(
  srcCtx: CanvasRenderingContext2D,
  region: RegionRect,
  feather: number,
): string {
  const W = srcCtx.canvas.width
  const H = srcCtx.canvas.height

  const layerCanvas = document.createElement('canvas')
  layerCanvas.width  = W
  layerCanvas.height = H
  const ctx = layerCanvas.getContext('2d')!

  ctx.drawImage(srcCtx.canvas, 0, 0)
  const imgData = ctx.getImageData(0, 0, W, H)
  const { data } = imgData

  // Only iterate over the feather-expanded region for speed
  const x0 = Math.max(0, Math.floor(region.x1 - feather))
  const x1 = Math.min(W - 1, Math.ceil(region.x2 + feather))
  const y0 = Math.max(0, Math.floor(region.y1 - feather))
  const y1 = Math.min(H - 1, Math.ceil(region.y2 + feather))

  // Zero out everything outside the expanded region
  for (let y = 0; y < H; y++) {
    if (y >= y0 && y <= y1) continue
    for (let x = 0; x < W; x++) {
      data[(y * W + x) * 4 + 3] = 0
    }
  }
  for (let y = y0; y <= y1; y++) {
    for (let x = 0; x < W; x++) {
      if (x >= x0 && x <= x1) continue
      data[(y * W + x) * 4 + 3] = 0
    }
  }

  // Apply smooth mask inside the expanded region
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const idx = (y * W + x) * 4
      if (data[idx + 3] === 0) continue
      const mv = maskAt(x, y, region, feather)
      data[idx + 3] = Math.round(data[idx + 3] * mv)
    }
  }

  ctx.putImageData(imgData, 0, 0)
  return layerCanvas.toDataURL('image/png')
}
