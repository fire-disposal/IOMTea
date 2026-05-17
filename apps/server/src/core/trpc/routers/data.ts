import {
  eventTimeSeriesInputSchema,
  observationSchema,
} from '@iomtea/shared-types'
import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { z } from 'zod'
import { events } from '../../db/schema'
import { protectedProcedure, router } from '../index'

export const dataRouter = router({
  timeseries: protectedProcedure.input(eventTimeSeriesInputSchema).query(async ({ ctx, input }) => {
    const conditions = [
      eq(events.patientId, input.patientId),
      eq(events.metric, input.metric),
      eq(events.kind, 'observation'),
      gte(events.recordedAt, new Date(input.from)),
    ]
    if (input.to) {
      conditions.push(lte(events.recordedAt, new Date(input.to)))
    }

    const rows = await ctx.db
      .select({
        recordedAt: events.recordedAt,
        value: events.value,
        unit: events.unit,
        tags: events.tags,
      })
      .from(events)
      .where(and(...conditions))
      .orderBy(events.recordedAt)
      .limit(1000)

    return z
      .array(observationSchema.pick({ recordedAt: true, value: true, unit: true, tags: true }))
      .parse(
        rows.map((r) => ({
          recordedAt: r.recordedAt.getTime(),
          value: r.value,
          unit: r.unit,
          tags: r.tags,
        })),
      )
  }),

  latest: protectedProcedure
    .input(z.object({ patientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .selectDistinctOn([events.metric], {
          metric: events.metric,
          value: events.value,
          unit: events.unit,
          recordedAt: events.recordedAt,
          tags: events.tags,
        })
        .from(events)
        .where(and(eq(events.patientId, input.patientId), eq(events.kind, 'observation')))
        .orderBy(events.metric, desc(events.recordedAt))

      return z
        .array(
          observationSchema.pick({
            metric: true,
            value: true,
            unit: true,
            recordedAt: true,
            tags: true,
          }),
        )
        .parse(
          rows.map((r) => ({
            metric: r.metric,
            value: r.value,
            unit: r.unit,
            recordedAt: r.recordedAt.getTime(),
            tags: r.tags,
          })),
        )
    }),

})
