import { createRoute, createRootRoute, createRouter, Outlet, useParams } from '@tanstack/react-router'
import { RootLayout } from './routes/__root'
import { AuthLayout, authBeforeLoad } from './routes/_auth'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { DataDashboard } from './pages/DataDashboard'
import { DataExportPage } from './pages/DataExportPage'
import { UserManagementPage } from './pages/UserManagementPage'
import { PatientWall } from './pages/PatientWall'
import { PatientDetailShell } from './pages/PatientDetailShell'
import { PatientProfile } from './pages/PatientProfile'
import { PatientAlerts } from './pages/PatientAlerts'
import { PatientAlertRules } from './pages/PatientAlertRules'
import { HealthTimeline } from './pages/HealthTimeline'
import { AlertBoard } from './pages/AlertBoard'
import { PinManagementPage } from './pages/PinManagementPage'
import { SimulationPage } from './pages/SimulationPage'

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

const dataExportRoute = createRoute({
  getParentRoute: () => authRoute, path: '/data-export', component: DataExportPage,
})

const patientsRoute = createRoute({
  getParentRoute: () => authRoute, path: '/patients', component: PatientWall,
})

function PatLayout() { return <PatientDetailShell patientId={useParams({ from: '/_auth/patients/$id' }).id}><Outlet /></PatientDetailShell> }

const patientDetailRoute = createRoute({
  getParentRoute: () => authRoute, path: '/patients/$id', component: PatLayout,
})

const pOverviewRoute = createRoute({
  getParentRoute: () => patientDetailRoute, path: '/', component: function Overview() {
    return <PatientDetailShell patientId={useParams({ from: '/_auth/patients/$id' }).id} />
  },
})

const pProfileRoute = createRoute({
  getParentRoute: () => patientDetailRoute, path: '/profile',
  component: function Profile() { return <PatientProfile patientId={useParams({ from: '/_auth/patients/$id' }).id} /> },
})

const pAlertsRoute = createRoute({
  getParentRoute: () => patientDetailRoute, path: '/alerts',
  component: function Alerts() { return <PatientAlerts patientId={useParams({ from: '/_auth/patients/$id' }).id} /> },
})

const pRulesRoute = createRoute({
  getParentRoute: () => patientDetailRoute, path: '/alert-rules',
  component: function Rules() { return <PatientAlertRules patientId={useParams({ from: '/_auth/patients/$id' }).id} /> },
})

const pTimelineRoute = createRoute({
  getParentRoute: () => patientDetailRoute, path: '/health-timeline',
  component: function Timeline() { return <HealthTimeline patientId={useParams({ from: '/_auth/patients/$id' }).id} /> },
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
    dataExportRoute,
    patientsRoute,
    patientDetailRoute.addChildren([
      pOverviewRoute, pProfileRoute, pAlertsRoute, pRulesRoute, pTimelineRoute,
    ]),
    alertsRoute,
    pinsRoute,
    simRoute,
    usersRoute,
  ]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' { interface Register { router: typeof router } }
