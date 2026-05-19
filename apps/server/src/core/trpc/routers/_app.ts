import { twinRouter } from '../../../twin/trpc/twin.router'
import { virtualPinRouter } from './virtual-pin'
import { router } from '../index'
import { alertRouter } from './alert'
import { alertRuleRouter } from './alertRule'
import { authRouter } from './auth'
import { healthRecordsRouter } from './health-records'
import { homeGraphRouter } from './home-graph'
import { dataRouter } from './data'
import { deviceRouter } from './device'
import { medicationRouter } from './medication'
import { patientRouter } from './patient'
import { pinRouter } from './pin'
import { userRouter } from './user'

export const appRouter = router({
  auth: authRouter,
  user: userRouter,
  patient: patientRouter,
  pin: pinRouter,
  medication: medicationRouter,
  device: deviceRouter,
  alert: alertRouter,
  data: dataRouter,
  alertRule: alertRuleRouter,
  healthRecords: healthRecordsRouter,
  homeGraph: homeGraphRouter,
  virtualPin: virtualPinRouter,
  twin: twinRouter,
})

export type AppRouter = typeof appRouter
