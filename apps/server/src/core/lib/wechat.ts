import { env } from '../../env'

interface WechatSession {
  openid: string
  session_key: string
  unionid?: string
  errcode?: number
  errmsg?: string
}

interface WechatAccessToken {
  access_token: string
  expires_in: number
  errcode?: number
  errmsg?: string
}

export async function code2session(code: string): Promise<WechatSession> {
  if (!env.WECHAT_APP_ID || !env.WECHAT_APP_SECRET) {
    throw new Error('WECHAT_APP_ID or WECHAT_APP_SECRET is not configured')
  }

  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${env.WECHAT_APP_ID}&secret=${env.WECHAT_APP_SECRET}&js_code=${code}&grant_type=authorization_code`

  const res = await fetch(url)
  const data = (await res.json()) as WechatSession

  if (data.errcode) {
    throw new Error(`WeChat login failed: ${data.errmsg || 'unknown error'} (code: ${data.errcode})`)
  }

  return data
}

export async function getAccessToken(): Promise<WechatAccessToken> {
  if (!env.WECHAT_APP_ID || !env.WECHAT_APP_SECRET) {
    throw new Error('WECHAT_APP_ID or WECHAT_APP_SECRET is not configured')
  }

  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${env.WECHAT_APP_ID}&secret=${env.WECHAT_APP_SECRET}`

  const res = await fetch(url)
  const data = (await res.json()) as WechatAccessToken

  if (data.errcode) {
    throw new Error(`WeChat getAccessToken failed: ${data.errmsg} (code: ${data.errcode})`)
  }

  return data
}
