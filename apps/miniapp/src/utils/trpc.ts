import Taro from '@tarojs/taro'
import { TRPCClientError, createTRPCClient, httpLink } from '@trpc/client'

function getApiBase(): string {
  return (Taro.getStorageSync('server_url') as string) || 'http://localhost:3000'
}

export const API_BASE = getApiBase()

function taroFetcher(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString()
  const base = getApiBase()
  const body = init?.body as string | undefined

  return new Promise((resolve, reject) => {
    Taro.request({
      url: url.startsWith('http') ? url : `${base}${url}`,
      method: (init?.method || 'GET') as any,
      header: {
        'content-type': 'application/json',
        ...(init?.headers as Record<string, string>),
      },
      data: body ? JSON.parse(body) : undefined,
      success(res) {
        resolve(
          new Response(JSON.stringify(res.data), {
            status: res.statusCode,
            headers: new Headers(res.header as Record<string, string>),
          }),
        )
      },
      fail(err) {
        reject(new TRPCClientError(err.errMsg || 'Network error'))
      },
    })
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const trpc = createTRPCClient<any>({
  links: [
    httpLink({
      url: `${getApiBase()}/trpc`,
      fetch: taroFetcher as any,
      headers() {
        const token = Taro.getStorageSync('token')
        return token ? { Authorization: `Bearer ${token}` } : {}
      },
    }),
  ],
}) as any

