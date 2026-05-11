import { useMemo } from 'react'
import { trpc } from '../../trpc'

export interface SimPatientData {
  patientId: string
  patientName: string
  posture: string
  heartRate: number | null
  spO2: number | null
  systolicBP: number | null
  diastolicBP: number | null
  pressureGrid: number[][] | null
  ecgWaveform: number[] | null
  alerts: { metric: string; severity: string; message: string }[]
}

const MAX_PATIENTS = 10

export function useSimData(patientIds: string[]) {
  const enabled = patientIds.length > 0

  const paddedIds = useMemo(() => {
    const arr = [...patientIds]
    while (arr.length < MAX_PATIENTS) arr.push('')
    return arr.slice(0, MAX_PATIENTS)
  }, [patientIds.join(',')])

  const queries = paddedIds.map((pid, i) =>
    trpc.data.latest.useQuery(
      { patientId: pid },
      { enabled: enabled && pid !== '' && i < patientIds.length, refetchInterval: 2000 },
    ),
  )

  const alertsQuery = trpc.alert.list.useQuery(
    { pageSize: 50, status: 'active' },
    { enabled, refetchInterval: 3000 },
  )

  const patientData: SimPatientData[] = useMemo(() => {
    const actualCount = patientIds.length
    return queries.slice(0, actualCount).map((q, i) => {
      const vitals = q.data || []
      const gv = (m: string) => vitals.find((v: any) => v.metric === m)

      const postureEv = gv('posture')
      const pressureEv = gv('pressure_grid')
      const ecgEv = gv('ecg_waveform')

      const patientId = patientIds[i] || ''
      const patientAlerts = (alertsQuery.data || [])
        .filter((a: any) => a.patientId === patientId)
        .map((a: any) => ({
          metric: a.metric,
          severity: a.severity,
          message: a.tags?.message || a.metric,
        }))

      return {
        patientId,
        patientName: `患者 ${i + 1}`,
        posture: (postureEv?.tags?.posture as string) || 'lying',
        heartRate: gv('heart_rate')?.value ?? null,
        spO2: gv('spo2')?.value ?? null,
        systolicBP: gv('systolic_bp')?.value ?? null,
        diastolicBP: gv('diastolic_bp')?.value ?? null,
        pressureGrid: (pressureEv?.tags?.grid as number[][]) || null,
        ecgWaveform: (ecgEv?.tags?.waveform as number[]) || null,
        alerts: patientAlerts,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    queries.map((q) => q.dataUpdatedAt).join(','),
    alertsQuery.dataUpdatedAt,
    patientIds.join(','),
  ])

  const isLoading = queries.slice(0, patientIds.length).some((q) => q.isLoading)

  return { patientData, isLoading }
}
