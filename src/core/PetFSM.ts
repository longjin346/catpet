import { assign, setup } from 'xstate'
import { getPersonality } from './personality'

export interface PetContext {
  walkTargetX: number
  screenW:     number
}

export type PetEvent =
  | { type: 'STARTLE' }
  | { type: 'ARRIVED' }

function pickWalkTarget(screenW: number): number {
  const margin = 80
  return margin + Math.random() * (screenW - margin * 2)
}

export const petMachine = setup({
  types: {} as {
    context: PetContext
    events:  PetEvent
    input:   { screenW: number }
  },

  delays: {
    IDLE_TIMEOUT:    () => (7000  + Math.random() * 9000)  * getPersonality().idleMultiplier,
    WALK_TIMEOUT:    () => (8000  + Math.random() * 4000)  * getPersonality().walkMultiplier,
    SLEEP_TIMEOUT:   () => (18000 + Math.random() * 14000) * getPersonality().sleepMultiplier,
    GROOM_TIMEOUT:   () => (6000  + Math.random() * 6000)  * getPersonality().groomMultiplier,
    PLAY_TIMEOUT:    () => (8000  + Math.random() * 6000)  * getPersonality().playMultiplier,
    STARTLE_TIMEOUT: 700,
  },

  guards: {
    shouldWalk:  () => Math.random() < getPersonality().shouldWalkProb,
    shouldPlay:  () => Math.random() < getPersonality().shouldPlayProb,
    shouldSleep: () => Math.random() < getPersonality().shouldSleepProb,
    shouldGroom: () => Math.random() < getPersonality().shouldGroomProb,
  },

  actions: {
    pickWalkTarget: assign({
      walkTargetX: ({ context }) => pickWalkTarget(context.screenW),
    }),
  },

}).createMachine({
  id: 'pet',

  context: ({ input }) => ({
    walkTargetX: (input?.screenW ?? 800) / 2,
    screenW:     input?.screenW ?? 800,
  }),

  // STARTLE interrupts any state and jumps to startled
  on: {
    STARTLE: { target: '#pet.startled' },
  },

  initial: 'idle',
  states: {

    idle: {
      after: { IDLE_TIMEOUT: 'choosingAction' },
    },

    choosingAction: {
      always: [
        { target: 'walking',  guard: 'shouldWalk',  actions: 'pickWalkTarget' },
        { target: 'playing',  guard: 'shouldPlay'  },
        { target: 'sleeping', guard: 'shouldSleep' },
        { target: 'grooming', guard: 'shouldGroom' },
        { target: 'idle' },
      ],
    },

    walking: {
      on: { ARRIVED: 'idle' },
      after: { WALK_TIMEOUT: 'idle' },
    },

    sleeping: {
      after: { SLEEP_TIMEOUT: 'idle' },
    },

    grooming: {
      after: { GROOM_TIMEOUT: 'idle' },
    },

    playing: {
      after: { PLAY_TIMEOUT: 'idle' },
    },

    startled: {
      after: { STARTLE_TIMEOUT: 'idle' },
    },
  },
})
