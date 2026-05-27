import { useEffect, useRef, useState, useCallback } from 'react'
import { LAYER_Z_INDEX, type LayerId, type RigDefinition } from '../utils/config'

interface SegmentImage {
  id: LayerId
  img: HTMLImageElement
  zIndex: number
}

export default function PetView() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [primaryDataUrl, setPrimaryDataUrl] = useState<string | null>(null)
  const [segments, setSegments] = useState<SegmentImage[]>([])
  const posRef = useRef({ x: 200, y: 0 })
  const animRef = useRef(0)

  const loadCatData = useCallback(async () => {
    const photos = await window.catpet.loadPhotos()
    if (photos.primary) setPrimaryDataUrl(photos.primary)

    // Try to load segments; fall back silently if none saved yet
    const rawSegments = await window.catpet.loadSegments('primary')
    const rawRig = await window.catpet.loadRig('primary') as RigDefinition | null

    if (rawSegments && rawRig) {
      const layerIds = Object.keys(rawSegments) as LayerId[]
      const imgs: SegmentImage[] = await Promise.all(
        layerIds.map(id => new Promise<SegmentImage>(resolve => {
          const img = new Image()
          img.onload = () => resolve({ id, img, zIndex: LAYER_Z_INDEX[id] ?? 0 })
          img.onerror  = () => resolve({ id, img, zIndex: LAYER_Z_INDEX[id] ?? 0 })
          img.src = rawSegments[id]
        }))
      )
      imgs.sort((a, b) => a.zIndex - b.zIndex)
      setSegments(imgs)
    }
  }, [])

  useEffect(() => {
    loadCatData()
    const unsubscribe = window.catpet.onCatLoaded(loadCatData)
    return unsubscribe
  }, [loadCatData])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight

    // Flat fallback image
    let flatImg: HTMLImageElement | null = null
    if (primaryDataUrl && segments.length === 0) {
      flatImg = new Image()
      flatImg.src = primaryDataUrl
    }

    const CAT_SCALE = 150
    let frame = 0

    // Compute draw geometry from a source image's natural dimensions
    function geometry(naturalW: number, naturalH: number) {
      const aspect = naturalW / naturalH
      const drawH  = CAT_SCALE
      const drawW  = drawH * aspect
      const bob    = Math.sin(frame * 0.04) * 1.5
      const drawX  = posRef.current.x - drawW / 2
      const drawY  = canvas!.height - drawH + posRef.current.y + bob
      return { drawX, drawY, drawW, drawH }
    }

    function draw() {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (segments.length > 0) {
        // Use the first loaded segment to establish geometry
        const ref = segments.find(s => s.img.complete && s.img.naturalWidth > 0)
        if (ref) {
          const { drawX, drawY, drawW, drawH } = geometry(ref.img.naturalWidth, ref.img.naturalHeight)
          ctx.shadowColor   = 'rgba(0,0,0,0.18)'
          ctx.shadowBlur    = 10
          ctx.shadowOffsetY = 6
          for (const seg of segments) {
            if (seg.img.complete && seg.img.naturalWidth > 0) {
              ctx.drawImage(seg.img, drawX, drawY, drawW, drawH)
            }
          }
          ctx.shadowColor   = 'transparent'
          ctx.shadowBlur    = 0
          ctx.shadowOffsetY = 0
        }
      } else if (flatImg && flatImg.complete && flatImg.naturalWidth > 0) {
        const { drawX, drawY, drawW, drawH } = geometry(flatImg.naturalWidth, flatImg.naturalHeight)
        ctx.shadowColor   = 'rgba(0,0,0,0.18)'
        ctx.shadowBlur    = 10
        ctx.shadowOffsetY = 6
        ctx.drawImage(flatImg, drawX, drawY, drawW, drawH)
        ctx.shadowColor   = 'transparent'
        ctx.shadowBlur    = 0
        ctx.shadowOffsetY = 0
      } else {
        // Placeholder while loading
        const bob      = Math.sin(frame * 0.04) * 1.5
        const circleY  = canvas.height - 80 + bob
        ctx.beginPath()
        ctx.arc(posRef.current.x, circleY, 40, 0, Math.PI * 2)
        ctx.fillStyle   = 'rgba(99,102,241,0.25)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(99,102,241,0.5)'
        ctx.lineWidth   = 2
        ctx.stroke()
        ctx.fillStyle  = 'rgba(99,102,241,0.7)'
        ctx.font       = '12px sans-serif'
        ctx.textAlign  = 'center'
        ctx.fillText('Loading…', posRef.current.x, circleY + 5)
      }

      frame++
      animRef.current = requestAnimationFrame(draw)
    }

    draw()

    function onMouseMove(e: MouseEvent) {
      if (!canvas) return
      const { x } = posRef.current
      const catH = CAT_SCALE

      // Use the first available image (segment or flat) for hit-box geometry
      const refImg = segments.length > 0
        ? segments.find(s => s.img.complete && s.img.naturalWidth > 0)?.img
        : (flatImg && flatImg.complete ? flatImg : null)

      if (refImg && refImg.naturalWidth > 0) {
        const drawW = catH * (refImg.naturalWidth / refImg.naturalHeight)
        const drawY = canvas.height - catH
        const inBox =
          e.clientX >= x - drawW / 2 &&
          e.clientX <= x + drawW / 2 &&
          e.clientY >= drawY &&
          e.clientY <= drawY + catH
        window.catpet.setCatHover(inBox)
      } else {
        const circleY = canvas.height - 80
        const dx = e.clientX - x
        const dy = e.clientY - circleY
        window.catpet.setCatHover(Math.sqrt(dx * dx + dy * dy) < 45)
      }
    }

    window.addEventListener('mousemove', onMouseMove)

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('mousemove', onMouseMove)
    }
  }, [primaryDataUrl, segments])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        background: 'transparent',
      }}
    />
  )
}
