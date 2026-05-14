import type { Instruction } from './behavior'
import { v4 as uuid } from 'uuid'

interface BehaviorRule {
  id: string
  patientId: string
  ruleType: 'schedule' | 'trigger' | 'routine'
  name: string
  triggerTime: string | null
  triggerCondition: any | null
  actions: { type: string; room?: string; duration?: number; posture?: string }[]
  priority: number
  isEnabled: boolean
}

interface ActorRef {
  entityId: string
  patientId: string
}

export function shouldTrigger(rule: BehaviorRule, currentHourMinute: string): boolean {
  if (!rule.isEnabled) return false
  if (rule.ruleType !== 'schedule') return false
  if (!rule.triggerTime) return false

  return rule.triggerTime === currentHourMinute
}

export function generateInstructions(rule: BehaviorRule, actor: ActorRef): Instruction[] {
  const instructions: Instruction[] = []

  for (let i = 0; i < rule.actions.length; i++) {
    const action = rule.actions[i]
    instructions.push({
      id: uuid(),
      type: action.type as Instruction['type'],
      actorEntityId: actor.entityId,
      params: {
        type: action.type,
        room: action.room,
        duration: action.duration,
        posture: action.posture,
      },
      priority: rule.priority,
      preemptible: action.type !== 'stay',
    })
  }

  return instructions
}

export function tickScheduler(
  rules: BehaviorRule[],
  actors: ActorRef[],
  currentHourMinute: string,
): { actorId: string; instructions: Instruction[] }[] {
  const results: { actorId: string; instructions: Instruction[] }[] = []

  for (const rule of rules) {
    if (!shouldTrigger(rule, currentHourMinute)) continue

    const matchingActors = actors.filter((a) => a.patientId === rule.patientId)
    for (const actor of matchingActors) {
      const instructions = generateInstructions(rule, actor)
      if (instructions.length > 0) {
        results.push({ actorId: actor.entityId, instructions })
      }
    }
  }

  return results
}

export function formatHourMinute(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0')
  const m = date.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}
