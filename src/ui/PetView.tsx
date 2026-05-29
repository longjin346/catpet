import { useEffect, useRef, useCallback } from 'react'
import { Application, ImageSource, Sprite, Texture } from 'pixi.js'
import { createActor } from 'xstate'
import { PuppetRig, setWalkSpeedMultiplier } from '../sprites/PuppetRig'
import { ParticleEmitter, type ParticleType } from '../sprites/ParticleEmitter'
import { SoundManager } from '../utils/sounds'
import { petMachine } from '../core/PetFSM'
import { setPersonality, getPersonality, PERSONALITIES, type PersonalityId } from '../core/personality'
import { POSES } from '../core/poses'
import type { RigDefinition } from '../utils/config'

const CAT_X_DEFAULT = 200
const CAT_HEIGHT    = 150
const BOTTOM_PAD    = 20
const STARTLE_SPEED = 900
const NEAR_RADIUS   = 120  // px from cat center — click near triggers play

// Periodic particle emit intervals (seconds)
const PARTICLE_INTERVALS: Partial<Record<string, number>> = {
  sleeping: 2.8,
  grooming: 2.5,
  playing:  2.0,
  hungry:   3.5,
}

const PARTICLE_TYPES: Partial<Record<string, ParticleType>> = {
  sleeping: 'zzz',
  grooming: 'sparkle',
  playing:  'heart',
  hungry:   'exclaim',
}

// States that run the purr
const PURRING_STATES = new Set(['idle', 'grooming', 'sitting'])

// All valid PetStateId values for the rig
const VALID_STATES = new Set([
  'idle', 'walking', 'sitting', 'sleeping', 'stretching',
  'grooming', 'startled', 'playing', 'hungry',
])

interface FlatSprite {
  sprite:     Sprite
  basePivotY: number
}

async function makePhotoSprite(
  dataUrl: string,
  app: Application,
  screenH: number,
  startX: number,
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
  sprite.position.set(startX, screenH - BOTTOM_PAD)
  sprite.visible = visible
  app.stage.addChild(sprite)
  return { sprite, basePivotY: screenH - BOTTOM_PAD }
}

