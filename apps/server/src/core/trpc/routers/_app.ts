import { nodeGraphRouter } from './node-graph'
import { twinRouter } from '../../../twin/trpc/twin.router'
import { simulationRouter } from '../../../twin/trpc/simulation.router'
import { virtualPinRouter } from './virtual-pin'
import { router } from '../index'
import { alertRouter } from './alert'
import { alertRuleRouter } from './alertRule'
import { authRouter } from './auth'
import { checklistRouter } from './checklist'
import { creditRouter } from './credit'
import { healthRecordsRouter } from './health-records'
import { homeGraphRouter } from './home-graph'
import { dataRouter } from './data'
import { deviceRouter } from './device'
import { medicationRouter } from './medication'
import { patientRouter } from './patient'
import { pinRouter } from './pin'
import { planRouter } from './plan'
import { streakRouter } from './streak'
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
  plan: planRouter,
  checklist: checklistRouter,
  credit: creditRouter,
  streak: streakRouter,
  alertRule: alertRuleRouter,
  healthRecords: healthRecordsRouter,
  homeGraph: homeGraphRouter,
  virtualPin: virtualPinRouter,
  twin: twinRouter,
  simulation: simulationRouter,
  nodeGraph: nodeGraphRouter,
})

export type AppRouter = typeof appRouter
