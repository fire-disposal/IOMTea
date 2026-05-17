import type { ReactNode } from 'react'
import { StateEmpty, StateError, StateSkeleton } from './StateComponents'

interface QueryGateProps<T> {
  isLoading: boolean
  isError: boolean
  data: T[] | undefined
  errorMessage: string
  emptyMessage: string
  skeletonCount?: number
  onRetry?: () => void
  emptyAction?: () => void
  emptyActionLabel?: string
  children: (data: T[]) => ReactNode
}

export function QueryGate<T>({
  isLoading,
  isError,
  data,
  errorMessage,
  emptyMessage,
  skeletonCount = 3,
  onRetry,
  emptyAction,
  emptyActionLabel,
  children,
}: QueryGateProps<T>) {
  if (isLoading) return <StateSkeleton count={skeletonCount} />
  if (isError) return <StateError message={errorMessage} onRetry={onRetry} />
  if (!data || data.length === 0) return <StateEmpty message={emptyMessage} action={emptyAction} actionLabel={emptyActionLabel} />
  return <>{children(data)}</>
}