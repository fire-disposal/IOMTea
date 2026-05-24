import { z } from 'zod'
import { inArray, and, eq, gte, desc } from 'drizzle-orm'
import { router, protectedProcedure } from '../core/trpc/index'
import { requirePermission } from '../core/trpc/middleware/rbac'
import { db } from '../core/db'
import { patients, events } from '../core/db/schema'
import {
  createSim, updateSim, toggleSim, toggleSimMetric, deleteSim, updateSimMetric, renameSim,
  addPatientsToSim, removePatientsFromSim,
  setGlobalSpeed, getStatus, getSimulations, getProfileConfig,
} from './factory'
import { profiles } from './profiles'

const overrideSchema = z.object({
  intervalMin: z.number().min(100).max(600000),
  intervalMax: z.number().min(100).max(600000),
  jitter: z.number().min(0).max(1),
})

export const simRouter = router({
  create: protectedProcedure
    .use(requirePermission('patient:write'))
    .input(z.object({ profile: z.string(), name: z.string().optional(), overrides: z.record(z.string(), overrideSchema).optional() }))
    .mutation(({ ctx, input }) => createSim(ctx.db, input.profile, input.overrides, input.name)),

  update: protectedProcedure
    .use(requirePermission('patient:write'))
    .input(z.object({ id: z.string(), overrides: z.record(z.string(), overrideSchema) }))
    .mutation(({ input }) => updateSim(input.id, input.overrides)),

  toggle: protectedProcedure
    .use(requirePermission('patient:write'))
    .input(z.object({ id: z.string(), running: z.boolean() }))
    .mutation(({ input }) => toggleSim(input.id, input.running)),

  rename: protectedProcedure
    .use(requirePermission('patient:write'))
    .input(z.object({ id: z.string(), name: z.string().min(1).max(50) }))
    .mutation(({ input }) => renameSim(input.id, input.name)),

  toggleMetric: protectedProcedure
    .use(requirePermission('patient:write'))
    .input(z.object({ id: z.string(), metric: z.string(), enabled: z.boolean() }))
    .mutation(({ input }) => toggleSimMetric(input.id, input.metric, input.enabled)),

  delete: protectedProcedure
    .use(requirePermission('patient:write'))
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => deleteSim(input.id)),

  addPatients: protectedProcedure
    .use(requirePermission('patient:write'))
    .input(z.object({ id: z.string(), patientIds: z.array(z.string().uuid()) }))
    .mutation(async ({ input }) => {
      const rows = await db.select({ id: patients.id, name: patients.name })
        .from(patients)
        .where(inArray(patients.id, input.patientIds))
      return addPatientsToSim(db, input.id, rows)
    }),

  removePatients: protectedProcedure
    .use(requirePermission('patient:write'))
    .input(z.object({ id: z.string(), patientIds: z.array(z.string().uuid()) }))
    .mutation(({ input }) => removePatientsFromSim(input.id, input.patientIds)),

  setSpeed: protectedProcedure
    .use(requirePermission('patient:write'))
    .input(z.object({ speed: z.number().min(0.1).max(10) }))
    .mutation(({ input }) => { setGlobalSpeed(input.speed); return { ok: true } }),

  simulations: protectedProcedure
    .use(requirePermission('patient:read'))
    .query(() => getSimulations()),

  status: protectedProcedure
    .use(requirePermission('patient:read'))
    .query(() => getStatus()),

  profileConfig: protectedProcedure
    .use(requirePermission('patient:read'))
    .input(z.string())
    .query(({ input }) => getProfileConfig(input)),

  profiles: protectedProcedure
    .use(requirePermission('patient:read'))
    .query(() => {
      return Object.entries(profiles).map(([key, p]) => ({
        name: p.name,
        label: p.label,
        baselines: p.baselines,
        conditions: p.conditions,
        metrics: p.metrics.map((m) => ({ metric: m.metric, unit: m.unit, interval: m.interval, jitter: m.jitter })),
      }))
    }),

  getSimulation: protectedProcedure
    .use(requirePermission('patient:read'))
    .input(z.string())
    .query(({ input }) => {
      const sims = getSimulations()
      return sims.find((s) => s.id === input) ?? null
    }),

  updateMetric: protectedProcedure
    .use(requirePermission('patient:write'))
    .input(z.object({
      id: z.string(),
      metric: z.string(),
      config: z.object({
        intervalMin: z.number().min(100).max(600000).optional(),
        intervalMax: z.number().min(100).max(600000).optional(),
        jitter: z.number().min(0).max(1).optional(),
      }).optional(),
    }))
    .mutation(({ input }) => updateSimMetric(input.id, input.metric, input.config ?? {})),

  events: protectedProcedure
    .use(requirePermission('patient:read'))
    .input(z.object({ patientId: z.string().uuid(), minutes: z.number().min(1).max(120).default(10) }))
    .query(async ({ input }) => {
      const since = new Date(Date.now() - input.minutes * 60 * 1000)
      const rows = await db
        .select({ metric: events.metric, value: events.value, unit: events.unit, recordedAt: events.recordedAt })
        .from(events)
        .where(and(eq(events.patientId, input.patientId), eq(events.source, 'simulator'), gte(events.recordedAt, since)))
        .orderBy(desc(events.recordedAt))
        .limit(500)
      return rows.map((r) => ({ metric: r.metric, value: r.value, unit: r.unit, recordedAt: r.recordedAt.getTime() }))
    }),
})
