import { z } from 'zod'
import { protectedProcedure, router } from '../../core/trpc/index'
import { requirePermission } from '../../core/trpc/middleware/rbac'
import {
  startEngine,
  stopEngine,
  setSpeed,
  getEngineStatus,
  listEngines,
  injectScenario,
} from '../engine'
import { SCENARIO_TYPES } from '../types'

export const twinRouter = router({
  engine: router({
    pause: protectedProcedure
      .use(requirePermission('twin:manage'))
      .input(z.object({ patientId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        stopEngine(input.patientId)
        return { success: true }
      }),

    resume: protectedProcedure
      .use(requirePermission('twin:manage'))
      .input(z.object({ patientId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        await startEngine(ctx.db, input.patientId)
        return { success: true }
      }),

    setSpeed: protectedProcedure
      .use(requirePermission('twin:manage'))
      .input(z.object({ patientId: z.string().uuid(), speed: z.number().min(0.1).max(60) }))
      .mutation(async ({ ctx, input }) => {
        const ok = setSpeed(input.patientId, input.speed)
        return { success: ok, speed: input.speed }
      }),

    status: protectedProcedure
      .use(requirePermission('twin:read'))
      .input(z.object({ patientId: z.string().uuid().optional() }))
      .query(async ({ ctx, input }) => {
        if (input.patientId) return getEngineStatus(input.patientId) ?? null
        return listEngines()
          .map((e) => getEngineStatus(e.patientId))
          .filter(Boolean)
      }),

    injectScenario: protectedProcedure
      .use(requirePermission('twin:manage'))
      .input(z.object({ patientId: z.string().uuid(), type: z.enum(SCENARIO_TYPES) }))
      .mutation(async ({ ctx, input }) => {
        const ok = await injectScenario(ctx.db, input.patientId, input.type)
        return { success: ok }
      }),
  }),
})
