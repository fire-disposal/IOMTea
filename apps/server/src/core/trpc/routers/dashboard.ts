import { and, count, eq, sql } from 'drizzle-orm'
import { protectedProcedure, router } from '../index'
import { events, patients, devices } from '../../db/schema'
import { getEngineStatus, listEngines } from '../../../twin/engine'

export const dashboardRouter = router({
  summary: protectedProcedure.query(async ({ ctx }) => {
    const [[patientRow], [deviceRow], [alertRow]] = await Promise.all([
      ctx.db.select({ total: count(), active: sql<number>`count(*) filter (where ${patients.status} = 'active')` }).from(patients),
      ctx.db.select({ total: count(), active: sql<number>`count(*) filter (where ${devices.status} = 'active')` }).from(devices),
      ctx.db.select({ total: count(), active: sql<number>`count(*) filter (where ${events.status} = 'active' and ${events.kind} = 'alert')`, critical: sql<number>`count(*) filter (where ${events.status} = 'active' and ${events.kind} = 'alert' and ${events.severity} = 'critical')` }).from(events),
    ])

    const engines = listEngines()

    return {
      patients: { total: Number(patientRow?.total ?? 0), active: Number(patientRow?.active ?? 0) },
      devices: { total: Number(deviceRow?.total ?? 0), active: Number(deviceRow?.active ?? 0) },
      alerts: { total: Number(alertRow?.total ?? 0), active: Number(alertRow?.active ?? 0), critical: Number(alertRow?.critical ?? 0) },
      wards: engines.map((e) => {
        const s = getEngineStatus(e.patientId)
        return { id: e.patientId, name: e.name, running: e.running, speed: e.speed, patientCount: e.actors.size, tick: s?.tickCount ?? 0 }
      }),
    }
  }),
})
