import { useEffect, useRef, useState, useCallback } from 'react'

interface CatPhoto {
  role: string
  dataUrl: string
}

export default function PetView() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [primaryPhoto, setPrimaryPhoto] = useState<CatPhoto | null>(null)
  const posRef = useRef({ x: 200, y: 0 })
  const animRef = useRef(0)

  const loadPhotos = useCallback(async () => {
    const photos = await window.catpet.loadPhotos()
    if (photos.primary) {
      setPrimaryPhoto({ role: 'primary', dataUrl: photos.primary })
    }
  }, [])

  useEffect(() => {
    loadPhotos()
    // Re-load when main signals a new cat was configured
    const unsubscribe = window.catpet.onCatLoaded(loadPhotos)
    return unsubscribe
  }, [loadPhotos])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    let catImg: HTMLImageElement | null = null

    if (primaryPhoto) {
      catImg = new Image()
      catImg.src = primaryPhoto.dataUrl
    }

    const CAT_SCALE = 150 // target height in px
    let frame = 0

    function draw() {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const { x, y } = posRef.current
      const bob = Math.sin(frame * 0.04) * 1.5 // subtle breathing: ±1.5px

      if (catImg && catImg.complete && catImg.naturalWidth > 0) {
        // Scale to target height while keeping aspect ratio
        const aspect = catImg.naturalWidth / catImg.naturalHeight
        const drawH = CAT_SCALE
        const drawW = drawH * aspect
        const drawX = x - drawW / 2
        const drawY = canvas.height - drawH + y + bob

        // Soft drop shadow under the cat
        ctx.shadowColor = 'rgba(0,0,0,0.18)'
        ctx.shadowBlur = 10
        ctx.shadowOffsetY = 6
        ctx.drawImage(catImg, drawX, drawY, drawW, drawH)
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
        ctx.shadowOffsetY = 0
      } else {
        // Placeholder circle while photo loads
        const circleY = canvas.height - 80 + bob
        ctx.beginPath()
        ctx.arc(x, circleY, 40, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(99,102,241,0.25)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(99,102,241,0.5)'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.fillStyle = 'rgba(99,102,241,0.7)'
        ctx.font = '12px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Loading…', x, circleY + 5)
      }

      frame++
      animRef.current = requestAnimationFrame(draw)
    }

    draw()

    // Hit detection — toggle click-through when mouse is over the cat
    function onMouseMove(e: MouseEvent) {
      if (!canvas) return
      const { x } = posRef.current
      const catH = CAT_SCALE

      const catImg2 = catImg
      if (catImg2 && catImg2.complete && catImg2.naturalWidth > 0) {
        const aspect = catImg2.naturalWidth / catImg2.naturalHeight
        const drawW = catH * aspect
        const drawY = canvas.height - catH
        const inBox =
          e.clientX >= x - drawW / 2 &&
          e.clientX <= x + drawW / 2 &&
          e.clientY >= drawY &&
          e.clientY <= drawY + catH
        window.catpet.setCatHover(inBox)
      } else {
        // Placeholder circle
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
  }, [primaryPhoto])

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
