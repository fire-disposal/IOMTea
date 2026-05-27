import Taro from '@tarojs/taro'
import { STORAGE_KEYS } from '../constants/storage-keys'

declare const API_BASE_URL: string | undefined

function getBase(): string {
  const customUrl = Taro.getStorageSync(STORAGE_KEYS.SERVER_URL) as string
  if (customUrl) return customUrl
  if (typeof API_BASE_URL !== 'undefined') return API_BASE_URL
  return 'http://localhost:3000'
}

function getToken(): string | null {
  return (Taro.getStorageSync(STORAGE_KEYS.TOKEN) as string) || null
}

type TaroMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

async function request<T>(
  path: string,
  options: {
    method?: TaroMethod
    body?: unknown
    params?: Record<string, string | number | undefined>
  } = {},
): Promise<T> {
  const { method = 'GET', body, params } = options
  const base = getBase()
  let token = getToken()

  let url = `${base}${path}`
  if (params) {
    const parts: string[] = []
    for (const k of Object.keys(params)) {
      const v = params[k]
      if (v !== undefined) parts.push(`${k}=${encodeURIComponent(String(v))}`)
    }
    if (parts.length > 0) url += `?${parts.join('&')}`
  }

  const authHeader = (t: string | null) =>
    t
      ? { Authorization: `Bearer ${t}`, 'content-type': 'application/json' }
      : { 'content-type': 'application/json' }

  let resp = await Taro.request({
    url,
    method,
    header: authHeader(token),
    data: body ?? undefined,
  })

  if (resp.statusCode === 401) {
    const refreshToken = Taro.getStorageSync(STORAGE_KEYS.REFRESH_TOKEN) as string | null
    if (refreshToken) {
      try {
        const refreshResp = await Taro.request({
          url: `${base}/auth/refresh`,
          method: 'POST' as TaroMethod,
          data: { refreshToken },
          header: { 'content-type': 'application/json' },
        })
        if (refreshResp.statusCode === 200) {
          const data = refreshResp.data as { accessToken: string; refreshToken: string }
          Taro.setStorageSync(STORAGE_KEYS.TOKEN, data.accessToken)
          if (data.refreshToken) Taro.setStorageSync(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken)
          token = data.accessToken
          resp = await Taro.request({
            url,
            method,
            header: authHeader(token),
            data: body ?? undefined,
          })
          return resp.data as T
        }
      } catch {}
    }
    Taro.removeStorageSync(STORAGE_KEYS.TOKEN)
    Taro.removeStorageSync(STORAGE_KEYS.REFRESH_TOKEN)
    Taro.reLaunch({ url: '/pages/login/index' })
    throw new Error('Unauthorized')
  }

  return resp.data as T
}

export const api = {
  get: <T>(path: string, params?: Record<string, string | number | undefined>) =>
    request<T>(path, { params }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
