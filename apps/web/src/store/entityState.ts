import { create } from 'zustand'

export interface EntityState {
  entityId: string
  state: string
  tileX: number
  tileY: number
  posture: string
}

interface EntityStateStore {
  states: Map<string, EntityState>
  simTime: { time: string; tz: string; hour: number } | null
  setStates: (states: Map<string, EntityState>) => void
  setSimTime: (t: { time: string; tz: string; hour: number } | null) => void
}

export const useEntityStateStore = create<EntityStateStore>((set) => ({
  states: new Map(),
  simTime: null,
  setStates: (states) => set({ states }),
  setSimTime: (simTime) => set({ simTime }),
}))
