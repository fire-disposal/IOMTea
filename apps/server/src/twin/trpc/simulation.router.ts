import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { listProfiles } from '../profiles'
import {
  createEngine,
  startEngine,
  stopEngine,
  getEngine,
  getEngineStatus,
  listEngines,
} from '../engine'
import { patients } from '../../core/db/schema.js'
import { requirePermission } from '../../core/trpc/middleware/rbac'
import { protectedProcedure, router } from '../../core/trpc/index'

export const simulationRouter = router({
  listProfiles: protectedProcedure.use(requirePermission('twin:read')).query(async () => {
    return listProfiles()
  }),

  listSimulations: protectedProcedure.use(requirePermission('twin:read')).query(async ({ ctx }) => {
    const engines = listEngines()
    const results = []
    for (const engine of engines) {
      const [patient] = await ctx.db
        .select({ name: patients.name })
        .from(patients)
        .where(eq(patients.id, engine.patientDbId))
        .limit(1)
        .catch(() => [])
      results.push({
        ...getEngineStatus(engine.patientId),
        name: patient?.name ?? engine.name,
        profileId: engine.profile.id,
        profileName: engine.profile.name,
      })
    }
    return results
  }),

  create: protectedProcedure
    .use(requirePermission('twin:manage'))
    .input(
      z.object({
        profileId: z.string().min(1),
        name: z.string().min(1).max(100),
        speed: z.number().min(0.1).max(60).default(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const engine = await createEngine(ctx.db as any, {
          profileId: input.profileId,
          name: input.name,
          speed: input.speed,
        })
        await startEngine(ctx.db as any, engine.patientId)
        return getEngineStatus(engine.patientId)
      } catch (e: any) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: e?.message || '创建失败' })
      }
    }),

  delete: protectedProcedure
    .use(requirePermission('twin:manage'))
    .input(z.object({ patientId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      stopEngine(input.patientId)
      await ctx.db
        .delete(patients)
        .where(eq(patients.id, input.patientId))
        .catch(() => {})
      return { success: true }
    }),
})
