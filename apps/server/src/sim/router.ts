import { z } from 'zod'
import { inArray } from 'drizzle-orm'
import { router, protectedProcedure } from '../core/trpc/index'
import { requirePermission } from '../core/trpc/middleware/rbac'
import { db } from '../core/db'
import { patients } from '../core/db/schema'
import { startSim, stopSim, setGlobalSpeed, getStatus, getProfileConfig } from './factory'

export const simRouter = router({
  start: protectedProcedure
    .use(requirePermission('patient:write'))
    .input(z.object({ patientIds: z.array(z.string().uuid()), profile: z.string() }))
    .mutation(async ({ input }) => {
      const rows = await db.select({ id: patients.id, name: patients.name })
        .from(patients)
        .where(inArray(patients.id, input.patientIds))
      const nameMap = new Map(rows.map((r) => [r.id, r.name]))
      startSim(db, input.patientIds, nameMap, input.profile)
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
})
