import { describe, it, expect } from 'vitest'
import { enqueueInstruction, processNextInstruction } from './instruction'
import { createActorState, type Instruction } from './behavior'

function makeInstruction(overrides: Partial<Instruction> = {}): Instruction {
  return {
    id: 'inst-1',
    type: 'move_to',
    actorEntityId: 'a1',
    params: { x: 5, y: 5 },
    priority: 5,
    preemptible: true,
    ...overrides,
  }
}

describe('enqueueInstruction', () => {
  it('adds instruction to empty queue', () => {
    const actor = createActorState('a1', 0, 0, null)
    const inst = makeInstruction()
    enqueueInstruction(actor, inst)
    expect(actor.instructionQueue).toHaveLength(1)
    expect(actor.instructionQueue[0].id).toBe('inst-1')
  })

  it('inserts by priority — lower number = higher priority', () => {
    const actor = createActorState('a1', 0, 0, null)
    enqueueInstruction(actor, makeInstruction({ id: 'low', priority: 10 }))
    enqueueInstruction(actor, makeInstruction({ id: 'high', priority: 1 }))
    enqueueInstruction(actor, makeInstruction({ id: 'mid', priority: 5 }))

    expect(actor.instructionQueue.map((i) => i.id)).toEqual(['high', 'mid', 'low'])
  })

  it('appends when all priorities are higher', () => {
    const actor = createActorState('a1', 0, 0, null)
    enqueueInstruction(actor, makeInstruction({ id: 'first', priority: 1 }))
    enqueueInstruction(actor, makeInstruction({ id: 'second', priority: 10 }))
    expect(actor.instructionQueue.map((i) => i.id)).toEqual(['first', 'second'])
  })
})

describe('processNextInstruction', () => {
  it('dequeues and activates first instruction', () => {
    const actor = createActorState('a1', 0, 0, null)
    enqueueInstruction(actor, makeInstruction({ id: 'first' }))
    const next = processNextInstruction(actor)
    expect(next).not.toBeNull()
    expect(next!.id).toBe('first')
    expect(actor.activeInstruction?.id).toBe('first')
    expect(actor.instructionQueue).toHaveLength(0)
  })

  it('returns null when queue is empty', () => {
    const actor = createActorState('a1', 0, 0, null)
    expect(processNextInstruction(actor)).toBeNull()
  })

  it('does not preempt non-preemptible active instruction', () => {
    const actor = createActorState('a1', 0, 0, null)
    actor.activeInstruction = makeInstruction({ id: 'active', preemptible: false })
    enqueueInstruction(actor, makeInstruction({ id: 'waiting' }))
    expect(processNextInstruction(actor)).toBeNull()
    expect(actor.instructionQueue).toHaveLength(1)
  })
})
