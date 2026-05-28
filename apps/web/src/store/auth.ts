import { create } from 'zustand'

interface JwtDecoded {
  sub: string
  role: string
  exp: number
  iat?: number
}

export function decodeJwtPayload(token: string): JwtDecoded | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    return JSON.parse(atob(payload))
  } catch {
    return null
  }
}

function isTokenExpired(token: string): boolean {
  const decoded = decodeJwtPayload(token)
  if (!decoded?.exp) return true // no exp claim = treat as expired
  return Date.now() > decoded.exp * 1000
}

function getInitialAuth() {
  const token = localStorage.getItem('token')
  const refreshToken = localStorage.getItem('refreshToken')
  const expiresAt = Number(localStorage.getItem('expiresAt')) || null

  if (!token) return { token: null, refreshToken: null, expiresAt: null, role: null }

  if (isTokenExpired(token)) {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('expiresAt')
    return { token: null, refreshToken: null, expiresAt: null, role: null }
  }

  const decoded = decodeJwtPayload(token)
  return {
    token,
    refreshToken,
    expiresAt,
    role: decoded?.role || null,
  }
}

interface AuthState {
  token: string | null
  refreshToken: string | null
  expiresAt: number | null
  role: string | null
  setTokens: (access: string, refresh: string, expiresAt: number) => void
  logout: () => void
}

const initial = getInitialAuth()

export const useAuthStore = create<AuthState>((set) => ({
  token: initial.token,
  refreshToken: initial.refreshToken,
  expiresAt: initial.expiresAt,
  role: initial.role,
  setTokens: (token, refreshToken, expiresAt) => {
    localStorage.setItem('token', token)
    localStorage.setItem('refreshToken', refreshToken)
    localStorage.setItem('expiresAt', String(expiresAt))
    const payload = decodeJwtPayload(token)
    set({ token, refreshToken, expiresAt, role: payload?.role || null })
  },
  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('expiresAt')
    set({ token: null, refreshToken: null, expiresAt: null, role: null })
  },
}))
