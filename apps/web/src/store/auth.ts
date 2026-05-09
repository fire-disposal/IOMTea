import { create } from 'zustand'

interface AuthState {
  token: string | null
  refreshToken: string | null
  expiresAt: number | null
  setTokens: (access: string, refresh: string, expiresAt: number) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  refreshToken: localStorage.getItem('refreshToken'),
  expiresAt: Number(localStorage.getItem('expiresAt')) || null,
  setTokens: (token, refreshToken, expiresAt) => {
    localStorage.setItem('token', token)
    localStorage.setItem('refreshToken', refreshToken)
    localStorage.setItem('expiresAt', String(expiresAt))
    set({ token, refreshToken, expiresAt })
  },
  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('expiresAt')
    set({ token: null, refreshToken: null, expiresAt: null })
  },
}))
