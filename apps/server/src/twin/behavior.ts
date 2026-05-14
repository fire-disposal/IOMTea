export type BehaviorState =
  | 'idle'
  | 'moving'
  | 'acting'
  | 'sleeping'
  | 'eating'
  | 'toilet'
  | 'shower'
  | 'waiting'

export type ActorPosture = 'lying' | 'sitting' | 'standing' | 'walking'

export interface Instruction {
  id: string
  type: 'move_to' | 'move_to_room' | 'use_object' | 'stay' | 'change_posture' | 'idle'
  actorEntityId: string
  params: Record<string, any>
  priority: number
  preemptible: boolean
}

export interface ActorState {
  entityId: string
  tileX: number
  tileY: number
  posture: ActorPosture
  behaviorState: BehaviorState
  currentRoomId: string | null
  activeInstruction: Instruction | null
  instructionQueue: Instruction[]
  targetTileX: number
  targetTileY: number
  path: { x: number; y: number }[]
  pathProgress: number
}

export function createActorState(entityId: string, x: number, y: number, roomId: string | null): ActorState {
  return {
    entityId,
    tileX: x,
    tileY: y,
    posture: 'standing',
    behaviorState: 'idle',
    currentRoomId: roomId,
    activeInstruction: null,
    instructionQueue: [],
    targetTileX: x,
    targetTileY: y,
    path: [],
    pathProgress: 0,
  }
}

export function canTransition(from: BehaviorState, to: BehaviorState): boolean {
  const transitions: Record<BehaviorState, BehaviorState[]> = {
    idle:     ['moving', 'acting', 'sleeping', 'eating', 'toilet', 'shower'],
    moving:   ['idle', 'acting', 'waiting'],
    acting:   ['idle', 'moving'],
    sleeping: ['idle', 'moving'],
    eating:   ['idle', 'moving'],
    toilet:   ['idle', 'moving'],
    shower:   ['idle', 'moving'],
    waiting:  ['moving', 'idle'],
  }
  return transitions[from]?.includes(to) ?? false
}

export function postureForState(state: BehaviorState): ActorPosture {
  switch (state) {
    case 'sleeping': return 'lying'
    case 'eating': return 'sitting'
    case 'moving': return 'walking'
    case 'toilet': return 'sitting'
    case 'shower': return 'standing'
    case 'acting': return 'standing'
    default: return 'standing'
  }
}

export function tickActorMovement(actor: ActorState, speed: number): void {
  if (actor.behaviorState !== 'moving' || actor.path.length === 0) return

  const currentIdx = Math.floor(actor.pathProgress)
  if (currentIdx >= actor.path.length - 1) {
    // Reached destination
    actor.tileX = actor.targetTileX
    actor.tileY = actor.targetTileY
    actor.path = []
    actor.pathProgress = 0
    actor.behaviorState = 'idle'
    actor.posture = 'standing'
    return
  }

  actor.pathProgress += speed
  const nextIdx = Math.floor(actor.pathProgress)
  if (nextIdx < actor.path.length) {
    actor.tileX = actor.path[nextIdx].x
    actor.tileY = actor.path[nextIdx].y
  }
}
