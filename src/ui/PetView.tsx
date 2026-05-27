import { useEffect, useRef, useCallback } from 'react'
import { Application, ImageSource, Sprite, Texture } from 'pixi.js'
import { createActor } from 'xstate'
import { PuppetRig } from '../sprites/PuppetRig'
import { petMachine } from '../core/PetFSM'
import type { RigDefinition } from '../utils/config'

const CAT_X_START = 200
const CAT_HEIGHT  = 150
const BOTTOM_PAD  = 20

// px/s of sudden mouse movement that triggers a startle
const STARTLE_SPEED = 900

export default function PetView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef       = useRef<Application | null>(null)
  const rigRef       = useRef<PuppetRig | null>(null)
  const flatRef      = useRef<{ sprite: Sprite; basePivotY: number } | null>(null)
  const actorRef     = useRef<ReturnType<typeof createActor<typeof petMachine>> | null>(null)

  const clearScene = useCallback(() => {
    rigRef.current?.destroy()
    rigRef.current = null
    if (flatRef.current) {
      flatRef.current.sprite.destroy()
      flatRef.current = null
    }
  }, [])

  const screenH = useCallback(() => {
    const app = appRef.current
    return app ? app.renderer.height / (app.renderer.resolution ?? 1) : window.innerHeight
  }, [])

  const loadCatData = useCallback(async () => {
    const app = appRef.current
    if (!app) return

    clearScene()

    const h = screenH()
    const [rawSegments, rawRig] = await Promise.all([
      window.catpet.loadSegments('primary'),
      window.catpet.loadRig('primary'),
    ])

    if (rawSegments && rawRig) {
      rigRef.current = await PuppetRig.create(
        app,
        rawSegments,
        rawRig as RigDefinition,
        CAT_X_START,
        h,
      )
      // Start FSM (or restart it if already running)
      actorRef.current?.stop()
      const actor = createActor(petMachine, { input: { screenW: window.innerWidth } })
      actor.start()
      actorRef.current = actor
      return
    }

    // Flat-photo fallback (no segments yet)
    const photos = await window.catpet.loadPhotos()
    if (!photos.primary) return

    const img = new Image()
    img.src = photos.primary
    await img.decode()
    const texture = new Texture({ source: new ImageSource({ resource: img }) })
    const sprite  = new Sprite(texture)
    const scale   = CAT_HEIGHT / sprite.texture.height
    sprite.pivot.set(sprite.texture.width / 2, sprite.texture.height)
    sprite.scale.set(scale)
    sprite.position.set(CAT_X_START, h - BOTTOM_PAD)
    app.stage.addChild(sprite)
    flatRef.current = { sprite, basePivotY: h - BOTTOM_PAD }
  }, [clearScene, screenH])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let cancelled = false

    async function init() {
      const app = new Application()
      await app.init({
        backgroundAlpha: 0,
        width:           window.innerWidth,
        height:          window.innerHeight,
        antialias:       true,
        resolution:      window.devicePixelRatio || 1,
        autoDensity:     true,
      })
      if (cancelled) { app.destroy(true); return }

      const cv = app.canvas as HTMLCanvasElement
      cv.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none'
      el!.appendChild(cv)
      appRef.current = app

      await loadCatData()

      // ── Ticker ──────────────────────────────────────────────────────────────
      app.ticker.add(ticker => {
        const actor = actorRef.current
        const rig   = rigRef.current

        if (rig && actor) {
          const snap      = actor.getSnapshot()
          const stateVal  = snap.value as string

          // Keep rig's state ID in sync
          const knownStates = ['idle', 'walking', 'sleeping', 'grooming', 'startled'] as const
          const sid = knownStates.find(s => s === stateVal) ?? 'idle'
          rig.setState(sid)

          // When FSM enters walking, update the walk target
          if (sid === 'walking') {
            rig.setWalkTarget(snap.context.walkTargetX)
          }

          const result = rig.tick(ticker.deltaMS)
          if (result === 'arrived') {
            actor.send({ type: 'ARRIVED' })
          }

        } else if (flatRef.current) {
          // Simple breathing bob for flat-photo fallback
          const t      = performance.now() / 1000
          const breath = Math.sin(t * Math.PI * 2 / 3) * 1.5
          flatRef.current.sprite.y = flatRef.current.basePivotY - breath
        }
      })
    }

    init()

    const unsubscribe = window.catpet.onCatLoaded(loadCatData)

    // ── Mouse move: hit detection + startle ─────────────────────────────────
    let lastMouseX = 0, lastMouseY = 0, lastMouseT = 0

    function onMouseMove(e: MouseEvent) {
      const now = performance.now()
      const dt  = (now - lastMouseT) / 1000
      if (dt > 0) {
        const dx    = e.clientX - lastMouseX
        const dy    = e.clientY - lastMouseY
        const speed = Math.sqrt(dx * dx + dy * dy) / dt

        // Startle if cursor is near cat and moving fast
        if (speed > STARTLE_SPEED) {
          const rig = rigRef.current
          if (rig?.hitTest(e.clientX, e.clientY)) {
            actorRef.current?.send({ type: 'STARTLE' })
          }
        }
      }
      lastMouseX = e.clientX
      lastMouseY = e.clientY
      lastMouseT = now

      // Click-through toggle
      const rig = rigRef.current
      if (rig) {
        window.catpet.setCatHover(rig.hitTest(e.clientX, e.clientY))
        return
      }
      if (flatRef.current) {
        const s  = flatRef.current.sprite
        const hw = (s.texture.width  * s.scale.x) / 2
        const h2 = (s.texture.height * s.scale.y)
        window.catpet.setCatHover(
          e.clientX >= s.x - hw && e.clientX <= s.x + hw &&
          e.clientY >= s.y - h2 && e.clientY <= s.y,
        )
      }
    }

    window.addEventListener('mousemove', onMouseMove)

    return () => {
      cancelled = true
      unsubscribe()
      window.removeEventListener('mousemove', onMouseMove)
      actorRef.current?.stop()
      actorRef.current = null
      clearScene()
      appRef.current?.destroy(true)
      appRef.current = null
    }
  }, [loadCatData, clearScene])

  return (
    <div
      ref={containerRef}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}
    />
  )
}
