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


