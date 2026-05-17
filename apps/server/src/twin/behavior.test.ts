import { describe, it, expect } from 'vitest'
import { createActorState, tickActorMovement, type ActorState } from './behavior'

describe('createActorState', () => {
  it('creates actor with defaults', () => {
    const actor = createActorState('test-1', 5, 10, 'room-a')
    expect(actor.entityId).toBe('test-1')
    expect(actor.tileX).toBe(5)
    expect(actor.tileY).toBe(10)
    expect(actor.currentRoomId).toBe('room-a')
    expect(actor.behaviorState).toBe('idle')
    expect(actor.posture).toBe('standing')
    expect(actor.instructionQueue).toEqual([])
    expect(actor.path).toEqual([])
    expect(actor.pathProgress).toBe(0)
  })
})



describe('tickActorMovement', () => {
  function makeActor(overrides: Partial<ActorState> = {}): ActorState {
    return {
      entityId: 'a1',
      tileX: 0, tileY: 0,
      posture: 'standing',
      behaviorState: 'moving',
      currentRoomId: null,
      activeInstruction: null,
      instructionQueue: [],
      targetTileX: 2, targetTileY: 0,
      path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
      pathProgress: 0,
      ...overrides,
    }
  }

  it('moves actor along path', () => {
    const actor = makeActor()
    tickActorMovement(actor, 0.5)
    expect(actor.pathProgress).toBe(0.5)
    expect(actor.tileX).toBe(0)
  })

  it('advances position when progress crosses tile boundary', () => {
    const actor = makeActor()
    tickActorMovement(actor, 1.5)
    expect(actor.pathProgress).toBe(1.5)
    expect(actor.tileX).toBe(1)
  })

  it('reaches destination and transitions to idle', () => {
    // path is [{0,0},{1,0},{2,0}], length=3. pathProgress=2 means on last tile.
    const actor = makeActor({ pathProgress: 2 })
    tickActorMovement(actor, 1)
    expect(actor.behaviorState).toBe('idle')
    expect(actor.posture).toBe('standing')
    expect(actor.path).toEqual([])
    expect(actor.pathProgress).toBe(0)
  })

  it('does nothing when not moving', () => {
    const actor = makeActor({ behaviorState: 'idle' })
    tickActorMovement(actor, 1)
    expect(actor.tileX).toBe(0)
    expect(actor.pathProgress).toBe(0)
  })

  it('does nothing with empty path', () => {
    const actor = makeActor({ path: [] })
    tickActorMovement(actor, 1)
    expect(actor.behaviorState).toBe('moving')
  })
})
