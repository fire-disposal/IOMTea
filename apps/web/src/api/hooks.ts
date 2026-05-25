import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from './client'
import type { paths } from './types'

type Paths = paths
type ApiClient = typeof api

interface UseApiState<T> {
  data: T | null
  error: string | null
  loading: boolean
  refetch: () => void
}

export function useApiGet<
  P extends keyof Paths,
  M extends keyof Paths[P] & ('get' | 'GET'),
>(
  path: P,
  options?: NonNullable<Parameters<ApiClient['GET']>[1]>,
): UseApiState<unknown> {
  const [data, setData] = useState<unknown>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const optionsRef = useRef(options)

  const fetch = useCallback(() => {
    setLoading(true)
    setError(null)
    ;(api.GET as any)(path, optionsRef.current)
      .then((res: any) => {
        if (res.error) setError(String(res.error))
        else setData(res.data ?? null)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [path])

  useEffect(() => { fetch() }, [fetch])

  return { data, error, loading, refetch: fetch }
}

interface MutationState<T> {
  loading: boolean
  error: string | null
  data: T | null
}

export function useApiMutate<T = unknown>(): {
  state: MutationState<T>
  mutate: (fn: () => Promise<{ data?: T; error?: unknown }>) => Promise<T | null>
  reset: () => void
} {
  const [state, setState] = useState<MutationState<T>>({ loading: false, error: null, data: null })

  const mutate = useCallback(async (fn: () => Promise<{ data?: T; error?: unknown }>) => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const res = await fn()
      if (res.error) {
        setState({ loading: false, error: String(res.error), data: null })
        return null
      }
      setState({ loading: false, error: null, data: (res.data ?? null) as T })
      return (res.data ?? null) as T
    } catch (e) {
      const msg = (e as Error).message
      setState({ loading: false, error: msg, data: null })
      return null
    }
  }, [])

  const reset = useCallback(() => setState({ loading: false, error: null, data: null }), [])

  return { state, mutate, reset }
}
