import { useEffect } from 'react'
import { trpc } from './trpc'
import { usePatientStore } from './store/patients'
import { useWardStore } from './store/ward'
import { useRealtime } from './hooks/useRealtime'

export function StoreProvider() {
  const setPatients = usePatientStore((s) => s.setPatients)
  const selectedWardId = useWardStore((s) => s.selectedWardId)
  const setWardStatus = useWardStore((s) => s.setWardStatus)
  const setWsConnected = useWardStore((s) => s.setWsConnected)

  // Single patient list query — feeds all pages
  const patientsQuery = trpc.patient.list.useQuery(
    { pageSize: 100, status: 'active' },
    { refetchInterval: 15000 },
  )

  useEffect(() => {
    if (patientsQuery.data !== undefined) {
      const list = (patientsQuery.data as any[]).map((p: any) => ({
        id: p.id,
        name: p.name,
        status: p.status || 'active',
      }))
      setPatients(list, patientsQuery.isLoading)
    }
  }, [patientsQuery.data, patientsQuery.isLoading, setPatients])

  // Single ward status query
  const wardStatus = trpc.simulator.status.useQuery(undefined, { refetchInterval: 5000 })

  useEffect(() => {
    const data = wardStatus.data
    if (data) {
      const wards = Array.isArray(data) ? data : [data]
      if (wards.length > 0 && !selectedWardId) {
        useWardStore.getState().setSelectedWard(wards[0].id, wards[0].name)
      }
      const current = wards.find((w: any) => w.id === useWardStore.getState().selectedWardId) || wards[0]
      if (current) {
        setWardStatus({
          running: current.running,
          speed: current.speed,
          tick: current.tick,
          patientCount: current.patientCount,
        })
      }
    }
  }, [wardStatus.data, selectedWardId, setWardStatus])

  // Single WebSocket connection
  const { isConnected } = useRealtime(selectedWardId || undefined)

  useEffect(() => {
    setWsConnected(isConnected)
  }, [isConnected, setWsConnected])

  // Invalidate alert count periodically
  const utils = trpc.useUtils()
  useEffect(() => {
    const id = setInterval(() => {
      utils.alert.list.invalidate()
    }, 10000)
    return () => clearInterval(id)
  }, [utils])

  return null
}
