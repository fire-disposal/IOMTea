import { createRoute, createRootRoute, createRouter, Outlet } from '@tanstack/react-router'
import { RootLayout } from './routes/__root'
import { AuthLayout, authBeforeLoad } from './routes/_auth'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { DataDashboard } from './pages/DataDashboard'
import { DataExportPage } from './pages/DataExportPage'
import { PinManagementPage } from './pages/PinManagementPage'
import { UserManagementPage } from './pages/UserManagementPage'
import { SimPage } from './modules/twin/pages/SimulationPage'
import { PatientWall } from './modules/monitor/pages/PatientWall'
import { AlertBoard } from './modules/monitor/pages/AlertBoard'
import { PatientDetailShell } from './modules/monitor/pages/PatientDetailShell'
import { PatientOverview } from './modules/monitor/pages/PatientOverview'
import { PatientAlerts } from './modules/monitor/pages/PatientAlerts'
import { PatientAlertRules } from './modules/monitor/pages/PatientAlertRules'
import { PatientProfile } from './modules/monitor/pages/PatientProfile'
import { HealthTimeline } from './modules/monitor/pages/HealthTimeline'
import { GraphEditorPage } from './modules/twin/components/twin3d/GraphEditorPage'
import { useParams } from '@tanstack/react-router'

function MapEditorPage() {
  const { id } = useParams({ from: '/_auth/patients/$id' })
  return <GraphEditorPage patientId={id} />
}

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
  component: DashboardPage,
})

const patientsRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/patients',
  component: PatientWall,
})

const patientDetailRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/patients/$id',
  component: () => (
    <PatientDetailShell>
      <Outlet />
    </PatientDetailShell>
  ),
})

const pOverviewRoute = createRoute({
  getParentRoute: () => patientDetailRoute,
  path: '/',
  component: PatientOverview,
})

const pAlertsRoute = createRoute({
  getParentRoute: () => patientDetailRoute,
  path: '/alerts',
  component: PatientAlerts,
})

const pAlertRulesRoute = createRoute({
  getParentRoute: () => patientDetailRoute,
  path: '/alert-rules',
  component: function AlertRulesWrapper() {
    const { id } = useParams({ from: '/_auth/patients/$id' })
    return <PatientAlertRules patientId={id} />
  },
})

const pProfileRoute = createRoute({
  getParentRoute: () => patientDetailRoute,
  path: '/profile',
  component: PatientProfile,
})

const pTimelineRoute = createRoute({
  getParentRoute: () => patientDetailRoute,
  path: '/health-timeline',
  component: HealthTimeline,
})

const pMapRoute = createRoute({
  getParentRoute: () => patientDetailRoute,
  path: '/map-editor',
  component: MapEditorPage,
})

const alertsRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/alerts',
  component: AlertBoard,
})

const dataDashRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/data-dashboard',
  component: DataDashboard,
})

const dataExportRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/data-export',
  component: DataExportPage,
})

const simRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/simulation',
  component: SimPage,
})

const pinsRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/iot/pins',
  component: PinManagementPage,
})

const usersRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/settings/users',
  component: UserManagementPage,
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  authRoute.addChildren([
    dashboardRoute,
    patientsRoute,
    patientDetailRoute.addChildren([
      pOverviewRoute,
      pAlertsRoute,
      pAlertRulesRoute,
      pProfileRoute,
      pTimelineRoute,
      pMapRoute,
    ]),
    alertsRoute,
    dataDashRoute,
    dataExportRoute,
    simRoute,
    pinsRoute,
    usersRoute,
  ]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}