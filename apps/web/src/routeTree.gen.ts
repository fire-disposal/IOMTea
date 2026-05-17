/* eslint-disable */
// Generated route tree stub for tsc typecheck (real generation by TanStack Router Vite plugin at build time)

import { createRootRoute, createRoute } from '@tanstack/react-router'

const rootRoute = createRootRoute({} as any)

const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/login' } as any)
const authRoute = createRoute({ getParentRoute: () => rootRoute, id: '_auth' } as any)
const authIndexRoute = createRoute({ getParentRoute: () => authRoute, path: '/' } as any)
const authPatientsRoute = createRoute({ getParentRoute: () => authRoute, path: 'patients' } as any)
const authResidentsRoute = createRoute({ getParentRoute: () => authRoute, path: 'residents' } as any)
const authTrendsRoute = createRoute({ getParentRoute: () => authRoute, path: 'trends' } as any)
const authAlertsRoute = createRoute({ getParentRoute: () => authRoute, path: 'alerts' } as any)
const authMedicationsRoute = createRoute({ getParentRoute: () => authRoute, path: 'medications' } as any)
const authAppointmentsRoute = createRoute({ getParentRoute: () => authRoute, path: 'appointments' } as any)
const authIotPinsRoute = createRoute({ getParentRoute: () => authRoute, path: 'iot/pins' } as any)
const authSettingsRoute = createRoute({ getParentRoute: () => authRoute, path: 'settings' } as any)
const authPatientDetailRoute = createRoute({ getParentRoute: () => authRoute, path: 'patients/$id' } as any)
const authPatientIndexRoute = createRoute({ getParentRoute: () => authPatientDetailRoute, path: '/' } as any)
const authPatientAlertsRoute = createRoute({ getParentRoute: () => authPatientDetailRoute, path: 'alerts' } as any)
const authPatientMedicationsRoute = createRoute({ getParentRoute: () => authPatientDetailRoute, path: 'medications' } as any)
const authPatientAppointmentsRoute = createRoute({ getParentRoute: () => authPatientDetailRoute, path: 'appointments' } as any)
const authPatientProfileRoute = createRoute({ getParentRoute: () => authPatientDetailRoute, path: 'profile' } as any)
const authPatientMapEditorRoute = createRoute({ getParentRoute: () => authPatientDetailRoute, path: 'map-editor' } as any)
const authPatientMapRoute = createRoute({ getParentRoute: () => authPatientDetailRoute, path: 'map' } as any)

const routeTree = rootRoute.addChildren([
  loginRoute,
  authRoute.addChildren([
    authIndexRoute, authPatientsRoute, authResidentsRoute, authTrendsRoute,
    authAlertsRoute, authMedicationsRoute, authAppointmentsRoute,
    authIotPinsRoute, authSettingsRoute,
    authPatientDetailRoute.addChildren([
      authPatientIndexRoute, authPatientAlertsRoute, authPatientMedicationsRoute,
      authPatientAppointmentsRoute, authPatientProfileRoute,
      authPatientMapEditorRoute, authPatientMapRoute,
    ]),
  ]),
])

export { routeTree }
