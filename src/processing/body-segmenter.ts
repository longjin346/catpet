import { analyzeSilhouette, BBox } from './silhouette-analyzer'
import { extractLayer, RegionRect } from './layer-extractor'
import {
  LayerId, JointId, SegmentLayer, RigJoint, RigDefinition, Point, LAYER_Z_INDEX,
} from '../utils/config'

export interface SegmentationResult {
  layers: SegmentLayer[]
  rig: RigDefinition
}

const FEATHER = 15
const LAYER_IDS: LayerId[] = ['head', 'torso', 'front-legs', 'rear-legs', 'tail']

function loadImageToCtx(dataUrl: string): Promise<CanvasRenderingContext2D> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      resolve(ctx)
    }
    img.onerror = () => reject(new Error('Failed to load segmentation source image'))
    img.src = dataUrl
  })
}

function defineRegions(bbox: BBox, headSide: 'left' | 'right'): Record<LayerId, RegionRect> {
  const { minX, minY, w, h } = bbox
  // All percentages assume head is on the right; mirror x when head is on the left.
  const xp = (pct: number) => minX + (headSide === 'right' ? pct : 1 - pct) * w
  const yp = (pct: number) => minY + pct * h

  // head occupies the front 27% horizontally
  const hx1 = headSide === 'right' ? xp(0.73) : xp(0.27)
  const hx2 = headSide === 'right' ? xp(1.00) : xp(0.00)

  // tail occupies the rear 27% horizontally
  const tx1 = headSide === 'right' ? xp(0.00) : xp(1.00)
  const tx2 = headSide === 'right' ? xp(0.27) : xp(0.73)

  // front-legs: head-side half, lower 65%
  const fl_x1 = headSide === 'right' ? xp(0.45) : xp(0.55)
  const fl_x2 = headSide === 'right' ? xp(1.00) : xp(0.00)

  // rear-legs: tail-side half, lower 65%
  const rl_x1 = headSide === 'right' ? xp(0.00) : xp(1.00)
  const rl_x2 = headSide === 'right' ? xp(0.55) : xp(0.45)

  return {
    head:         { x1: Math.min(hx1,  hx2),  x2: Math.max(hx1,  hx2),  y1: yp(0),    y2: yp(1)    },
    torso:        { x1: minX + 0.12 * w,       x2: minX + 0.88 * w,       y1: yp(0),    y2: yp(0.65) },
    'front-legs': { x1: Math.min(fl_x1, fl_x2), x2: Math.max(fl_x1, fl_x2), y1: yp(0.33), y2: yp(1)    },
    'rear-legs':  { x1: Math.min(rl_x1, rl_x2), x2: Math.max(rl_x1, rl_x2), y1: yp(0.33), y2: yp(1)    },
    tail:         { x1: Math.min(tx1,  tx2),  x2: Math.max(tx1,  tx2),  y1: yp(0),    y2: yp(0.78) },
  }
}

function computeJoints(bbox: BBox, headSide: 'left' | 'right'): RigJoint[] {
  const { minX, minY, w, h } = bbox
  // xp mirrors x when head is on left so percentages are always head-relative
  const xp = (pct: number): number => minX + (headSide === 'right' ? pct : 1 - pct) * w
  const yp = (pct: number): number => minY + pct * h

  return [
    { id: 'neck'      as JointId, position: { x: xp(0.73), y: yp(0.28) }, rotationRange: [-15,  15] },
    { id: 'shoulder'  as JointId, position: { x: xp(0.68), y: yp(0.44) }, rotationRange: [-20,  35] },
    { id: 'hip'       as JointId, position: { x: xp(0.33), y: yp(0.44) }, rotationRange: [-20,  35] },
    { id: 'tail-base' as JointId, position: { x: xp(0.13), y: yp(0.37) }, rotationRange: [-45,  60] },
  ]
}

function computeLayerAnchors(
  bbox: BBox,
  headSide: 'left' | 'right',
  joints: RigJoint[],
): Record<LayerId, Point> {
  const { minX, minY, w, h } = bbox
  const xp = (pct: number): number => minX + (headSide === 'right' ? pct : 1 - pct) * w
  const yp = (pct: number): number => minY + pct * h

  const jmap = Object.fromEntries(joints.map(j => [j.id, j.position])) as Record<JointId, Point>

  return {
    head:         jmap.neck,
    torso:        { x: xp(0.5), y: yp(0.3) },
    'front-legs': jmap.shoulder,
    'rear-legs':  jmap.hip,
    tail:         jmap['tail-base'],
  }
}

export async function segmentCat(primaryDataUrl: string): Promise<SegmentationResult> {
  const ctx       = await loadImageToCtx(primaryDataUrl)
  const { width, height } = ctx.canvas
  const imageData = ctx.getImageData(0, 0, width, height)

  const { bbox, headSide } = analyzeSilhouette(imageData)
  const regions     = defineRegions(bbox, headSide)
  const joints      = computeJoints(bbox, headSide)
  const layerAnchors = computeLayerAnchors(bbox, headSide, joints)

  const layers: SegmentLayer[] = LAYER_IDS.map(id => ({
    id,
    dataUrl: extractLayer(ctx, regions[id], FEATHER),
    anchor:  layerAnchors[id],
    zIndex:  LAYER_Z_INDEX[id],
  }))

  const rig: RigDefinition = {
    joints,
    headSide,
    catWidth:    bbox.w,
    catHeight:   bbox.h,
    bboxOrigin:  { x: bbox.minX, y: bbox.minY },
    layerAnchors,
  }

  return { layers, rig }
}
