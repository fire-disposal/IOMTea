import { db } from './index'

export function values<T extends Record<string, unknown>>(data: T): T {
  return data
}
