import type { LayerId } from '../utils/config'

export type PetStateId = 'idle' | 'walking' | 'sleeping' | 'grooming' | 'startled' | 'playing'

export interface LayerPose {
  rotation: number  // radians
  yOffset:  number  // additional px below the layer's base pivot
  alpha:    number  // 0–1
}

export interface PoseConfig {
  layers:        Record<LayerId, LayerPose>
  breathAmp:     number  // 0–1 multiplier on the default ±1.5 px bob
  breathPeriod:  number  // seconds per breathing cycle
}

const neutral: LayerPose = { rotation: 0, yOffset: 0, alpha: 1 }

export const POSES: Record<PetStateId, PoseConfig> = {
  idle: {
    layers: {
      head:         neutral,
      torso:        neutral,
      'front-legs': neutral,
      'rear-legs':  neutral,
      tail:         neutral,
    },
    breathAmp:    1.0,
    breathPeriod: 3.0,
  },

  walking: {
    layers: {
      head:         { rotation: -0.04, yOffset: 0,  alpha: 1 },
      torso:        { rotation: -0.02, yOffset: 0,  alpha: 1 },
      'front-legs': { rotation:  0,    yOffset: 0,  alpha: 1 },  // walk cycle added in tick
      'rear-legs':  { rotation:  0,    yOffset: 0,  alpha: 1 },  // walk cycle added in tick
      tail:         { rotation: -0.15, yOffset: -2, alpha: 1 },
    },
    breathAmp:    0.6,
    breathPeriod: 2.5,
  },

  sleeping: {
    layers: {
      head:         { rotation:  0.35, yOffset:  8, alpha: 1 },
      torso:        { rotation:  0.02, yOffset:  4, alpha: 1 },
      'front-legs': { rotation:  0.25, yOffset:  3, alpha: 1 },
      'rear-legs':  { rotation: -0.08, yOffset:  2, alpha: 1 },
      tail:         { rotation: -0.28, yOffset:  0, alpha: 1 },
    },
    breathAmp:    0.22,
    breathPeriod: 5.0,
  },

  grooming: {
    layers: {
      head:         { rotation:  0.55, yOffset: 0,  alpha: 1 },
      torso:        { rotation:  0,    yOffset: 0,  alpha: 1 },
      'front-legs': { rotation:  0.35, yOffset: -4, alpha: 1 },
      'rear-legs':  { rotation:  0,    yOffset: 0,  alpha: 1 },
      tail:         { rotation:  0.20, yOffset: 0,  alpha: 1 },
    },
    breathAmp:    0.7,
    breathPeriod: 3.0,
  },

  startled: {
    layers: {
      head:         { rotation: -0.30, yOffset: -12, alpha: 1 },
      torso:        { rotation: -0.12, yOffset:  -8, alpha: 1 },
      'front-legs': { rotation: -0.35, yOffset:  -6, alpha: 1 },
      'rear-legs':  { rotation:  0.25, yOffset:  -3, alpha: 1 },
      tail:         { rotation:  0.75, yOffset:  -2, alpha: 1 },
    },
    breathAmp:    0.0,
    breathPeriod: 3.0,
  },

  playing: {
    layers: {
      head:         { rotation: -0.15, yOffset:  -4, alpha: 1 },
      torso:        { rotation: -0.05, yOffset:  -2, alpha: 1 },
      'front-legs': { rotation: -0.28, yOffset:  -5, alpha: 1 },
      'rear-legs':  { rotation:  0.18, yOffset:   0, alpha: 1 },
      tail:         { rotation: -0.45, yOffset:  -1, alpha: 1 },
    },
    breathAmp:    0.85,
    breathPeriod: 2.5,
  },
}
