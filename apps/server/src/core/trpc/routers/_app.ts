import { router } from '../index'
import { alertRouter } from './alert'
import { alertRuleRouter } from './alertRule'
import { authRouter } from './auth'
import { checklistRouter } from './checklist'
import { creditRouter } from './credit'
import { dataRouter } from './data'
import { deviceRouter } from './device'
import { healthRecordsRouter } from './health-records'
import { homeGraphRouter } from './home-graph'
import { medicationRouter } from './medication'
import { nodeGraphRouter } from './node-graph'
import { patientRouter } from './patient'
import { pinRouter } from './pin'
import { planRouter } from './plan'
import { streakRouter } from './streak'
import { userRouter } from './user'
import { virtualPinRouter } from './virtual-pin'
import { simulationRouter } from '../../../twin/trpc/simulation.router'
import { twinRouter } from '../../../twin/trpc/twin.router'

export const appRouter = router({
  alert: alertRouter,
  alertRule: alertRuleRouter,
  auth: authRouter,
  checklist: checklistRouter,
  credit: creditRouter,
  data: dataRouter,
  device: deviceRouter,
  healthRecords: healthRecordsRouter,
  homeGraph: homeGraphRouter,
  medication: medicationRouter,
  nodeGraph: nodeGraphRouter,
  patient: patientRouter,
  pin: pinRouter,
  plan: planRouter,
  simulation: simulationRouter,
  streak: streakRouter,
  twin: twinRouter,
  user: userRouter,
  virtualPin: virtualPinRouter,
})

export type AppRouter = typeof appRouter