export default function PetView() {
  const containerRef  = useRef<HTMLDivElement>(null)
  const appRef        = useRef<Application | null>(null)
  const rigRef        = useRef<PuppetRig | null>(null)
  const sleepRef      = useRef<FlatSprite | null>(null)
  const actionRef     = useRef<FlatSprite | null>(null)
  const flatRef       = useRef<FlatSprite | null>(null)
  const actorRef      = useRef<ReturnType<typeof createActor<typeof petMachine>> | null>(null)
  const prevStateRef  = useRef<string>('idle')
  const emitterRef    = useRef<ParticleEmitter | null>(null)
  const soundRef      = useRef<SoundManager | null>(null)
  const lastBurstRef  = useRef<number>(0)
  const catScaleRef   = useRef<number>(1.0)
  const isDraggingRef  = useRef<boolean>(false)
  const dragOffsetXRef = useRef<number>(0)
  // Hunger interval ID (returns to 'hungry' FSM state every HUNGER_INTERVAL ms)
  const hungerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // ENERGY_TICK interval (every 60 s)
  const energyTickRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  // Track time spent in playing state for stats
  const playStartRef   = useRef<number | null>(null)

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

  /** Load and apply preferences (personality, sound, scale) without full scene reload. */
  const loadPrefs = useCallback(async () => {
    const [p, m, v, s] = await Promise.all([
      window.catpet.storeGet('personality'),
      window.catpet.storeGet('soundMuted'),
      window.catpet.storeGet('soundVolume'),
      window.catpet.storeGet('catScale'),
    ])
    const pid = (typeof p === 'string' && p in PERSONALITIES) ? (p as PersonalityId) : 'chill'
    setPersonality(pid)
    setWalkSpeedMultiplier(getPersonality().walkSpeedMult)

    const sound = soundRef.current
    if (sound) {
      const muted  = typeof m === 'boolean' ? m : true
      const vol    = typeof v === 'number'  ? v : 0.35
      sound.setVolume(vol)
      sound.setMuted(muted)
    }

    return typeof s === 'number' ? s : 1.0
  }, [])

  const loadCatData = useCallback(async () => {
    const app = appRef.current
    if (!app) return
    clearScene()

    const scale = await loadPrefs()
    catScaleRef.current = scale

    const h = screenH()
    const EDGE = 40
    const [rawSegments, rawRig, photos, savedFrac] = await Promise.all([
      window.catpet.loadSegments('primary'),
      window.catpet.loadRig('primary'),
      window.catpet.loadPhotos(),
      window.catpet.storeGet('catPositionFraction'),
    ])
    const catScreenX = typeof savedFrac === 'number'
      ? Math.max(EDGE, Math.min(window.innerWidth - EDGE, savedFrac * window.innerWidth))
      : CAT_X_DEFAULT

    if (rawSegments && rawRig) {
      rigRef.current = await PuppetRig.create(
        app,
        rawSegments,
        rawRig as RigDefinition,
        catScreenX,
        h,
        window.innerWidth,
        catScaleRef.current,
      )

      if (photos.sleep)  sleepRef.current  = await makePhotoSprite(photos.sleep,  app, h, catScreenX)
      if (photos.action) actionRef.current = await makePhotoSprite(photos.action, app, h, catScreenX)

      actorRef.current?.stop()
      prevStateRef.current = 'idle'
      lastBurstRef.current = 0
      const actor = createActor(petMachine, { input: { screenW: window.innerWidth } })
      actor.start()
      actorRef.current = actor
      return
    }

    if (photos.primary) {
      flatRef.current = await makePhotoSprite(photos.primary, app, h, catScreenX, true)
    }
  }, [clearScene, screenH, loadPrefs])

  /** Increment an integer stat in the store. */
  const bumpStat = useCallback(async (key: string, amount = 1) => {
    const current = await window.catpet.storeGet(key)
    await window.catpet.storeSet(key, (typeof current === 'number' ? current : 0) + amount)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let cancelled = false
    soundRef.current  = new SoundManager()
    const sound       = soundRef.current

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
      appRef.current  = app
      emitterRef.current = new ParticleEmitter(app)

      await loadCatData()

      // Record first launch date if not set
      const firstLaunch = await window.catpet.storeGet('stats.firstLaunch')
      if (!firstLaunch) {
        await window.catpet.storeSet('stats.firstLaunch', new Date().toISOString())
      }

      // Increment launch count
      bumpStat('stats.launchCount')

      // ENERGY_TICK every 60 s
      energyTickRef.current = setInterval(() => {
        actorRef.current?.send({ type: 'ENERGY_TICK' })
      }, 60_000)

      // Hunger timer — fires after stored interval (default 90 min)
      async function scheduleHunger() {
        if (hungerTimerRef.current) clearTimeout(hungerTimerRef.current)
        const stored = await window.catpet.storeGet('hungerInterval')
        const interval = typeof stored === 'number' ? stored : 5_400_000
        hungerTimerRef.current = setTimeout(() => {
          actorRef.current?.send({ type: 'HUNGRY' })
          window.catpet.notifyHungry(true)
        }, interval)
      }
      scheduleHunger()

      // ── Ticker ──────────────────────────────────────────────────────────────
      app.ticker.add(ticker => {
        const actor   = actorRef.current
        const rig     = rigRef.current
        const emitter = emitterRef.current
        const t       = performance.now() / 1000

        emitter?.tick(ticker.deltaMS)

        if (rig && actor) {
          const snap     = actor.getSnapshot()
          const stateVal = snap.value as string

          if (stateVal !== prevStateRef.current) {
            const prev = prevStateRef.current
            prevStateRef.current = stateVal

            // Walk target — suppressed while user is dragging
            if (stateVal === 'walking' && !isDraggingRef.current) {
              rig.setWalkTarget(snap.context.walkTargetX)
            }

            // Sound transitions
            const wasP = PURRING_STATES.has(prev)
            const isP  = PURRING_STATES.has(stateVal)
            if (!wasP && isP)   sound.startPurr()
            if (wasP  && !isP)  sound.stopPurr()
            if (stateVal === 'startled') sound.meow()
            if (stateVal === 'playing')  sound.chirp()
            if (stateVal === 'hungry')   sound.meow()

            // Stats: play time tracking
            if (prev === 'playing' && playStartRef.current !== null) {
              const secs = Math.floor((performance.now() - playStartRef.current) / 1000)
              bumpStat('stats.playSeconds', secs)
              playStartRef.current = null
            }
            if (stateVal === 'playing') {
              playStartRef.current = performance.now()
            }

            // Hungry state: notify tray; clear when leaving
            if (stateVal === 'hungry')  window.catpet.notifyHungry(true)
            if (prev   === 'hungry')    window.catpet.notifyHungry(false)

            // Entry particle burst
            if (stateVal === 'startled') {
              emitter?.burst(rig.x, screenH() - 170, 'exclaim', 1)
            } else if (stateVal === 'playing') {
              emitter?.burst(rig.x, screenH() - 170, 'heart', 3)
            } else if (stateVal === 'grooming') {
              emitter?.burst(rig.x, screenH() - 160, 'sparkle', 2)
            } else if (stateVal === 'hungry') {
              emitter?.burst(rig.x, screenH() - 160, 'exclaim', 2)
            }

            lastBurstRef.current = t
          }

          // Periodic particle emission for sustained states
          const interval = PARTICLE_INTERVALS[stateVal]
          const pType    = PARTICLE_TYPES[stateVal]
          if (interval && pType && emitter && (t - lastBurstRef.current) >= interval) {
            lastBurstRef.current = t
            const count = stateVal === 'sleeping' ? 1 : 2
            emitter.burst(rig.x, screenH() - 160, pType, count)
          }

          const sid = VALID_STATES.has(stateVal)
            ? stateVal as Parameters<typeof rig.setState>[0]
            : 'idle'
          rig.setState(sid)

          const useSleep  = stateVal === 'sleeping'   && !!sleepRef.current
          const useAction = stateVal === 'playing'    && !!actionRef.current
          rig.visible = !useSleep && !useAction

          const result = rig.tick(ticker.deltaMS)
          if (result === 'arrived') actor.send({ type: 'ARRIVED' })

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
          const bob = Math.sin(t * Math.PI * 2 / 3) * 1.5
          flatRef.current.sprite.y = flatRef.current.basePivotY - bob
        }
      })
    }

    init()

    const unsubCatLoaded = window.catpet.onCatLoaded(loadCatData)

    const unsubFeed = window.catpet.onFeed(() => {
      actorRef.current?.send({ type: 'FEED' })
      window.catpet.notifyHungry(false)
      // Reschedule hunger timer
      scheduleHungerFromStore()
    })

    async function scheduleHungerFromStore() {
      if (hungerTimerRef.current) clearTimeout(hungerTimerRef.current)
      const stored = await window.catpet.storeGet('hungerInterval')
      const interval = typeof stored === 'number' ? stored : 5_400_000
      hungerTimerRef.current = setTimeout(() => {
        actorRef.current?.send({ type: 'HUNGRY' })
        window.catpet.notifyHungry(true)
      }, interval)
    }

    const unsubPrefsChanged = window.catpet.onPrefsChanged(async () => {
      const newScale = await loadPrefs()
      if (Math.abs(newScale - catScaleRef.current) > 0.01) {
        loadCatData()
      }
    })

    // ── Pointer events ──────────────────────────────────────────────────────
    let lastMouseX = 0, lastMouseY = 0, lastMouseT = 0

    function onMouseMove(e: MouseEvent) {
      // Pass mouse position to rig for head tracking in play state
      rigRef.current?.setMousePos(e.clientX, e.clientY)

      // During drag: move cat, keep click-through disabled, skip startle logic
      if (isDraggingRef.current) {
        rigRef.current?.teleport(e.clientX - dragOffsetXRef.current)
        window.catpet.setCatHover(true)
        return
      }

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

      const rig = rigRef.current
      if (rig) {
        window.catpet.setCatHover(rig.hitTest(e.clientX, e.clientY))
        return
      }
      const flat = flatRef.current
      if (flat) {
        const sp = flat.sprite
        const hw = (sp.texture.width  * sp.scale.x) / 2
        const h2 =  sp.texture.height * sp.scale.y
        window.catpet.setCatHover(
          e.clientX >= sp.x - hw && e.clientX <= sp.x + hw &&
          e.clientY >= sp.y - h2 && e.clientY <= sp.y,
        )
      }
    }

    function nearTest(ex: number, ey: number): boolean {
      const rig = rigRef.current
      if (!rig) return false
      const dx = ex - rig.x
      const dy = ey - (screenH() - BOTTOM_PAD - CAT_HEIGHT / 2)
      return Math.sqrt(dx * dx + dy * dy) <= NEAR_RADIUS && !rig.hitTest(ex, ey)
    }

    function onPointerDown(e: PointerEvent) {
      const rig = rigRef.current
      if (rig?.hitTest(e.clientX, e.clientY)) {
        // Hungry: clicking on cat feeds it
        const snap = actorRef.current?.getSnapshot()
        if (snap?.value === 'hungry') {
          actorRef.current?.send({ type: 'FEED' })
          window.catpet.notifyHungry(false)
          scheduleHungerFromStore()
          bumpStat('stats.interactions')
          return
        }
        isDraggingRef.current  = true
        dragOffsetXRef.current = e.clientX - rig.x
        actorRef.current?.send({ type: 'STARTLE' })
        bumpStat('stats.interactions')
      } else if (nearTest(e.clientX, e.clientY)) {
        actorRef.current?.send({ type: 'PLAY_NEAR' })
        bumpStat('stats.interactions')
      }
    }

    function onPointerUp() {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      const rig = rigRef.current
      if (rig) {
        window.catpet.storeSet('catPositionFraction', rig.x / window.innerWidth)
      }
    }

    window.addEventListener('mousemove',   onMouseMove)
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup',   onPointerUp)

    return () => {
      cancelled = true
      unsubCatLoaded()
      unsubFeed()
      unsubPrefsChanged()
      window.removeEventListener('mousemove',   onMouseMove)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup',   onPointerUp)
      actorRef.current?.stop()
      actorRef.current = null
      emitterRef.current?.destroy()
      emitterRef.current = null
      soundRef.current?.destroy()
      soundRef.current = null
      if (energyTickRef.current)  clearInterval(energyTickRef.current)
      if (hungerTimerRef.current) clearTimeout(hungerTimerRef.current)
      clearScene()
      appRef.current?.destroy(true)
      appRef.current = null
    }
  }, [loadCatData, clearScene, loadPrefs, screenH, bumpStat])

  return (
    <div
      ref={containerRef}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}
    />
  )
}
