import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'
import { useEntityStateStore } from '../store/entityState'

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

interface EntityStatePayload {
  entityId: string
  state: string
  tileX: number
  tileY: number
  posture: string
}

interface WsMessage {
  type: 'tick'
  wardId: string
  simulatedTime: string
  timezone: string
  hourOfDay: number
  events: WsEvent[]
  entityStates: EntityStatePayload[]
}

export type { EntityStatePayload as EntityState }

export function useRealtime(wardId: string | undefined) {
  const queryClient = useQueryClient()
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const subscribedRef = useRef(false)
  const setStates = useEntityStateStore((s) => s.setStates)
  const setSimTime = useEntityStateStore((s) => s.setSimTime)

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
        if (msg.type !== 'tick') return

        // Update virtual time and entity states via Zustand
        setSimTime({ time: msg.simulatedTime, tz: msg.timezone, hour: msg.hourOfDay })

        const newStates = new Map<string, EntityStatePayload>()
        for (const es of msg.entityStates || []) {
          newStates.set(es.entityId, es)
        }
        setStates(newStates)

        // Update vitals (existing logic)
        const observations = (msg.events || []).filter((e) => e.kind === 'observation')
        const alerts = (msg.events || []).filter((e) => e.kind === 'alert')

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
          queryClient.invalidateQueries({ queryKey: ['alert', 'list'] })
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
