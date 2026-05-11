import { create } from 'zustand'

interface WardState {
  selectedWardId: string
  selectedWardName: string
  setSelectedWard: (id: string, name: string) => void
}

export const useWardStore = create<WardState>((set) => ({
  selectedWardId: '',
  selectedWardName: '',
  setSelectedWard: (id, name) => set({ selectedWardId: id, selectedWardName: name }),
}))
