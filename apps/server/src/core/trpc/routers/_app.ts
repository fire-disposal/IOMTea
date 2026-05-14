import { twinRouter } from '../../../twin/trpc/twin.router'
import { router } from '../index'
import { alertRouter } from './alert'
import { alertRuleRouter } from './alertRule'
import { appointmentRouter } from './appointment'
import { authRouter } from './auth'
import { dashboardRouter } from './dashboard'
import { dataRouter } from './data'
import { deviceRouter } from './device'
import { medicationRouter } from './medication'
import { patientRouter } from './patient'
import { userRouter } from './user'

export const appRouter = router({
  auth: authRouter,
  user: userRouter,
  patient: patientRouter,
  medication: medicationRouter,
  appointment: appointmentRouter,
  device: deviceRouter,
  alert: alertRouter,
  data: dataRouter,
  alertRule: alertRuleRouter,
  dashboard: dashboardRouter,
  twin: twinRouter,
})

export type AppRouter = typeof appRouter
