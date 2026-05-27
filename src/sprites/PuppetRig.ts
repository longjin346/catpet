import {
  Application,
  Container,
  Graphics,
  ImageSource,
  Sprite,
  Texture,
} from 'pixi.js'
import { LAYER_Z_INDEX, type LayerId, type RigDefinition } from '../utils/config'
import { POSES, type LayerPose, type PetStateId } from '../core/poses'

/** Target height of the rendered cat on screen, in CSS pixels. */
const CAT_HEIGHT_PX = 150
const BOTTOM_PAD    = 20
/** Lerp speed: ~95 % of the way to target in ~1 second. */
const LERP_SPEED    = 3.5
/** Walk speed in px / second. */
const WALK_SPEED    = 55
/** How close to walkTarget (px) counts as "arrived". */
const ARRIVE_THRESH = 8

function lerp(a: number, b: number, dt: number): number {
  return a + (b - a) * Math.min(1, dt * LERP_SPEED)
}

async function textureFromDataUrl(dataUrl: string): Promise<Texture> {
  const img = new Image()
  img.src = dataUrl
  await img.decode()
  return new Texture({ source: new ImageSource({ resource: img }) })
}

interface LayerEntry {
  id:          LayerId
  sprite:      Sprite
  /** Sprite's pivot position within catGroup local space, Y component (at load time). */
  localPivotX: number
  localPivotY: number
  /** Running interpolated pose values. */
  cur:         LayerPose
}

export class PuppetRig {
  private catGroup:  Container
  private shadow:    Graphics
  private layers:    LayerEntry[] = []
  private rig:       RigDefinition
  private scale:     number
  /** Current screen X of the cat's bottom-center. */
  private catX:      number
  private catY:      number
  /** Target screen X for walking. */
  private walkTargetX: number | null = null
  private stateId:   PetStateId = 'idle'

  private constructor(
    _app: Application,
    rig: RigDefinition,
    catScreenX: number,
    screenH: number,
  ) {
    this.rig    = rig
    this.scale  = CAT_HEIGHT_PX / rig.catHeight
    this.catX   = catScreenX
    this.catY   = screenH - BOTTOM_PAD

    this.catGroup = new Container()
    this.catGroup.position.set(catScreenX, this.catY)
    _app.stage.addChild(this.catGroup)

    // Shadow — drawn at index 0 (behind all sprites)
    this.shadow = new Graphics()
    const sw = (rig.catWidth * this.scale) * 0.55
    this.shadow.ellipse(0, 4, sw, 7)
    this.shadow.fill({ color: 0x000000, alpha: 0.14 })
    this.catGroup.addChildAt(this.shadow, 0)
  }

  static async create(
    app: Application,
    segments: Record<string, string>,
    rig: RigDefinition,
    catScreenX: number,
    screenH: number,
  ): Promise<PuppetRig> {
    const puppet = new PuppetRig(app, rig, catScreenX, screenH)
    const { bboxOrigin, catWidth, catHeight } = rig
    const s = puppet.scale

    // catGroup origin = cat's bottom-center on screen
    // sprite local x = (anchorX - (bboxOrigin.x + catWidth/2)) * scale
    // sprite local y = (anchorY - (bboxOrigin.y + catHeight)) * scale

    const sortedIds = (Object.keys(segments) as LayerId[])
      .sort((a, b) => (LAYER_Z_INDEX[a] ?? 0) - (LAYER_Z_INDEX[b] ?? 0))

    for (const id of sortedIds) {
      const texture = await textureFromDataUrl(segments[id])
      const sprite  = new Sprite(texture)
      const anchor  = rig.layerAnchors[id] ?? { x: bboxOrigin.x + catWidth / 2, y: bboxOrigin.y + catHeight }

      sprite.pivot.set(anchor.x, anchor.y)
      sprite.scale.set(s)

      const localX = (anchor.x - bboxOrigin.x - catWidth  / 2) * s
      const localY = (anchor.y - bboxOrigin.y - catHeight)     * s
      sprite.position.set(localX, localY)

      puppet.catGroup.addChild(sprite)
      puppet.layers.push({
        id,
        sprite,
        localPivotX: localX,
        localPivotY: localY,
        cur: { rotation: 0, yOffset: 0, alpha: 1 },
      })
    }

    return puppet
  }

