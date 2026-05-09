import { router } from '../index'
import { authRouter } from './auth'
import { userRouter } from './user'
import { patientRouter } from './patient'
import { deviceRouter } from './device'
import { alertRouter } from './alert'
import { dataRouter } from './data'

export const appRouter = router({
  auth: authRouter,
  user: userRouter,
  patient: patientRouter,
  device: deviceRouter,
  alert: alertRouter,
  data: dataRouter,
})

export type AppRouter = typeof appRouter
