import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { http } from './client'

/**
 * Typed GET query hook with React Query.
 * Auto-extracts response.data, handles loading/error states.
 */
export function useGet<T>(path: string, params?: Record<string, unknown>, queryKey?: string[]) {
  return useQuery<T>({
    queryKey: queryKey ?? [path, JSON.stringify(params ?? {})],
    queryFn: () => http.get(path, { params }).then((r) => r.data as T),
  })
}

/**
 * Typed POST mutation with auto-toast and query invalidation.
 */
export function usePost<T = unknown, B = unknown>(path: string, invalidateKeys?: string[]) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body?: B) => http.post(path, body).then((r) => r.data as T),
    onSuccess: () => {
      notifications.show({ title: '操作成功', color: 'green', message: undefined })
      invalidateKeys?.forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
    },
    onError: (e: Error) => {
      notifications.show({ title: '操作失败', message: e.message || '未知错误', color: 'red' })
    },
  })
}

/**
 * Typed PATCH mutation with auto-toast and query invalidation.
 */
export function usePatch<T = unknown, B = unknown>(path: string, invalidateKeys?: string[]) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & B) =>
      http.patch(path.replace(':id', id), body).then((r) => r.data as T),
    onSuccess: () => {
      notifications.show({ title: '更新成功', color: 'green', message: undefined })
      invalidateKeys?.forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
    },
    onError: (e: Error) => {
      notifications.show({ title: '更新失败', message: e.message || '未知错误', color: 'red' })
    },
  })
}

/**
 * Typed DELETE mutation with auto-toast and query invalidation.
 */
export function useDelete<T = unknown>(path: string, invalidateKeys?: string[]) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => http.delete(path.replace(':id', id)).then((r) => r.data as T),
    onSuccess: () => {
      notifications.show({ title: '删除成功', color: 'green', message: undefined })
      invalidateKeys?.forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
    },
    onError: (e: Error) => {
      notifications.show({ title: '删除失败', message: e.message || '未知错误', color: 'red' })
    },
  })
}

/**
 * Typed PUT mutation with auto-toast and query invalidation.
 */
export function usePut<T = unknown, B = unknown>(path: string, invalidateKeys?: string[]) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & B) =>
      http.put(path.replace(':id', id), body).then((r) => r.data as T),
    onSuccess: () => {
      notifications.show({ title: '保存成功', color: 'green', message: undefined })
      invalidateKeys?.forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
    },
    onError: (e: Error) => {
      notifications.show({ title: '保存失败', message: e.message || '未知错误', color: 'red' })
    },
  })
}
