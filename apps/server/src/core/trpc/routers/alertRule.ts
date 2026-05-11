import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { patients } from '../../db/schema'
import { protectedProcedure, router } from '../index'
import { DEFAULT_THRESHOLDS } from './thresholds'

const ruleSchema = z.object({
  metric: z.string(),
  min: z.number().optional(),
  max: z.number().optional(),
  enabled: z.boolean().default(true),
  label: z.string().optional(),
  unit: z.string().optional(),
})

export const alertRuleRouter = router({
  byPatient: protectedProcedure
    .input(z.object({ patientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [patient] = await ctx.db
        .select({ tags: patients.tags })
        .from(patients)
        .where(eq(patients.id, input.patientId))
        .limit(1)

      const tags = (patient?.tags as Record<string, unknown>) || {}
      const customThresholds = (tags.customThresholds as z.infer<typeof ruleSchema>[]) || []
      const profileId = (tags.profileId as string) || ''

      const defaults =
        profileId && profileId in DEFAULT_THRESHOLDS
          ? DEFAULT_THRESHOLDS[profileId as keyof typeof DEFAULT_THRESHOLDS]
          : []

      const merged = defaults.map((d) => {
        const custom = customThresholds.find(
          (c: z.infer<typeof ruleSchema>) => c.metric === d.metric,
        )
        return custom || d
      })

      return merged
    }),

  upsert: protectedProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
        rules: z.array(ruleSchema),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [patient] = await ctx.db
        .select({ tags: patients.tags })
        .from(patients)
        .where(eq(patients.id, input.patientId))
        .limit(1)

      const currentTags = (patient?.tags as Record<string, unknown>) || {}
      const newTags = { ...currentTags, customThresholds: input.rules }

      await ctx.db.update(patients).set({ tags: newTags }).where(eq(patients.id, input.patientId))

      return { success: true }
    }),
})
