import { create } from 'zustand'

function decodeJwtPayload(token: string): { sub: string; role: string } | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const decoded = JSON.parse(atob(payload))
    return { sub: decoded.sub, role: decoded.role }
  } catch {
    return null
  }
}

function getInitialRole(): string | null {
  const token = localStorage.getItem('token')
  if (!token) return null
  return decodeJwtPayload(token)?.role || null
}

interface AuthState {
  token: string | null
  refreshToken: string | null
  expiresAt: number | null
  role: string | null
  setTokens: (access: string, refresh: string, expiresAt: number) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  refreshToken: localStorage.getItem('refreshToken'),
  expiresAt: Number(localStorage.getItem('expiresAt')) || null,
  role: getInitialRole(),
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
