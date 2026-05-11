import { create } from 'zustand'

interface WardState {
  selectedWardId: string
  selectedWardName: string
  wardRunning: boolean
  wardSpeed: number
  wardTick: number
  wardPatientCount: number
  wsConnected: boolean
  setSelectedWard: (id: string, name: string) => void
  setWardStatus: (status: { running: boolean; speed: number; tick: number; patientCount: number }) => void
  setWsConnected: (connected: boolean) => void
}

export const useWardStore = create<WardState>((set) => ({
  selectedWardId: '',
  selectedWardName: '',
  wardRunning: false,
  wardSpeed: 1,
  wardTick: 0,
  wardPatientCount: 0,
  wsConnected: false,
  setSelectedWard: (id, name) => set({ selectedWardId: id, selectedWardName: name }),
  setWardStatus: (status) => set({
    wardRunning: status.running,
    wardSpeed: status.speed,
    wardTick: status.tick,
    wardPatientCount: status.patientCount,
  }),
  setWsConnected: (connected) => set({ wsConnected: connected }),
}))
