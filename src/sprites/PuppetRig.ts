import {
  Application,
  Container,
  Graphics,
  ImageSource,
  Sprite,
  Texture,
} from 'pixi.js'
import { LAYER_Z_INDEX, type LayerId, type RigDefinition } from '../utils/config'

/** Target height of the rendered cat on screen, in CSS pixels. */
const CAT_HEIGHT_PX = 150

interface LayerEntry {
  id: LayerId
  sprite: Sprite
  /** Sprite's pivot screen-Y at the frame it was placed — used for breathing offset. */
  basePivotY: number
}

async function textureFromDataUrl(dataUrl: string): Promise<Texture> {
  const img = new Image()
  img.src = dataUrl
  await img.decode()
  return new Texture({ source: new ImageSource({ resource: img }) })
}

export class PuppetRig {
  private container: Container
  private shadow: Graphics
  private layers: LayerEntry[] = []
  private rig: RigDefinition
  private scale: number
  private basePivotX: number  // screen-X of the cat's center (fixed)
  private basePivotY: number  // screen-Y of the cat's bottom (fixed)

  private constructor(
    _app: Application,
    rig: RigDefinition,
    catScreenX: number,
    screenH: number,
  ) {
    this.rig = rig
    this.scale      = CAT_HEIGHT_PX / rig.catHeight
    this.basePivotX = catScreenX
    this.basePivotY = screenH - 20

    this.container = new Container()
    _app.stage.addChild(this.container)

    // Shadow ellipse drawn behind every layer
    this.shadow = new Graphics()
    const sw = (rig.catWidth * this.scale) * 0.55
    this.shadow.ellipse(0, 0, sw, 7)
    this.shadow.fill({ color: 0x000000, alpha: 0.14 })
    this.shadow.position.set(catScreenX, screenH - 20)
    this.container.addChildAt(this.shadow, 0)
  }

  /** Factory — loads all textures asynchronously before returning. */
  static async create(
    app: Application,
    segments: Record<string, string>,
    rig: RigDefinition,
    catScreenX: number,
    screenH: number,
  ): Promise<PuppetRig> {
    const puppet = new PuppetRig(app, rig, catScreenX, screenH)

    // Sort layer IDs by z-index so addChild order is correct
    const sortedIds = (Object.keys(segments) as LayerId[])
      .sort((a, b) => (LAYER_Z_INDEX[a] ?? 0) - (LAYER_Z_INDEX[b] ?? 0))

    for (const id of sortedIds) {
      const texture = await textureFromDataUrl(segments[id])
      const sprite  = new Sprite(texture)
      const anchor  = rig.layerAnchors[id]

      if (anchor) {
        sprite.pivot.set(anchor.x, anchor.y)
      }

      const { screenX, screenY } = puppet.pivotScreenPos(anchor)
      sprite.position.set(screenX, screenY)
      sprite.scale.set(puppet.scale)

      puppet.container.addChild(sprite)
      puppet.layers.push({ id, sprite, basePivotY: screenY })
    }

    return puppet
  }

  /**
   * Convert an anchor point (image-space) to the screen position of that pivot.
   * All layer sprites share the same image origin so the formula is the same for all.
   */
  private pivotScreenPos(anchor: { x: number; y: number } | undefined): { screenX: number; screenY: number } {
    const { bboxOrigin, catWidth, catHeight } = this.rig
    const s = this.scale
    // Top-left of the full sprite in screen space (bottom-center of bbox → targetY)
    const spriteLeft = this.basePivotX - (bboxOrigin.x + catWidth  / 2) * s
    const spriteTop  = this.basePivotY - (bboxOrigin.y + catHeight)     * s

    if (!anchor) return { screenX: spriteLeft, screenY: spriteTop }
    return {
      screenX: spriteLeft + anchor.x * s,
      screenY: spriteTop  + anchor.y * s,
    }
  }

  /** Call every frame from the PixiJS ticker. */
  tick(): void {
    if (this.layers.length === 0) return

    const t = performance.now() / 1000
    // Primary breathing cycle ~3 s
    const breath   = Math.sin(t * Math.PI * 2 / 3)
    // Tail sway is slower and phase-shifted
    const tailSway = Math.sin(t * Math.PI * 2 / 4 + 1.1)
    const bob      = breath * 1.5  // ±1.5 px vertical

    for (const { id, sprite, basePivotY } of this.layers) {
      sprite.y = basePivotY - bob

      switch (id) {
        case 'head':
          sprite.rotation = breath * 0.025
          break
        case 'tail':
          sprite.rotation = tailSway * 0.10
          break
        case 'front-legs':
          sprite.rotation = breath * 0.020
          break
        case 'rear-legs':
          sprite.rotation = breath * 0.015
          break
      }
    }

    // Shadow gently scales with the bob (cat rises → shadow shrinks slightly)
    const shadowScale = 1 - bob * 0.005
    this.shadow.scale.set(shadowScale, 1)
  }

  /** Returns true when the screen point is inside the cat's bounding box. */
  hitTest(screenX: number, screenY: number): boolean {
    const { catWidth, catHeight } = this.rig
    const halfW = (catWidth  * this.scale) / 2
    const top   = this.basePivotY - catHeight * this.scale
    return (
      screenX >= this.basePivotX - halfW &&
      screenX <= this.basePivotX + halfW &&
      screenY >= top &&
      screenY <= this.basePivotY
    )
  }

  destroy(): void {
    this.container.destroy({ children: true, texture: true })
    this.layers = []
  }

  get catWidthPx(): number {
    return this.rig.catWidth * this.scale
  }
}
