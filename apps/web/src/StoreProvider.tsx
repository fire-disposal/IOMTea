import { useEffect, useState } from 'react'
import { trpc } from './trpc'
import { useRealtime } from './hooks/useRealtime'

export function StoreProvider() {
  const [wardId, setWardId] = useState<string>('')

  const wardStatus = trpc.twin.engine.status.useQuery({}, { refetchInterval: 5000 })

  useEffect(() => {
    const data = wardStatus.data
    if (data && Array.isArray(data)) {
      const wards = data.filter(Boolean) as NonNullable<(typeof data)[number]>[]
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