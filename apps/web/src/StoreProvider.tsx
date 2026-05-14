import { useEffect, useState } from 'react'
import { trpc } from './trpc'
import { usePatientStore } from './store/patients'
import { useRealtime } from './hooks/useRealtime'

export function StoreProvider() {
  const setPatients = usePatientStore((s) => s.setPatients)
  const [wardId, setWardId] = useState<string>('')

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

  const wardStatus = trpc.twin.engine.status.useQuery({}, { refetchInterval: 5000 })

  useEffect(() => {
    const data = wardStatus.data
    if (data && Array.isArray(data)) {
      const wards = data.filter(Boolean) as any[]
      if (!wardId && wards.length > 0) {
        setWardId(wards[0].id)
      }
    }
  }, [wardStatus.data, wardId])

  useRealtime(wardId || undefined)

  const utils = trpc.useUtils()
  useEffect(() => {
    const id = setInterval(() => {
      utils.alert.list.invalidate()
    }, 10000)
    return () => clearInterval(id)
  }, [utils])

  return null
}
