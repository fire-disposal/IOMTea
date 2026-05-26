import Taro from '@tarojs/taro'
import { STORAGE_KEYS } from '../constants/storage-keys'
import { api } from './api'

const PLAN_STORAGE_KEY = STORAGE_KEYS.PLAN_CACHE

export const trpc = {
  patient: {
    list: {
      query: (args?: { pageSize?: number; status?: string }) =>
        api.get('/patients', args as Record<string, string | number | undefined>),
    },
  },
  data: {
    latest: {
      query: (args: { patientId: string }) =>
        api.get('/data/latest', args as Record<string, string | number | undefined>),
    },
    raw: {
      query: (args: { patientId: string; metric?: string; from?: string; limit?: number }) =>
        api.get('/data/raw', args as Record<string, string | number | undefined>),
    },
  },
  alert: {
    list: {
      query: (args?: { patientId?: string; severity?: string; status?: string; pageSize?: number }) =>
        api.get('/alerts', args as Record<string, string | number | undefined>),
    },
  },
  device: {
    list: {
      query: (_args?: { pageSize?: number }) =>
        api.get('/pins'),
    },
  },
  credit: {
    transactions: {
      query: (args?: { page?: number; pageSize?: number; userId?: string }) =>
        api.get('/credits/transactions', args as Record<string, string | number | undefined>),
    },
    balance: {
      query: () =>
        api.get<{ balance: number }>('/credits/balance'),
    },
  },
  pin: {
    list: {
      query: () =>
        api.get('/pins'),
    },
    getByUser: {
      query: (_args: { userId: string }) =>
        api.get('/pins'),
    },
    create: {
      mutate: (args: { userId: string; type?: string; label?: string; nickname?: string }) =>
        api.post('/pins', { userId: args.userId, type: args.type ?? 'device', label: args.label ?? args.nickname }),
    },
    delete: {
      mutate: (args: { code: string }) =>
        api.delete(`/pins/${args.code}`),
    },
  },
  plan: {
    list: {
      query: () =>
        api.get('/plans'),
    },
    get: {
      query: () => {
        const cached = Taro.getStorageSync(PLAN_STORAGE_KEY)
        return Promise.resolve(cached || { items: [] })
      },
    },
    detail: {
      query: (args: { id: string }) =>
        api.get(`/plans/${args.id}`),
    },
    today: {
      query: (args: { patientId: string }) =>
        api.get('/plans/today', args as Record<string, string | number | undefined>),
    },
    upsert: {
      mutate: (args: { items: unknown[] }) => {
        Taro.setStorageSync(PLAN_STORAGE_KEY, { items: args.items })
        return Promise.resolve({ success: true })
      },
    },
    complete: {
      mutate: (args: { id: string; patientId: string; userId?: string }) =>
        api.post(`/plans/${args.id}/complete`, args),
    },
  },
  user: {
    me: {
      query: () =>
        api.get('/users/me'),
    },
  },
  settings: {
    tracking: {
      query: () => {
        const cached = Taro.getStorageSync(STORAGE_KEYS.TRACKING_CONFIG)
        return Promise.resolve(cached || {})
      },
      mutate: (args: unknown) => {
        Taro.setStorageSync(STORAGE_KEYS.TRACKING_CONFIG, args)
        return Promise.resolve({ success: true })
      },
    },
    goals: {
      query: () => {
        const cached = Taro.getStorageSync(STORAGE_KEYS.HEALTH_GOALS)
        return Promise.resolve(cached || {})
      },
      mutate: (args: unknown) => {
        Taro.setStorageSync(STORAGE_KEYS.HEALTH_GOALS, args)
        return Promise.resolve({ success: true })
      },
    },
  },
} as const
