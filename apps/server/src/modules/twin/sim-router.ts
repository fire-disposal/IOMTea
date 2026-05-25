import { z } from 'zod'
import { inArray, and, eq, gte, desc } from 'drizzle-orm'
import { router, protectedProcedure } from '../../core/trpc/index'
import { requirePermission } from '../../core/trpc/middleware/rbac'
import { db } from '../../core/db'
import { patients, events } from '../../core/db/schema.js'
import {
  createSimulation,
  deleteSimulation,
  toggleSimulation,
  setSpeed,
  addPatient,
  removePatient,
  getSimulations,
  getSimulation,
  getProfiles,
  getProfileConfig,
  toggleMetric,
  updateMetric,
  renameSim,
  injectScenario,
} from './engine'

const overrideSchema = z.object({
  intervalMin: z.number().min(100).max(600000),
  intervalMax: z.number().min(100).max(600000),
  jitter: z.number().min(0).max(1),
})

export const simRouter = router({
  create: protectedProcedure
    .use(requirePermission('patient:write'))
    .input(
      z.object({
        profile: z.string(),
        name: z.string().optional(),
        overrides: z.record(z.string(), overrideSchema).optional(),
      }),
    )
    .mutation(({ ctx, input }) => createSimulation(ctx.db, { profileName: input.profile, name: input.name })),

  delete: protectedProcedure
    .use(requirePermission('patient:write'))
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => deleteSimulation(ctx.db, input.id)),

  toggle: protectedProcedure
    .use(requirePermission('patient:write'))
    .input(z.object({ id: z.string(), running: z.boolean() }))
    .mutation(({ ctx, input }) => toggleSimulation(ctx.db, input.id, input.running)),

  rename: protectedProcedure
    .use(requirePermission('patient:write'))
    .input(z.object({ id: z.string(), name: z.string().min(1).max(50) }))
    .mutation(({ ctx, input }) => renameSim(ctx.db, input.id, input.name)),

  toggleMetric: protectedProcedure
    .use(requirePermission('patient:write'))
    .input(z.object({ id: z.string(), metric: z.string(), enabled: z.boolean() }))
    .mutation(({ ctx, input }) => toggleMetric(ctx.db, input.id, input.metric, input.enabled)),

  addPatients: protectedProcedure
    .use(requirePermission('patient:write'))
    .input(z.object({ id: z.string(), patientIds: z.array(z.string().uuid()) }))
    .mutation(async ({ ctx, input }) => {
      const rows = await db
        .select({ id: patients.id, name: patients.name })
        .from(patients)
        .where(inArray(patients.id, input.patientIds))
      let added = 0
      for (const p of rows) {
        added += addPatient(ctx.db, input.id, { id: p.id, name: p.name })
      }
      return added
    }),

  removePatients: protectedProcedure
    .use(requirePermission('patient:write'))
    .input(z.object({ id: z.string(), patientIds: z.array(z.string().uuid()) }))
    .mutation(async ({ ctx, input }) => {
      let removed = 0
      for (const pid of input.patientIds) {
        removed += removePatient(ctx.db, input.id, pid)
      }
      return removed
    }),

  setSpeed: protectedProcedure
    .use(requirePermission('patient:write'))
    .input(z.object({ speed: z.number().min(0.1).max(10) }))
    .mutation(({ input }) => {
      setSpeed(input.speed)
      return { ok: true }
    }),

  simulations: protectedProcedure
    .use(requirePermission('patient:read'))
    .query(() => getSimulations()),

  getSimulation: protectedProcedure
    .use(requirePermission('patient:read'))
    .input(z.string())
    .query(({ input }) => getSimulation(input)),

  profiles: protectedProcedure.use(requirePermission('patient:read')).query(() => getProfiles()),

  profileConfig: protectedProcedure
    .use(requirePermission('patient:read'))
    .input(z.string())
    .query(({ input }) => getProfileConfig(input)),

  updateMetric: protectedProcedure
    .use(requirePermission('patient:write'))
    .input(
      z.object({
        id: z.string(),
        metric: z.string(),
        config: z
          .object({
            intervalMin: z.number().min(100).max(600000).optional(),
            intervalMax: z.number().min(100).max(600000).optional(),
            jitter: z.number().min(0).max(1).optional(),
          })
          .optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      updateMetric(ctx.db, input.id, input.metric, input.config ?? {}),
    ),

  injectScenario: protectedProcedure
    .use(requirePermission('patient:write'))
    .input(z.object({ id: z.string(), patientId: z.string().uuid(), type: z.string() }))
    .mutation(({ ctx, input }) => ({
      success: injectScenario(ctx.db, input.id, input.patientId, input.type),
    })),

  events: protectedProcedure
    .use(requirePermission('patient:read'))
    .input(
      z.object({ patientId: z.string().uuid(), minutes: z.number().min(1).max(120).default(10) }),
    )
    .query(async ({ input }) => {
      const since = new Date(Date.now() - input.minutes * 60 * 1000)
      const rows = await db
        .select({
          metric: events.metric,
          value: events.value,
          unit: events.unit,
          recordedAt: events.recordedAt,
        })
        .from(events)
        .where(
          and(
            eq(events.patientId, input.patientId),
            eq(events.source, 'simulator'),
            gte(events.recordedAt, since),
          ),
        )
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
