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
