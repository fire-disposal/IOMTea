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

interface PersonLocationMsg {
  type: 'person_location'
  patientId: string
  roomId: string | null
  fromRoomId?: string
  path?: string[]
  event: string
  timestamp: number
}

interface VitalsUpdateMsg {
  type: 'vitals_update'
  patientId: string
  metrics: { metric: string; value: number | null; unit: string | null }[]
  timestamp: number
}

export type { EntityStatePayload as EntityState }

export function useRealtime(wardId: string | undefined, mapId?: string, patientId?: string) {
  const queryClient = useQueryClient()
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const subscribedRef = useRef(false)
  const setStates = useEntityStateStore((s) => s.setStates)
  const setSimTime = useEntityStateStore((s) => s.setSimTime)
  const mapIdRef = useRef(mapId)
  const patientIdRef = useRef(patientId)

  const connect = useCallback(() => {
    if (!wardId && !patientIdRef.current) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const token = localStorage.getItem('token')
    const params = new URLSearchParams()
    if (wardId) params.set('wardId', wardId)
    if (patientIdRef.current) params.set('patientId', patientIdRef.current)
    if (token) params.set('token', token)
    const wsUrl = `${protocol}//${window.location.host}/ws?${params.toString()}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      subscribedRef.current = true
      if (mapIdRef.current) {
        ws.send(JSON.stringify({ type: 'subscribe_twin', mapId: mapIdRef.current }))
      }
      if (patientIdRef.current) {
        ws.send(JSON.stringify({ type: 'subscribe_patient', patientId: patientIdRef.current }))
      }
    }

    ws.onmessage = (event) => {
      try {
        const msg: any = JSON.parse(event.data)

        if (msg.type === 'person_location') {
          const pl: PersonLocationMsg = msg
          queryClient.setQueryData(
            ['homeGraph', 'get', { patientId: pl.patientId }],
            (old: any) => {
              if (!old) return old
              return { ...old, personLocation: pl.roomId, trajectory: old.trajectory || [] }
            },
          )
        } else if (msg.type === 'vitals_update') {
          const vu: VitalsUpdateMsg = msg
          queryClient.setQueryData(
            ['data', 'latest', { patientId: vu.patientId }],
            vu.metrics.map((m) => ({
              metric: m.metric,
              value: m.value,
              unit: m.unit,
              recordedAt: vu.timestamp,
            })),
          )
        } else if (msg.type === 'tick') {
          setSimTime({ time: msg.simulatedTime, tz: msg.timezone, hour: msg.hourOfDay })
          const newStates = new Map<string, EntityStatePayload>()
          for (const es of msg.entityStates || []) newStates.set(es.entityId, es)
          setStates(newStates)

          const observations = (msg.events || []).filter((e: any) => e.kind === 'observation')
          const alerts = (msg.events || []).filter((e: any) => e.kind === 'alert')

          if (observations.length > 0) {
            for (const pid of [...new Set(observations.map((o: any) => o.patientId))]) {
              const patientObs = observations.filter((o: any) => o.patientId === pid)
              const latestByMetric = new Map<string, any>()
              for (const obs of patientObs) {
                const existing = latestByMetric.get(obs.metric)
                if (!existing || new Date(obs.recordedAt) > new Date(existing.recordedAt))
                  latestByMetric.set(obs.metric, obs)
              }
              const latestArr = Array.from(latestByMetric.values()).map((o: any) => ({
                metric: o.metric,
                value: o.value,
                unit: o.unit,
                tags: o.tags,
                recordedAt: new Date(o.recordedAt).getTime(),
              }))
              queryClient.setQueryData(['data', 'latest', { patientId: pid }], (old: any) => {
                if (!old || !Array.isArray(old)) return latestArr
                const merged = new Map(old.map((v: any) => [v.metric, v]))
                for (const item of latestArr) merged.set(item.metric, item)
                return Array.from(merged.values())
              })
            }
          }
          if (alerts.length > 0) queryClient.invalidateQueries({ queryKey: ['alert', 'list'] })
        }
      } catch {
        /* ignore parse errors */
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
    mapIdRef.current = mapId
    patientIdRef.current = patientId
    if (!wardId && !patientId) return
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
  }, [wardId, patientId, connect])

  return { isConnected: subscribedRef.current }
}
