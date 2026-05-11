import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'

interface WsEvent {
  patientId: string
  deviceId: string
  kind: 'observation' | 'alert'
  metric: string
  value: number | null
  unit: string | null
  severity?: string | null
  status?: string | null
  tags: Record<string, unknown>
  recordedAt: string
}

interface WsMessage {
  type: 'events'
  wardId: string
  events: WsEvent[]
}

export function useRealtime(wardId: string | undefined) {
  const queryClient = useQueryClient()
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const subscribedRef = useRef(false)

  const connect = useCallback(() => {
    if (!wardId) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws?wardId=${encodeURIComponent(wardId)}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      subscribedRef.current = true
    }

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data)
        if (msg.type !== 'events' || !msg.events?.length) return

        const observations = msg.events.filter((e) => e.kind === 'observation')
        const alerts = msg.events.filter((e) => e.kind === 'alert')

        if (observations.length > 0) {
          for (const patientId of [...new Set(observations.map((o) => o.patientId))]) {
            const patientObs = observations.filter((o) => o.patientId === patientId)
            const latestByMetric = new Map<string, WsEvent>()
            for (const obs of patientObs) {
              const existing = latestByMetric.get(obs.metric)
              if (!existing || new Date(obs.recordedAt) > new Date(existing.recordedAt)) {
                latestByMetric.set(obs.metric, obs)
              }
            }
            const latestArr = Array.from(latestByMetric.values()).map((o) => ({
              metric: o.metric,
              value: o.value,
              unit: o.unit,
              tags: o.tags,
              recordedAt: new Date(o.recordedAt).getTime(),
            }))
            queryClient.setQueryData(['data', 'latest', { patientId }], (old: any) => {
              if (!old || !Array.isArray(old)) return latestArr
              const merged = new Map(old.map((v: any) => [v.metric, v]))
              for (const item of latestArr) {
                merged.set(item.metric, item)
              }
              return Array.from(merged.values())
            })
          }
        }

        if (alerts.length > 0) {
          queryClient.setQueryData(
            ['alert', 'list', { pageSize: 50, status: 'active' }],
            (old: any) => {
              const oldAlerts = (old || []) as any[]
              const newAlerts = alerts.map((a) => ({
                id: `${a.patientId}-${a.metric}-${a.recordedAt}`,
                patientId: a.patientId,
                deviceId: a.deviceId,
                kind: 'alert',
                metric: a.metric,
                value: a.value,
                unit: a.unit,
                severity: a.severity,
                status: a.status || 'active',
                tags: a.tags,
                recordedAt: new Date(a.recordedAt).getTime(),
              }))
              const merged = [...newAlerts, ...oldAlerts].slice(0, 50)
              return merged
            },
          )
          queryClient.invalidateQueries({ queryKey: ['alert', 'count'] })
        }
      } catch {
        // ignore parse errors
      }
    }

    ws.onclose = () => {
      subscribedRef.current = false
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      reconnectRef.current = setTimeout(() => connect(), 3000)
    }

    ws.onerror = () => {
      ws.close(1000, 'error')
    }
  }, [wardId, queryClient])

  useEffect(() => {
    if (!wardId) return
    connect()
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close(1000, 'cleanup')
        wsRef.current = null
      }
      subscribedRef.current = false
    }
  }, [wardId, connect])

  return { isConnected: subscribedRef.current }
}
