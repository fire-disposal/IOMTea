import { SignJWT, jwtVerify } from 'jose'
import { env } from '../../env'

const secret = new TextEncoder().encode(env.JWT_SECRET)
const alg = 'HS256'

export interface JwtPayload {
  sub: string
  role: string
}

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/)
  if (!match) throw new Error(`Invalid duration: ${duration}`)
  const value = Number.parseInt(match[1])
  switch (match[2]) {
    case 's': return value
    case 'm': return value * 60
    case 'h': return value * 3600
    case 'd': return value * 86400
    default: return value
  }
}

export async function signAccessToken(payload: JwtPayload): Promise<string> {
  const expiresIn = parseDuration(env.JWT_EXPIRES_IN)
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(secret)
}

export async function signRefreshToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const expiresIn = parseDuration(env.JWT_REFRESH_EXPIRES_IN)
  const token = await new SignJWT({})
    .setProtectedHeader({ alg })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .setJti(crypto.randomUUID())
    .sign(secret)
  const expiresAt = new Date(Date.now() + expiresIn * 1000)
  return { token, expiresAt }
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, secret)
  return payload as unknown as JwtPayload
}
