export type PersonalityId = 'chill' | 'playful' | 'lazy' | 'curious'

export interface PersonalityConfig {
  label:           string
  description:     string
  idleMultiplier:  number
  sleepMultiplier: number
  walkMultiplier:  number
  groomMultiplier: number
  playMultiplier:  number
  walkSpeedMult:   number
  shouldWalkProb:  number
  shouldPlayProb:  number
  shouldSleepProb: number
  shouldGroomProb: number
}

export const PERSONALITY_IDS: PersonalityId[] = ['chill', 'playful', 'lazy', 'curious']

export const PERSONALITIES: Record<PersonalityId, PersonalityConfig> = {
  chill: {
    label:           'Chill',
    description:     'Balanced, easygoing. Does a bit of everything.',
    idleMultiplier:  1.0,
    sleepMultiplier: 1.0,
    walkMultiplier:  1.0,
    groomMultiplier: 1.0,
    playMultiplier:  1.0,
    walkSpeedMult:   1.0,
    shouldWalkProb:  0.40,
    shouldPlayProb:  0.30,
    shouldSleepProb: 0.35,
    shouldGroomProb: 0.45,
  },
  playful: {
    label:           'Playful',
    description:     'Energetic and active. Loves to run around and play.',
    idleMultiplier:  0.6,
    sleepMultiplier: 0.5,
    walkMultiplier:  0.8,
    groomMultiplier: 0.8,
    playMultiplier:  1.4,
    walkSpeedMult:   1.4,
    shouldWalkProb:  0.45,
    shouldPlayProb:  0.55,
    shouldSleepProb: 0.15,
    shouldGroomProb: 0.25,
  },
  lazy: {
    label:           'Lazy',
    description:     'A champion napper. Sleeps most of the day.',
    idleMultiplier:  1.6,
    sleepMultiplier: 2.5,
    walkMultiplier:  1.3,
    groomMultiplier: 0.9,
    playMultiplier:  0.7,
    walkSpeedMult:   0.6,
    shouldWalkProb:  0.20,
    shouldPlayProb:  0.15,
    shouldSleepProb: 0.65,
    shouldGroomProb: 0.50,
  },
  curious: {
    label:           'Curious',
    description:     'Always on the move, exploring every corner.',
    idleMultiplier:  0.65,
    sleepMultiplier: 0.7,
    walkMultiplier:  0.85,
    groomMultiplier: 0.9,
    playMultiplier:  1.0,
    walkSpeedMult:   1.25,
    shouldWalkProb:  0.60,
    shouldPlayProb:  0.35,
    shouldSleepProb: 0.20,
    shouldGroomProb: 0.30,
  },
}

let _active: PersonalityConfig = PERSONALITIES.chill

export function setPersonality(id: PersonalityId): void {
  _active = PERSONALITIES[id] ?? PERSONALITIES.chill
}

export function getPersonality(): PersonalityConfig {
  return _active
}
