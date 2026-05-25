import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  useParams,
} from '@tanstack/react-router'
import { AlertBoard } from './pages/AlertBoard'
import { DashboardPage } from './pages/DashboardPage'
import { DataDashboard } from './pages/DataDashboard'
import { DataExportPage } from './pages/DataExportPage'
import { HealthTimeline } from './pages/HealthTimeline'
import { LoginPage } from './pages/LoginPage'
import { PatientAlertRules } from './pages/PatientAlertRules'
import { PatientAlerts } from './pages/PatientAlerts'
import { PatientDetailShell } from './pages/PatientDetailShell'
import { PatientProfile } from './pages/PatientProfile'
import { PatientWall } from './pages/PatientWall'
import { PinManagementPage } from './pages/PinManagementPage'
import { PlanManagementPage } from './pages/PlanManagementPage'
import { SimulationPage } from './pages/SimulationPage'
import { NodeGraph } from './components/NodeGraph'
import { UserManagementPage } from './pages/UserManagementPage'
import { RootLayout } from './routes/__root'
import { AuthLayout, authBeforeLoad } from './routes/_auth'

const rootRoute = createRootRoute({ component: RootLayout })

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
  component: DashboardPage,
})

const dataDashboardRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/data-dashboard',
  component: DataDashboard,
})

const dataExportRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/data-export',
  component: DataExportPage,
})

const patientsRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/patients',
  component: PatientWall,
})

const patientDetailRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/patients/$id',
  component: PatientDetailShell,
})

const pOverviewRoute = createRoute({
  getParentRoute: () => patientDetailRoute,
  path: '/',
})

const pProfileRoute = createRoute({
  getParentRoute: () => patientDetailRoute,
  path: '/profile',
  component: PatientProfile,
})

const pAlertsRoute = createRoute({
  getParentRoute: () => patientDetailRoute,
  path: '/alerts',
  component: PatientAlerts,
})

const pRulesRoute = createRoute({
  getParentRoute: () => patientDetailRoute,
  path: '/alert-rules',
  component: PatientAlertRules,
})

const pTimelineRoute = createRoute({
  getParentRoute: () => patientDetailRoute,
  path: '/health-timeline',
  component: HealthTimeline,
})

const alertsRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/alerts',
  component: AlertBoard,
})

const pinsRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/iot/pins',
  component: PinManagementPage,
})

const simRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/simulation',
  component: SimulationPage,
})

const usersRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/settings/users',
  component: UserManagementPage,
})

const nodeGraphRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/node-graph',
  component: NodeGraph,
})

const plansRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/plans',
  component: PlanManagementPage,
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  authRoute.addChildren([
    dashboardRoute,
    dataDashboardRoute,
    dataExportRoute,
    patientsRoute,
    patientDetailRoute.addChildren([
      pOverviewRoute,
      pProfileRoute,
      pAlertsRoute,
      pRulesRoute,
      pTimelineRoute,
    ]),
    alertsRoute,
    pinsRoute,
    simRoute,
    usersRoute,
    nodeGraphRoute,
    plansRoute,
  ]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
