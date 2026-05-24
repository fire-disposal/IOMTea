import { z } from 'zod'
import { inArray, and, eq, gte, desc } from 'drizzle-orm'
import { router, protectedProcedure } from '../core/trpc/index'
import { requirePermission } from '../core/trpc/middleware/rbac'
import { db } from '../core/db'
import { patients, events } from '../core/db/schema'
import { startSim, stopSim, setGlobalSpeed, getStatus, getProfileConfig } from './factory'

const overrideSchema = z.object({
  intervalMin: z.number().min(100).max(600000),
  intervalMax: z.number().min(100).max(600000),
  jitter: z.number().min(0).max(1),
})

export const simRouter = router({
  start: protectedProcedure
    .use(requirePermission('patient:write'))
    .input(z.object({
      patientIds: z.array(z.string().uuid()),
      profile: z.string(),
      overrides: z.record(z.string(), overrideSchema).optional(),
    }))
    .mutation(async ({ input }) => {
      const rows = await db.select({ id: patients.id, name: patients.name })
        .from(patients)
        .where(inArray(patients.id, input.patientIds))
      const nameMap = new Map(rows.map((r) => [r.id, r.name]))
      startSim(db, input.patientIds, nameMap, input.profile, input.overrides)
      return { ok: true, count: input.patientIds.length }
    }),

  stop: protectedProcedure
    .use(requirePermission('patient:write'))
    .input(z.object({ patientIds: z.array(z.string().uuid()) }))
    .mutation(({ input }) => {
      stopSim(input.patientIds)
      return { ok: true, count: input.patientIds.length }
    }),

  setSpeed: protectedProcedure
    .use(requirePermission('patient:write'))
    .input(z.object({ speed: z.number().min(0.1).max(10) }))
    .mutation(({ input }) => {
      setGlobalSpeed(input.speed)
      return { ok: true }
    }),

  status: protectedProcedure
    .use(requirePermission('patient:read'))
    .query(() => getStatus()),

  profileConfig: protectedProcedure
    .use(requirePermission('patient:read'))
    .input(z.string())
    .query(({ input }) => getProfileConfig(input)),

  events: protectedProcedure
    .use(requirePermission('patient:read'))
    .input(z.object({ patientId: z.string().uuid(), minutes: z.number().min(1).max(120).default(10) }))
    .query(async ({ input }) => {
      const since = new Date(Date.now() - input.minutes * 60 * 1000)
      const rows = await db
        .select({ metric: events.metric, value: events.value, unit: events.unit, recordedAt: events.recordedAt })
        .from(events)
        .where(and(
          eq(events.patientId, input.patientId),
          eq(events.source, 'simulator'),
          gte(events.recordedAt, since),
        ))
        .orderBy(desc(events.recordedAt))
        .limit(500)
      return rows.map((r) => ({
        metric: r.metric,
        value: r.value,
        unit: r.unit,
        recordedAt: r.recordedAt.getTime(),
      }))
    }),
})
