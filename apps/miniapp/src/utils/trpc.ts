import Taro from '@tarojs/taro'
import { TRPCClientError, createTRPCClient, httpLink } from '@trpc/client'

export function getApiBase(): string {
  return (Taro.getStorageSync('server_url') as string) || 'http://localhost:3000'
}

let _client: ReturnType<typeof createTRPCClient> | null = null
let _clientBase = ''

function getClient() {
  const base = getApiBase()
  if (!_client || _clientBase !== base) {
    _clientBase = base
    _client = createTRPCClient<any>({
      links: [
        httpLink({
          url: `${base}/trpc`,
          fetch: taroFetcher,
          headers() {
            const token = Taro.getStorageSync('token')
            return token ? { Authorization: `Bearer ${token}` } : {}
          },
        }),
      ],
    })
  }
  return _client
}

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

export const trpc = new Proxy({} as any, {
  get(_, prop) {
    return (getClient() as any)[prop]
  },
})
