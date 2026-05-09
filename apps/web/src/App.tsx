import { useAuthStore } from './store/auth'

function LoginPage() {
  const setTokens = useAuthStore((s) => s.setTokens)
  return (
    <div>
      <h1>IOMTea Login</h1>
    </div>
  )
}

function DashboardPage() {
  const logout = useAuthStore((s) => s.logout)
  return (
    <div>
      <h1>IOMTea Dashboard</h1>
      <button onClick={logout}>Logout</button>
    </div>
  )
}

export function App() {
  const token = useAuthStore((s) => s.token)
  return token ? <DashboardPage /> : <LoginPage />
}
