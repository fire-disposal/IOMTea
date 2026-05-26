import { useEffect, useRef } from 'react'

type VitalsCallback = (data: {
  patientId: string
  metrics: { metric: string; value: number; unit: string | null }[]
}) => void
type AlertCallback = (data: {
  patientId: string
  alert: { metric: string; value: unknown; severity: string }
}) => void

interface RealtimeOptions {
  patientId?: string
  onVitals?: VitalsCallback
  onAlert?: AlertCallback
}

export function useRealtime({ patientId, onVitals, onAlert }: RealtimeOptions) {
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    const url = `ws://localhost:3000/ws?token=${token}${patientId ? `&patientId=${patientId}` : ''}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      if (patientId) {
        ws.send(JSON.stringify({ type: 'subscribe_patient', patientId }))
      }
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'vitals' && onVitals) {
          onVitals(data)
        }
        if (data.type === 'alert' && onAlert) {
          onAlert(data)
        }
      } catch {}
    }

    ws.onerror = () => {}

    return () => {
      ws.close()
    }
  }, [patientId])

  return wsRef
}
