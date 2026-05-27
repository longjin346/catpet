import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    catpet: {
      setCatHover: (isHovering: boolean) => void
      openSettings: () => void
    }
  }
}

export default function PetView() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    // Placeholder: draw a semi-transparent circle where the cat will live
    let frame = 0
    let animId: number

    function draw() {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const x = 200
      const y = canvas.height - 120
      const bob = Math.sin(frame * 0.05) * 2

      ctx.beginPath()
      ctx.arc(x, y + bob, 40, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,165,0,0.6)'
      ctx.fill()

      // Simple ears
      ctx.beginPath()
      ctx.moveTo(x - 20, y + bob - 30)
      ctx.lineTo(x - 35, y + bob - 55)
      ctx.lineTo(x - 5, y + bob - 35)
      ctx.fillStyle = 'rgba(255,140,0,0.7)'
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(x + 20, y + bob - 30)
      ctx.lineTo(x + 35, y + bob - 55)
      ctx.lineTo(x + 5, y + bob - 35)
      ctx.fill()

      frame++
      animId = requestAnimationFrame(draw)
    }

    draw()

    // Hit detection: toggle click-through based on mouse over the cat circle
    function onMouseMove(e: MouseEvent) {
      if (!canvas) return
      const x = 200
      const y = canvas.height - 120
      const dx = e.clientX - x
      const dy = e.clientY - y
      const isOver = Math.sqrt(dx * dx + dy * dy) < 45

      if (window.catpet) {
        window.catpet.setCatHover(isOver)
      }
    }

    window.addEventListener('mousemove', onMouseMove)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('mousemove', onMouseMove)
    }
  }, [])

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
