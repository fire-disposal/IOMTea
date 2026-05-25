import { createRoute, createRootRoute, createRouter, useParams } from '@tanstack/react-router'
import { RootLayout } from './routes/__root'
import { AuthLayout, authBeforeLoad } from './routes/_auth'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { DataDashboard } from './pages/DataDashboard'
import { UserManagementPage } from './pages/UserManagementPage'
import { PatientWall } from './pages/PatientWall'
import { PatientDetailShell } from './pages/PatientDetailShell'
import { AlertBoard } from './pages/AlertBoard'
import { PinManagementPage } from './pages/PinManagementPage'
import { SimulationPage } from './pages/SimulationPage'

function PatientDetailWrapper() {
  const { id } = useParams({ from: '/_auth/patients/$id' })
  return <PatientDetailShell patientId={id} />
}

const rootRoute = createRootRoute({ component: RootLayout })

const loginRoute = createRoute({
  getParentRoute: () => rootRoute, path: '/login', component: LoginPage,
})

const authRoute = createRoute({
  getParentRoute: () => rootRoute, id: '_auth', beforeLoad: authBeforeLoad, component: AuthLayout,
})

const dashboardRoute = createRoute({
  getParentRoute: () => authRoute, path: '/', component: DashboardPage,
})

const dataDashboardRoute = createRoute({
  getParentRoute: () => authRoute, path: '/data-dashboard', component: DataDashboard,
})

const patientsRoute = createRoute({
  getParentRoute: () => authRoute, path: '/patients', component: PatientWall,
})

const patientDetailRoute = createRoute({
  getParentRoute: () => authRoute, path: '/patients/$id', component: PatientDetailWrapper,
})

const alertsRoute = createRoute({
  getParentRoute: () => authRoute, path: '/alerts', component: AlertBoard,
})

const pinsRoute = createRoute({
  getParentRoute: () => authRoute, path: '/iot/pins', component: PinManagementPage,
})

const simRoute = createRoute({
  getParentRoute: () => authRoute, path: '/simulation', component: SimulationPage,
})

const usersRoute = createRoute({
  getParentRoute: () => authRoute, path: '/settings/users', component: UserManagementPage,
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  authRoute.addChildren([
    dashboardRoute,
    dataDashboardRoute,
    patientsRoute,
    patientDetailRoute,
    alertsRoute,
    pinsRoute,
    simRoute,
    usersRoute,
  ]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
