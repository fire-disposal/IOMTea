import { twinRouter } from '../../../twin/trpc/twin.router'
import { router } from '../index'
import { alertRouter } from './alert'
import { alertRuleRouter } from './alertRule'
import { appointmentRouter } from './appointment'
import { authRouter } from './auth'
import { homeMapRouter } from './home-map'
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
  appointment: appointmentRouter,
  device: deviceRouter,
  alert: alertRouter,
  data: dataRouter,
  alertRule: alertRuleRouter,
  homeMap: homeMapRouter,
  twin: twinRouter,
})

export type AppRouter = typeof appRouter
