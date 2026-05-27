import { useEffect, useRef, useCallback } from 'react'
import { Application, ImageSource, Sprite, Texture } from 'pixi.js'
import { PuppetRig } from '../sprites/PuppetRig'
import type { RigDefinition } from '../utils/config'

const CAT_X       = 200
const CAT_HEIGHT  = 150
const BOTTOM_PAD  = 20

export default function PetView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef       = useRef<Application | null>(null)
  const rigRef       = useRef<PuppetRig | null>(null)
  // For the flat-photo fallback (no segments)
  const flatRef      = useRef<{ sprite: Sprite; basePivotY: number } | null>(null)

  const screenH = useCallback(() => {
    const app = appRef.current
    return app ? app.renderer.height / (app.renderer.resolution ?? 1) : window.innerHeight
  }, [])

  const clearScene = useCallback(() => {
    rigRef.current?.destroy()
    rigRef.current = null
    if (flatRef.current) {
      flatRef.current.sprite.destroy()
      flatRef.current = null
    }
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
        CAT_X,
        h,
      )
      return
    }

    // Flat-photo fallback
    const photos = await window.catpet.loadPhotos()
    if (!photos.primary) return

    const img = new Image()
    img.src = photos.primary
    await img.decode()
    const texture = new Texture({ source: new ImageSource({ resource: img }) })
    const sprite  = new Sprite(texture)

    const scale   = CAT_HEIGHT / sprite.texture.height
    const pivotX  = sprite.texture.width / 2
    const pivotY  = sprite.texture.height
    sprite.pivot.set(pivotX, pivotY)
    sprite.scale.set(scale)
    sprite.position.set(CAT_X, h - BOTTOM_PAD)

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

      app.ticker.add(() => {
        const t = performance.now() / 1000
        const breath = Math.sin(t * Math.PI * 2 / 3)

        if (rigRef.current) {
          rigRef.current.tick()
        } else if (flatRef.current) {
          flatRef.current.sprite.y = flatRef.current.basePivotY - breath * 1.5
        }
      })
    }

    init()

    const unsubscribe = window.catpet.onCatLoaded(loadCatData)

    function onMouseMove(e: MouseEvent) {
      if (rigRef.current) {
        window.catpet.setCatHover(rigRef.current.hitTest(e.clientX, e.clientY))
        return
      }
      if (flatRef.current) {
        const sprite = flatRef.current.sprite
        const hw = (sprite.texture.width  * sprite.scale.x) / 2
        const h2 = (sprite.texture.height * sprite.scale.y)
        const px = sprite.x, py = sprite.y
        window.catpet.setCatHover(
          e.clientX >= px - hw && e.clientX <= px + hw &&
          e.clientY >= py - h2 && e.clientY <= py,
        )
      }
    }

    window.addEventListener('mousemove', onMouseMove)

    return () => {
      cancelled = true
      unsubscribe()
      window.removeEventListener('mousemove', onMouseMove)
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
