export type SlotRole = 'primary' | 'face' | 'sleep' | 'action' | 'back' | 'texture'

export interface SlotDefinition {
  role: SlotRole
  label: string
  required: boolean
  emoji: string
  headline: string
  tip: string
}

export const SLOTS: SlotDefinition[] = [
  {
    role: 'primary',
    label: 'Side View',
    required: true,
    emoji: '🐱',
    headline: 'Side or 3/4 view — full body',
    tip: 'Full body visible head-to-tail. Cat standing or sitting from the side.',
  },
  {
    role: 'face',
    label: 'Face',
    required: false,
    emoji: '😺',
    headline: 'Front-facing, eyes visible',
    tip: 'Looking at the camera, ears up. Makes the face layer much more lifelike.',
  },
  {
    role: 'sleep',
    label: 'Sleep',
    required: false,
    emoji: '😴',
    headline: 'Curled up or resting',
    tip: 'Loaf pose, curled ball, lying flat — any resting position. Used as-is for the sleep state.',
  },
  {
    role: 'action',
    label: 'Action',
    required: false,
    emoji: '🐈',
    headline: 'Stretching or jumping',
    tip: 'Reaching up, pouncing, yawning — any dynamic pose. Used as-is for the play/stretch states.',
  },
  {
    role: 'back',
    label: 'Back View',
    required: false,
    emoji: '🔙',
    headline: 'Rear or top-down view',
    tip: 'Walking away from you, or looking down at them. Used for away-facing walk frames.',
  },
  {
    role: 'texture',
    label: 'Fur Close-up',
    required: false,
    emoji: '🔍',
    headline: 'Close-up of fur markings',
    tip: 'Zoom into their coat pattern — stripes, spots, tabby lines. Improves texture fidelity.',
  },
]

export interface CatConfig {
  name: string
  photoSlots: Partial<Record<SlotRole, string>> // slot → file basename (e.g. "primary.png")
  createdAt: number
  updatedAt: number
}

export type ValidationIssueType =
  | 'no_cat'
  | 'too_dark'
  | 'too_blurry'
  | 'too_cropped'
  | 'too_small'

export interface ValidationIssue {
  type: ValidationIssueType
  message: string
  severity: 'error' | 'warning'
}

export interface ValidationResult {
  passed: boolean
  issues: ValidationIssue[]
}
