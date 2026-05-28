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

const CAT_HEIGHT_PX = 150
const BOTTOM_PAD    = 20
const LERP_SPEED    = 3.5
const WALK_SPEED    = 55
const ARRIVE_THRESH = 8
const EDGE_PAD      = 40

// Walk speed multiplier, updated by PetView when personality changes
let walkSpeedMultiplier = 1.0
export function setWalkSpeedMultiplier(m: number): void { walkSpeedMultiplier = m }

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
  localPivotX: number
  localPivotY: number
  cur:         LayerPose
}

export class PuppetRig {
  private catGroup:    Container
  private shadow:      Graphics
  private layers:      LayerEntry[] = []
  private rig:         RigDefinition
  private scale:       number
  private catX:        number
  private catY:        number
  private screenW:     number
  private walkTargetX: number | null = null
  private stateId:     PetStateId = 'idle'
  /** True when the cat is rendered facing the direction opposite to the photo. */
  private flipped:     boolean = false

  private constructor(
    _app: Application,
    rig: RigDefinition,
    catScreenX: number,
    screenH: number,
    screenW: number,
    scaleMult = 1.0,
  ) {
    this.rig     = rig
    this.scale   = (CAT_HEIGHT_PX / rig.catHeight) * scaleMult
    this.catX    = catScreenX
    this.catY    = screenH - BOTTOM_PAD
    this.screenW = screenW

    this.catGroup = new Container()
    this.catGroup.position.set(catScreenX, this.catY)
    _app.stage.addChild(this.catGroup)

    const sw = (rig.catWidth * this.scale) * 0.55
    this.shadow = new Graphics()
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
    screenW: number,
    scaleMult = 1.0,
  ): Promise<PuppetRig> {
    const puppet = new PuppetRig(app, rig, catScreenX, screenH, screenW, scaleMult)
    const { bboxOrigin, catWidth, catHeight } = rig
    const s = puppet.scale

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
        id, sprite,
        localPivotX: localX,
        localPivotY: localY,
        cur: { rotation: 0, yOffset: 0, alpha: 1 },
      })
    }

    return puppet
  }

  setState(id: PetStateId): void {
    this.stateId = id
  }

  setWalkTarget(x: number): void {
    this.walkTargetX = Math.max(EDGE_PAD, Math.min(this.screenW - EDGE_PAD, x))
  }

  /** Instantly move the cat to x, cancelling any active walk. */
  teleport(x: number): void {
    this.catX        = Math.max(EDGE_PAD, Math.min(this.screenW - EDGE_PAD, x))
    this.walkTargetX = null
  }

  set visible(v: boolean) {
    this.catGroup.visible = v
  }

  tick(deltaMs: number): 'arrived' | undefined {
    if (this.layers.length === 0) return

    const dt   = deltaMs / 1000
    const t    = performance.now() / 1000
    const pose = POSES[this.stateId]

    // ── Breathing oscillation ────────────────────────────────────────────────
    const breath     = Math.sin(t * Math.PI * 2 / pose.breathPeriod) * pose.breathAmp
    const bob        = breath * 1.5
    const headBreath = breath * 0.025
    const tailBreath = Math.sin(t * Math.PI * 2 / 4 + 1.1) * pose.breathAmp * 0.10

    // ── Walk cycle overlay ───────────────────────────────────────────────────
    const isWalking = this.stateId === 'walking'
    const walkCycle = isWalking ? Math.sin(t * Math.PI * 4) * 0.25 : 0

    // ── Walking position + directional flip ─────────────────────────────────
    let arrived = false
    if (isWalking && this.walkTargetX !== null) {
      const dx   = this.walkTargetX - this.catX
      const dist = Math.abs(dx)

      // Set facing direction based on walk direction
      const walkingLeft = dx < 0
      const shouldFlip  = (walkingLeft && this.rig.headSide === 'right') ||
                          (!walkingLeft && this.rig.headSide === 'left')
      if (shouldFlip !== this.flipped) {
        this.flipped          = shouldFlip
        this.catGroup.scale.x = shouldFlip ? -1 : 1
      }

      if (dist <= ARRIVE_THRESH) {
        this.catX        = this.walkTargetX
        this.walkTargetX = null
        arrived          = true
      } else {
        this.catX += Math.sign(dx) * Math.min(WALK_SPEED * walkSpeedMultiplier * dt, dist)
      }
    }

    // Clamp to screen edges
    this.catX = Math.max(EDGE_PAD, Math.min(this.screenW - EDGE_PAD, this.catX))

    this.catGroup.x            = this.catX
    this.shadow.scale.set(1 - bob * 0.005, 1)

    // ── Per-layer lerp + animation ───────────────────────────────────────────
    for (const layer of this.layers) {
      const target = pose.layers[layer.id]

      layer.cur.rotation = lerp(layer.cur.rotation, target.rotation, dt)
      layer.cur.yOffset  = lerp(layer.cur.yOffset,  target.yOffset,  dt)
      layer.cur.alpha    = lerp(layer.cur.alpha,     target.alpha,    dt)

      let rotation = layer.cur.rotation
      let yOffset  = layer.cur.yOffset + bob

      switch (layer.id) {
        case 'head':
          rotation += headBreath; break
        case 'tail':
          rotation += tailBreath; break
        case 'front-legs':
          rotation += walkCycle; break
        case 'rear-legs':
          rotation -= walkCycle; break
      }

      layer.sprite.rotation = rotation
      layer.sprite.y        = layer.localPivotY + yOffset
      layer.sprite.alpha    = layer.cur.alpha
    }

    return arrived ? 'arrived' : undefined
  }

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
