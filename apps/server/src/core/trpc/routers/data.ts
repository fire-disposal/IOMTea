import { eventTimeSeriesInputSchema, observationSchema } from '@iomtea/shared-types'
import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import { z } from 'zod'
import { events } from '../../db/schema.js'
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

  timeseriesBatch: protectedProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
        metrics: z.array(z.string()).min(1).max(10),
        from: z.number(),
        to: z.number().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(events.patientId, input.patientId),
        inArray(events.metric, input.metrics),
        eq(events.kind, 'observation'),
        gte(events.recordedAt, new Date(input.from)),
      ]
      if (input.to) conditions.push(lte(events.recordedAt, new Date(input.to)))

      const rows = await ctx.db
        .select({
          metric: events.metric,
          recordedAt: events.recordedAt,
          value: events.value,
        })
        .from(events)
        .where(and(...conditions))
        .orderBy(events.recordedAt)
        .limit(4000)

      const grouped: Record<string, { recordedAt: number; value: number | null }[]> = {}
      for (const r of rows) {
        if (!grouped[r.metric]) grouped[r.metric] = []
        grouped[r.metric].push({ recordedAt: r.recordedAt.getTime(), value: r.value })
      }
      return grouped
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
