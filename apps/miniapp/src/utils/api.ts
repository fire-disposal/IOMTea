import Taro from '@tarojs/taro'

function getBase(): string {
  const customUrl = Taro.getStorageSync('api_base_url') as string
  if (customUrl) return customUrl
  // @ts-ignore — injected by Taro build
  if (typeof API_BASE_URL !== 'undefined') return API_BASE_URL as string
  return 'http://localhost:3000'
}

function getToken(): string | null {
  return (Taro.getStorageSync('token') as string) || null
}

async function request<T>(
  path: string,
  options: {
    method?: string
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

  const headers = (t: string | null) =>
    t
      ? { Authorization: `Bearer ${t}`, 'content-type': 'application/json' }
      : { 'content-type': 'application/json' }

  let resp = await Taro.request({
    url,
    method: method as any,
    header: headers(token),
    data: body ?? undefined,
  })

  if (resp.statusCode === 401) {
    const refreshToken = Taro.getStorageSync('refresh_token') as string | null
    if (refreshToken) {
      try {
        const refreshResp = await Taro.request({
          url: `${base}/auth/refresh`,
          method: 'POST',
          data: { refreshToken },
          header: { 'content-type': 'application/json' },
        })
        if (refreshResp.statusCode === 200) {
          const data = refreshResp.data as { accessToken: string; refreshToken: string }
          Taro.setStorageSync('token', data.accessToken)
          if (data.refreshToken) Taro.setStorageSync('refresh_token', data.refreshToken)
          token = data.accessToken
          resp = await Taro.request({
            url,
            method: method as any,
            header: headers(token),
            data: body ?? undefined,
          })
          return resp.data as T
        }
      } catch {}
    }
    Taro.removeStorageSync('token')
    Taro.removeStorageSync('refresh_token')
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