  /** Notify the rig of the current FSM state; poses will lerp toward it. */
  setState(id: PetStateId): void {
    this.stateId = id
  }

  /** Begin walking toward this screen-X. Call setState('walking') beforehand. */
  setWalkTarget(x: number): void {
    this.walkTargetX = x
  }

  /**
   * Main update — call from PixiJS ticker.
   * @param deltaMs  milliseconds since last frame
   * @returns  'arrived' when the cat reaches its walk target, undefined otherwise
   */
  tick(deltaMs: number): 'arrived' | undefined {
    if (this.layers.length === 0) return

    const dt   = deltaMs / 1000
    const t    = performance.now() / 1000
    const pose = POSES[this.stateId]

    // ── Breathing oscillation ────────────────────────────────────────────────
    const breathPhase = t * Math.PI * 2 / pose.breathPeriod
    const breath      = Math.sin(breathPhase) * pose.breathAmp
    const bob         = breath * 1.5        // shared vertical bob (px)
    const headBreath  = breath * 0.025
    const tailBreath  = Math.sin(t * Math.PI * 2 / 4 + 1.1) * pose.breathAmp * 0.1

    // ── Walk cycle overlay ───────────────────────────────────────────────────
    const isWalking    = this.stateId === 'walking'
    const walkCycle    = isWalking ? Math.sin(t * Math.PI * 4) * 0.25 : 0

    // ── Walking position ─────────────────────────────────────────────────────
    let arrived = false
    if (isWalking && this.walkTargetX !== null) {
      const dx   = this.walkTargetX - this.catX
      const dist = Math.abs(dx)
      if (dist <= ARRIVE_THRESH) {
        this.catX       = this.walkTargetX
        this.walkTargetX = null
        arrived         = true
      } else {
        this.catX += Math.sign(dx) * Math.min(WALK_SPEED * dt, dist)
      }
    }

    // ── Apply position to container ──────────────────────────────────────────
    this.catGroup.x = this.catX

    // ── Shadow ──────────────────────────────────────────────────────────────
    this.shadow.scale.set(1 - bob * 0.005, 1)

    // ── Per-layer interpolation + animation ─────────────────────────────────
    for (const layer of this.layers) {
      const target = pose.layers[layer.id]

      layer.cur.rotation = lerp(layer.cur.rotation, target.rotation, dt)
      layer.cur.yOffset  = lerp(layer.cur.yOffset,  target.yOffset,  dt)
      layer.cur.alpha    = lerp(layer.cur.alpha,    target.alpha,    dt)

      let rotation = layer.cur.rotation
      let yOffset  = layer.cur.yOffset + bob

      // Breathing + walk cycle overlays
      switch (layer.id) {
        case 'head':
          rotation += headBreath
          break
        case 'tail':
          rotation += tailBreath
          break
        case 'front-legs':
          rotation += walkCycle
          break
        case 'rear-legs':
          rotation -= walkCycle
          break
      }

      layer.sprite.rotation = rotation
      layer.sprite.y        = layer.localPivotY + yOffset
      layer.sprite.alpha    = layer.cur.alpha
    }

    return arrived ? 'arrived' : undefined
  }

  /** Returns true when the screen point is inside the cat's bounding box. */
  hitTest(screenX: number, screenY: number): boolean {
    const hw  = (this.rig.catWidth  * this.scale) / 2
    const top = this.catY - this.rig.catHeight * this.scale
    return (
      screenX >= this.catX - hw &&
      screenX <= this.catX + hw &&
      screenY >= top &&
      screenY <= this.catY
    )
  }

  destroy(): void {
    this.catGroup.destroy({ children: true, texture: true })
    this.layers = []
  }

  get x(): number { return this.catX }
}
