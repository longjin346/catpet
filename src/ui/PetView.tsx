import { useEffect, useRef, useCallback } from 'react'
import { Application, ImageSource, Sprite, Texture } from 'pixi.js'
import { createActor } from 'xstate'
import { PuppetRig } from '../sprites/PuppetRig'
import { petMachine } from '../core/PetFSM'
import { POSES } from '../core/poses'
import type { RigDefinition } from '../utils/config'

const CAT_X_START   = 200
const CAT_HEIGHT    = 150
const BOTTOM_PAD    = 20
const STARTLE_SPEED = 900 // px/s — fast cursor movement near cat triggers startle

interface FlatSprite {
  sprite:     Sprite
  basePivotY: number
}

async function makePhotoSprite(
  dataUrl: string,
  app: Application,
  screenH: number,
  visible = false,
): Promise<FlatSprite> {
  const img = new Image()
  img.src = dataUrl
  await img.decode()
  const texture = new Texture({ source: new ImageSource({ resource: img }) })
  const sprite  = new Sprite(texture)
  const scale   = CAT_HEIGHT / sprite.texture.height
  sprite.pivot.set(sprite.texture.width / 2, sprite.texture.height)
  sprite.scale.set(scale)
  sprite.position.set(CAT_X_START, screenH - BOTTOM_PAD)
  sprite.visible = visible
  app.stage.addChild(sprite)
  return { sprite, basePivotY: screenH - BOTTOM_PAD }
}

export default function PetView() {
  const containerRef  = useRef<HTMLDivElement>(null)
  const appRef        = useRef<Application | null>(null)
  const rigRef        = useRef<PuppetRig | null>(null)
  // Flat photo variants (sleep + action/play states)
  const sleepRef      = useRef<FlatSprite | null>(null)
  const actionRef     = useRef<FlatSprite | null>(null)
  // Primary flat fallback (when no segments were generated yet)
  const flatRef       = useRef<FlatSprite | null>(null)
  const actorRef      = useRef<ReturnType<typeof createActor<typeof petMachine>> | null>(null)
  const prevStateRef  = useRef<string>('idle')

  const clearScene = useCallback(() => {
    rigRef.current?.destroy()
    rigRef.current = null
    for (const ref of [sleepRef, actionRef, flatRef]) {
      ref.current?.sprite.destroy()
      ref.current = null
    }
  }, [])

  const screenH = useCallback((): number => {
    const app = appRef.current
    return app ? app.renderer.height / (app.renderer.resolution ?? 1) : window.innerHeight
  }, [])

  const loadCatData = useCallback(async () => {
    const app = appRef.current
    if (!app) return
    clearScene()

    const h = screenH()
    const [rawSegments, rawRig, photos] = await Promise.all([
      window.catpet.loadSegments('primary'),
      window.catpet.loadRig('primary'),
      window.catpet.loadPhotos(),
    ])

    if (rawSegments && rawRig) {
      rigRef.current = await PuppetRig.create(
        app,
        rawSegments,
        rawRig as RigDefinition,
        CAT_X_START,
        h,
        window.innerWidth,
      )

      // Load optional flat-photo variants (sleep + action)
      if (photos.sleep)  sleepRef.current  = await makePhotoSprite(photos.sleep,  app, h)
      if (photos.action) actionRef.current = await makePhotoSprite(photos.action, app, h)

      // (Re)start the FSM
      actorRef.current?.stop()
      prevStateRef.current = 'idle'
      const actor = createActor(petMachine, { input: { screenW: window.innerWidth } })
      actor.start()
      actorRef.current = actor
      return
    }

    // No segments yet — show the raw primary photo with a breathing bob
    if (photos.primary) {
      flatRef.current = await makePhotoSprite(photos.primary, app, h, true)
    }
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
        const t     = performance.now() / 1000

        if (rig && actor) {
          const snap     = actor.getSnapshot()
          const stateVal = snap.value as string

          // On state transition: sync rig state + trigger walk target once
          if (stateVal !== prevStateRef.current) {
            prevStateRef.current = stateVal
            if (stateVal === 'walking') {
              rig.setWalkTarget(snap.context.walkTargetX)
            }
          }

          const sid = stateVal as Parameters<typeof rig.setState>[0]
          rig.setState(['idle','walking','sleeping','grooming','startled','playing'].includes(sid) ? sid : 'idle')

          // Routing: use flat photo sprites for sleep / playing states when available
          const useSleep  = stateVal === 'sleeping' && !!sleepRef.current
          const useAction = stateVal === 'playing'  && !!actionRef.current
          rig.visible = !useSleep && !useAction

          // Always tick the rig (pose + position keep interpolating when invisible)
          const result = rig.tick(ticker.deltaMS)
          if (result === 'arrived') actor.send({ type: 'ARRIVED' })

          // Sleep sprite
          const ss = sleepRef.current
          if (ss) {
            ss.sprite.visible = useSleep
            ss.sprite.x       = rig.x
            if (useSleep) {
              const p   = POSES.sleeping
              const bob = Math.sin(t * Math.PI * 2 / p.breathPeriod) * p.breathAmp * 1.5
              ss.sprite.y = ss.basePivotY - bob
            }
          }

          // Action sprite
          const as = actionRef.current
          if (as) {
            as.sprite.visible = useAction
            as.sprite.x       = rig.x
            if (useAction) {
              const p   = POSES.playing
              const bob = Math.sin(t * Math.PI * 2 / p.breathPeriod) * p.breathAmp * 1.5
              as.sprite.y = as.basePivotY - bob
            }
          }

        } else if (flatRef.current) {
          // Simple breathing bob for no-segments fallback
          const bob = Math.sin(t * Math.PI * 2 / 3) * 1.5
          flatRef.current.sprite.y = flatRef.current.basePivotY - bob
        }
      })
    }

    init()

    const unsubscribe = window.catpet.onCatLoaded(loadCatData)

    // ── Pointer events ──────────────────────────────────────────────────────
    let lastMouseX = 0, lastMouseY = 0, lastMouseT = 0

    function onMouseMove(e: MouseEvent) {
      const now = performance.now()
      const dt  = (now - lastMouseT) / 1000

      if (dt > 0) {
        const dx    = e.clientX - lastMouseX
        const dy    = e.clientY - lastMouseY
        const speed = Math.sqrt(dx * dx + dy * dy) / dt
        if (speed > STARTLE_SPEED && rigRef.current?.hitTest(e.clientX, e.clientY)) {
          actorRef.current?.send({ type: 'STARTLE' })
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
      const flat = flatRef.current
      if (flat) {
        const s  = flat.sprite
        const hw = (s.texture.width  * s.scale.x) / 2
        const h2 =  s.texture.height * s.scale.y
        window.catpet.setCatHover(
          e.clientX >= s.x - hw && e.clientX <= s.x + hw &&
          e.clientY >= s.y - h2 && e.clientY <= s.y,
        )
      }
    }

    // Click on the cat triggers a startle reaction
    function onPointerDown(e: PointerEvent) {
      if (rigRef.current?.hitTest(e.clientX, e.clientY)) {
        actorRef.current?.send({ type: 'STARTLE' })
      }
    }

    window.addEventListener('mousemove',   onMouseMove)
    window.addEventListener('pointerdown', onPointerDown)

    return () => {
      cancelled = true
      unsubscribe()
      window.removeEventListener('mousemove',   onMouseMove)
      window.removeEventListener('pointerdown', onPointerDown)
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
