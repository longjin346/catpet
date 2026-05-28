import { useEffect, useRef } from 'react'
import type { SlotRole } from '../utils/config'

interface Props {
  role:  SlotRole
  size?: number
}

type DrawFn = (ctx: CanvasRenderingContext2D, s: number) => void

// s = scale factor (size / 120)

function drawSideView(ctx: CanvasRenderingContext2D, s: number) {
  ctx.lineJoin = 'round'
  ctx.lineCap  = 'round'

  // Body
  ctx.beginPath()
  ctx.ellipse(74*s, 76*s, 34*s, 17*s, -0.08, 0, Math.PI * 2)
  ctx.fill(); ctx.stroke()

  // Head
  ctx.beginPath()
  ctx.arc(36*s, 60*s, 17*s, 0, Math.PI * 2)
  ctx.fill(); ctx.stroke()

  // Ear 1
  ctx.beginPath()
  ctx.moveTo(24*s, 47*s); ctx.lineTo(28*s, 33*s); ctx.lineTo(40*s, 46*s)
  ctx.closePath(); ctx.fill(); ctx.stroke()
  // Ear 2
  ctx.beginPath()
  ctx.moveTo(40*s, 46*s); ctx.lineTo(46*s, 33*s); ctx.lineTo(56*s, 45*s)
  ctx.closePath(); ctx.fill(); ctx.stroke()

  // Legs
  ctx.lineWidth = 2.5 * s
  for (const x of [53, 64, 78, 90]) {
    ctx.beginPath()
    ctx.moveTo(x*s, 91*s); ctx.lineTo((x + 2)*s, 108*s); ctx.stroke()
  }
  ctx.lineWidth = 1.8 * s

  // Tail
  ctx.beginPath()
  ctx.moveTo(106*s, 73*s)
  ctx.bezierCurveTo(120*s, 62*s, 122*s, 40*s, 106*s, 31*s)
  ctx.stroke()

  // Eye
  ctx.fillStyle = '#0d0d20'
  ctx.beginPath(); ctx.arc(30*s, 58*s, 3*s, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.beginPath(); ctx.arc(32*s, 56.5*s, 1.2*s, 0, Math.PI * 2); ctx.fill()
}

function drawFaceView(ctx: CanvasRenderingContext2D, s: number) {
  ctx.lineJoin = 'round'

  // Head
  ctx.beginPath()
  ctx.arc(60*s, 68*s, 38*s, 0, Math.PI * 2)
  ctx.fill(); ctx.stroke()

  // Ears
  ctx.beginPath()
  ctx.moveTo(24*s, 38*s); ctx.lineTo(32*s, 16*s); ctx.lineTo(50*s, 34*s)
  ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(70*s, 34*s); ctx.lineTo(88*s, 16*s); ctx.lineTo(96*s, 38*s)
  ctx.closePath(); ctx.fill(); ctx.stroke()

  // Eyes
  ctx.fillStyle = '#0d0d20'
  ctx.beginPath(); ctx.ellipse(44*s, 62*s, 8*s, 10*s, 0, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(76*s, 62*s, 8*s, 10*s, 0, 0, Math.PI * 2); ctx.fill()
  // Highlights
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.beginPath(); ctx.arc(47*s, 58*s, 2.5*s, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(79*s, 58*s, 2.5*s, 0, Math.PI * 2); ctx.fill()

  // Nose
  ctx.fillStyle = 'rgba(255,190,180,0.8)'
  ctx.beginPath()
  ctx.moveTo(60*s, 73*s); ctx.lineTo(55*s, 79*s); ctx.lineTo(65*s, 79*s)
  ctx.closePath(); ctx.fill()

  // Whiskers
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 0.9 * s
  for (const [x1, y1, x2, y2] of [
    [16,72,48,75], [14,79,48,79],
    [72,75,104,72], [72,79,106,79],
  ]) {
    ctx.beginPath(); ctx.moveTo(x1*s,y1*s); ctx.lineTo(x2*s,y2*s); ctx.stroke()
  }
}

function drawSleeping(ctx: CanvasRenderingContext2D, s: number) {
  ctx.lineJoin = 'round'

  // Curled body
  ctx.beginPath()
  ctx.ellipse(64*s, 76*s, 42*s, 26*s, 0, 0, Math.PI * 2)
  ctx.fill(); ctx.stroke()

  // Head resting on body
  ctx.beginPath()
  ctx.arc(36*s, 60*s, 17*s, 0, Math.PI * 2)
  ctx.fill(); ctx.stroke()

  // Ear
  ctx.beginPath()
  ctx.moveTo(24*s, 47*s); ctx.lineTo(28*s, 33*s); ctx.lineTo(40*s, 45*s)
  ctx.closePath(); ctx.fill(); ctx.stroke()

  // Closed eyes (arc curves)
  ctx.strokeStyle = '#0d0d20'
  ctx.lineWidth = 2.2 * s
  ctx.beginPath(); ctx.arc(29*s, 59*s, 5*s, Math.PI, 2*Math.PI); ctx.stroke()
  ctx.beginPath(); ctx.arc(43*s, 59*s, 4.5*s, Math.PI, 2*Math.PI); ctx.stroke()

  // Tail wrapped around body
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = 1.8 * s
  ctx.beginPath()
  ctx.moveTo(104*s, 68*s)
  ctx.bezierCurveTo(116*s, 74*s, 116*s, 94*s, 88*s, 98*s)
  ctx.bezierCurveTo(64*s, 102*s, 46*s, 92*s, 50*s, 76*s)
  ctx.stroke()

  // Zzz
  ctx.fillStyle = 'rgba(136,187,255,0.75)'
  ctx.font = `bold ${10*s}px sans-serif`
  ctx.fillText('z', 86*s, 36*s)
  ctx.font = `bold ${13*s}px sans-serif`
  ctx.fillText('Z', 96*s, 24*s)
}

function drawAction(ctx: CanvasRenderingContext2D, s: number) {
  ctx.lineJoin = 'round'
  ctx.lineCap  = 'round'

  // Stretched body (low, elongated)
  ctx.beginPath()
  ctx.ellipse(68*s, 64*s, 44*s, 15*s, -0.22, 0, Math.PI * 2)
  ctx.fill(); ctx.stroke()

  // Head angled downward
  ctx.beginPath()
  ctx.arc(26*s, 56*s, 15*s, 0, Math.PI * 2)
  ctx.fill(); ctx.stroke()

  // Ear
  ctx.beginPath()
  ctx.moveTo(16*s, 45*s); ctx.lineTo(20*s, 31*s); ctx.lineTo(32*s, 43*s)
  ctx.closePath(); ctx.fill(); ctx.stroke()

  // Front legs reaching forward
  ctx.lineWidth = 2.5 * s
  ctx.beginPath()
  ctx.moveTo(34*s, 71*s)
  ctx.bezierCurveTo(22*s, 82*s, 14*s, 90*s, 12*s, 104*s); ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(46*s, 73*s)
  ctx.bezierCurveTo(36*s, 82*s, 28*s, 90*s, 26*s, 104*s); ctx.stroke()

  // Rear legs pushing
  ctx.beginPath()
  ctx.moveTo(96*s, 68*s)
  ctx.bezierCurveTo(104*s, 78*s, 108*s, 88*s, 108*s, 104*s); ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(106*s, 60*s)
  ctx.bezierCurveTo(116*s, 70*s, 118*s, 82*s, 118*s, 104*s); ctx.stroke()
  ctx.lineWidth = 1.8 * s

  // Tail up
  ctx.beginPath()
  ctx.moveTo(110*s, 52*s)
  ctx.bezierCurveTo(120*s, 36*s, 116*s, 18*s, 100*s, 12*s); ctx.stroke()

  // Motion lines
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'
  ctx.lineWidth = 1 * s
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.moveTo((112 + i*3)*s, (74 + i*7)*s)
    ctx.lineTo((124 + i*2)*s, (72 + i*7)*s); ctx.stroke()
  }
}

function drawBackView(ctx: CanvasRenderingContext2D, s: number) {
  ctx.lineJoin = 'round'

  // Body (rear view — wider bottom)
  ctx.beginPath()
  ctx.ellipse(60*s, 74*s, 30*s, 24*s, 0, 0, Math.PI * 2)
  ctx.fill(); ctx.stroke()

  // Head (top of body, seen from behind)
  ctx.beginPath()
  ctx.arc(60*s, 46*s, 18*s, 0, Math.PI * 2)
  ctx.fill(); ctx.stroke()

  // Both ears visible from behind
  ctx.beginPath()
  ctx.moveTo(42*s, 32*s); ctx.lineTo(44*s, 18*s); ctx.lineTo(56*s, 30*s)
  ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(64*s, 30*s); ctx.lineTo(76*s, 18*s); ctx.lineTo(78*s, 32*s)
  ctx.closePath(); ctx.fill(); ctx.stroke()

  // Legs (back pair visible)
  ctx.lineWidth = 2.5 * s
  ctx.beginPath(); ctx.moveTo(42*s, 94*s); ctx.lineTo(38*s, 110*s); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(78*s, 94*s); ctx.lineTo(82*s, 110*s); ctx.stroke()
  ctx.lineWidth = 1.8 * s

  // Tail straight up from center
  ctx.beginPath()
  ctx.moveTo(60*s, 52*s)
  ctx.bezierCurveTo(56*s, 38*s, 58*s, 22*s, 62*s, 8*s); ctx.stroke()
}

function drawTexture(ctx: CanvasRenderingContext2D, s: number) {
  // Fur patch with tabby stripe pattern
  ctx.fillStyle = 'rgba(255,255,255,0.1)'
  ctx.beginPath()
  ctx.roundRect(12*s, 12*s, 96*s, 96*s, 8*s)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 1 * s
  ctx.stroke()

  // Tabby stripes
  ctx.strokeStyle = 'rgba(255,255,255,0.72)'
  ctx.lineWidth = 3 * s
  ctx.lineCap = 'round'
  for (const [x1, y1, x2, y2] of [
    [22, 26, 42, 38], [38, 18, 58, 30], [56, 22, 74, 34], [70, 18, 88, 32],
    [24, 50, 44, 58], [44, 54, 62, 62], [62, 48, 80, 58], [76, 52, 94, 62],
    [26, 74, 46, 82], [48, 78, 66, 86], [68, 72, 88, 82],
  ]) {
    ctx.beginPath()
    ctx.moveTo(x1*s, y1*s)
    ctx.bezierCurveTo((x1+5)*s, (y1+5)*s, (x2-5)*s, (y2-5)*s, x2*s, y2*s)
    ctx.stroke()
  }

  // Magnifier hint
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.lineWidth = 2 * s
  ctx.lineCap = 'round'
  ctx.beginPath(); ctx.arc(80*s, 34*s, 16*s, 0, Math.PI * 2); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(91*s, 45*s); ctx.lineTo(102*s, 58*s); ctx.stroke()
}

const DRAWINGS: Record<SlotRole, DrawFn> = {
  primary: drawSideView,
  face:    drawFaceView,
  sleep:   drawSleeping,
  action:  drawAction,
  back:    drawBackView,
  texture: drawTexture,
}

export default function CatGuide({ role, size = 120 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const s = size / 120
    ctx.clearRect(0, 0, size, size)
    ctx.save()

    // Dark background
    ctx.fillStyle = '#16163a'
    ctx.beginPath()
    ctx.roundRect(0, 0, size, size, 8)
    ctx.fill()

    // Guide border dashes
    ctx.setLineDash([4 * s, 4 * s])
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'
    ctx.lineWidth = 1
    ctx.strokeRect(4, 4, size - 8, size - 8)
    ctx.setLineDash([])

    // Cat drawing
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.fillStyle   = 'rgba(255,255,255,0.12)'
    ctx.lineWidth   = 1.8 * s

    DRAWINGS[role]?.(ctx, s)
    ctx.restore()
  }, [role, size])

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      style={{ display: 'block', borderRadius: 8, flexShrink: 0 }}
    />
  )
}
