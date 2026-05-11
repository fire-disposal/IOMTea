import { simulatorRouter } from '../../../simulator/trpc/simulator'
import { router } from '../index'
import { alertRouter } from './alert'
import { alertRuleRouter } from './alertRule'
import { authRouter } from './auth'
import { dataRouter } from './data'
import { deviceRouter } from './device'
import { mapConfigRouter } from './mapConfig'
import { patientRouter } from './patient'
import { userRouter } from './user'

export const appRouter = router({
  auth: authRouter,
  user: userRouter,
  patient: patientRouter,
  device: deviceRouter,
  alert: alertRouter,
  data: dataRouter,
  alertRule: alertRuleRouter,
  mapConfig: mapConfigRouter,
  simulator: simulatorRouter,
})

export type AppRouter = typeof appRouter
