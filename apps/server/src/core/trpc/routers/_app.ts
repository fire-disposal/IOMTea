import { router } from '../index'
import { alertRouter } from './alert'
import { alertRuleRouter } from './alertRule'
import { authRouter } from './auth'
import { dashboardRouter } from './dashboard'
import { dataRouter } from './data'
import { exportRouter } from './export'
import { homeGraphRouter } from './home-graph'
import { ingestRouter } from './ingest'
import { nodeGraphRouter } from './node-graph'
import { patientRouter } from './patient'
import { pinRouter } from './pin'
import { tagRouter } from './tag'
import { userRouter } from './user'
import { virtualPinRouter } from './virtual-pin'
import { simRouter } from '../../../modules/twin/sim-router'

export const appRouter = router({
  alert: alertRouter,
  alertRule: alertRuleRouter,
  auth: authRouter,
  dashboard: dashboardRouter,
  data: dataRouter,
  export: exportRouter,
  homeGraph: homeGraphRouter,
  ingest: ingestRouter,
  nodeGraph: nodeGraphRouter,
  patient: patientRouter,
  pin: pinRouter,
  sim: simRouter,
  tag: tagRouter,
  user: userRouter,
  virtualPin: virtualPinRouter,
})

export type AppRouter = typeof appRouter
