import { createRoute, createRootRoute, createRouter, Outlet } from '@tanstack/react-router'
import { RootLayout } from './routes/__root'
import { AuthLayout, authBeforeLoad } from './routes/_auth'
import { LoginPage } from './pages/LoginPage'

const rootRoute = createRootRoute({
  component: RootLayout,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_auth',
  beforeLoad: authBeforeLoad,
  component: AuthLayout,
})

const dashboardRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/',
  component: () => <div style={{ padding: 32 }}><h1>IOMTea Dashboard</h1><p>REST API ready</p></div>,
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  authRoute.addChildren([dashboardRoute]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
