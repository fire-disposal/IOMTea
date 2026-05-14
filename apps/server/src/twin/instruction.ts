import type { Instruction, ActorState } from './behavior'

export function enqueueInstruction(actor: ActorState, instruction: Instruction): void {
  const insertAt = actor.instructionQueue.findIndex((i) => i.priority > instruction.priority)
  if (insertAt === -1) {
    actor.instructionQueue.push(instruction)
  } else {
    actor.instructionQueue.splice(insertAt, 0, instruction)
  }
}

export function processNextInstruction(actor: ActorState): Instruction | null {
  if (actor.activeInstruction && !actor.activeInstruction.preemptible) {
    return null
  }

  const next = actor.instructionQueue.shift()
  if (next) {
    actor.activeInstruction = next
    return next
  }

  return null
}

export function completeInstruction(actor: ActorState): void {
  actor.activeInstruction = null
}

export function clearQueue(actor: ActorState): void {
  actor.instructionQueue = []
}

export function peekQueue(actor: ActorState): Instruction[] {
  return [...actor.instructionQueue]
}
