import { create } from 'zustand'

interface PatientInfo {
  id: string
  name: string
  status: string
}

interface PatientStore {
  patients: PatientInfo[]
  selectedPatientId: string | null
  isLoading: boolean
  setPatients: (patients: PatientInfo[], loading: boolean) => void
  selectPatient: (id: string | null) => void
}

export const usePatientStore = create<PatientStore>((set) => ({
  patients: [],
  selectedPatientId: null,
  isLoading: false,
  setPatients: (patients, isLoading) => set({ patients, isLoading }),
  selectPatient: (id) => set({ selectedPatientId: id }),
}))
