import { assign, setup } from 'xstate'
import { getPersonality } from './personality'

export interface PetContext {
  walkTargetX: number
  screenW:     number
  energy:      number  // 0–100; decreases over time, restored by sleep
  happiness:   number  // 0–100; decreases over time, restored by play
}

export type PetEvent =
  | { type: 'STARTLE' }
  | { type: 'ARRIVED' }
  | { type: 'PLAY_NEAR' }
  | { type: 'FEED' }
  | { type: 'HUNGRY' }
  | { type: 'ENERGY_TICK' }  // sent every ~60 s from PetView

function pickWalkTarget(screenW: number): number {
  const margin = 80
  return margin + Math.random() * (screenW - margin * 2)
}

function nightSleepBoost(): number {
  const h = new Date().getHours()
  return h >= 22 || h < 7 ? 2.2 : 1.0
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
    SIT_TIMEOUT:     () =>  8000  + Math.random() * 12000,
    SLEEP_TIMEOUT:   () => (18000 + Math.random() * 14000) * getPersonality().sleepMultiplier,
    STRETCH_TIMEOUT: 2200,
    GROOM_TIMEOUT:   () => (6000  + Math.random() * 6000)  * getPersonality().groomMultiplier,
    PLAY_TIMEOUT:    () => (8000  + Math.random() * 6000)  * getPersonality().playMultiplier,
    STARTLE_TIMEOUT: 700,
    HUNGRY_TIMEOUT:  () => 5_400_000,  // 90 minutes
    HUNGRY_AUTO_END: 300_000,          // hungry auto-resolves after 5 min if not fed
  },

  guards: {
    shouldWalk:  () => Math.random() < getPersonality().shouldWalkProb,
    shouldPlay:  ({ context }) =>
      Math.random() < getPersonality().shouldPlayProb * (0.4 + context.happiness / 140),
    shouldSleep: ({ context }) =>
      Math.random() < getPersonality().shouldSleepProb * (1 + (100 - context.energy) / 100) * nightSleepBoost(),
    shouldGroom: () => Math.random() < getPersonality().shouldGroomProb,
  },

  actions: {
    pickWalkTarget: assign({
      walkTargetX: ({ context }) => pickWalkTarget(context.screenW),
    }),
    tickEnergy: assign({
      energy:    ({ context }) => Math.max(0, context.energy    - 2),
      happiness: ({ context }) => Math.max(0, context.happiness - 1),
    }),
    restoreEnergy: assign({
      energy: ({ context }) => Math.min(100, context.energy + 40),
    }),
    boostHappiness: assign({
      happiness: ({ context }) => Math.min(100, context.happiness + 20),
    }),
  },

}).createMachine({
  id: 'pet',

  context: ({ input }) => ({
    walkTargetX: (input?.screenW ?? 800) / 2,
    screenW:     input?.screenW ?? 800,
    energy:      100,
    happiness:   80,
  }),

  // STARTLE and PLAY_NEAR interrupt any state
  on: {
    STARTLE:     { target: '#pet.startled' },
    PLAY_NEAR:   { target: '#pet.playing', actions: 'boostHappiness' },
    ENERGY_TICK: { actions: 'tickEnergy' },
    HUNGRY:      { target: '#pet.hungry' },
  },

  initial: 'idle',
  states: {

    idle: {
      after: { IDLE_TIMEOUT: 'choosingAction' },
    },

    choosingAction: {
      always: [
        { target: 'walking',  guard: 'shouldWalk',  actions: 'pickWalkTarget' },
        { target: 'playing',  guard: 'shouldPlay',  actions: 'boostHappiness' },
        { target: 'sleeping', guard: 'shouldSleep' },
        { target: 'grooming', guard: 'shouldGroom' },
        { target: 'idle' },
      ],
    },

    walking: {
      on:    { ARRIVED: { target: 'sitting' } },
      after: { WALK_TIMEOUT: 'sitting' },
    },

    sitting: {
      after: { SIT_TIMEOUT: 'idle' },
    },

    sleeping: {
      entry: 'restoreEnergy',
      after: { SLEEP_TIMEOUT: 'stretching' },
    },

    stretching: {
      after: { STRETCH_TIMEOUT: 'idle' },
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

    hungry: {
      on:    { FEED: { target: 'idle' } },
      after: { HUNGRY_AUTO_END: 'idle' },
    },
  },
})
