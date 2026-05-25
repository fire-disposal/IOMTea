import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { z } from 'zod'
import { events } from '../../db/schema.js'
import { valueExpression, truncExpr } from '../../pipeline/query-helpers.js'
import { getMetricOrDefault, listMetrics } from '../../pipeline/registry.js'
import { requirePermission } from '../middleware/rbac'
import { protectedProcedure, router } from '../index'

export const dataRouter = router({
  metrics: protectedProcedure
    .input(z.object({ category: z.string().optional() }))
    .query(({ input }) => {
      return listMetrics(input.category).map((m) => ({
        metric: m.metric,
        displayName: m.displayName,
        unit: m.unit,
        valueType: m.valueType,
        fields: m.fields,
        defaultChart: m.defaultChart,
        category: m.category,
        normalRange: m.normalRange,
      }))
    }),

  timeseries: protectedProcedure
    .use(requirePermission('patient:read'))
    .input(
      z.object({
        patientId: z.string().uuid(),
        metric: z.string().min(1),
        from: z.number(),
        to: z.number().optional(),
        kind: z.string().default('observation'),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(events.patientId, input.patientId),
        eq(events.metric, input.metric),
        eq(events.kind, input.kind as any),
        gte(events.recordedAt, new Date(input.from)),
      ]
      if (input.to) conditions.push(lte(events.recordedAt, new Date(input.to)))

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

      return rows.map((r) => ({
        recordedAt: r.recordedAt.getTime(),
        value: r.value,
        unit: r.unit,
        tags: r.tags,
      }))
    }),

  timeseriesBatch: protectedProcedure
    .use(requirePermission('patient:read'))
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

      const grouped: Record<string, { recordedAt: number; value: unknown }[]> = {}
      for (const r of rows) {
        if (!grouped[r.metric]) grouped[r.metric] = []
        grouped[r.metric].push({ recordedAt: r.recordedAt.getTime(), value: r.value })
      }
      return grouped
    }),

  latest: protectedProcedure
    .use(requirePermission('patient:read'))
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

      return rows.map((r) => ({
        metric: r.metric,
        value: r.value,
        unit: r.unit,
        recordedAt: r.recordedAt.getTime(),
        tags: r.tags,
      }))
    }),

  raw: protectedProcedure
    .use(requirePermission('patient:read'))
    .input(
      z.object({
        patientId: z.string().uuid(),
        metric: z.string().min(1),
        fieldPath: z.string().optional(),
        from: z.string().datetime(),
        to: z.string().datetime().optional(),
        limit: z.number().min(1).max(10000).default(200),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const def = getMetricOrDefault(input.metric)
      const valExpr = valueExpression(def, input.fieldPath)

      const conditions = [
        eq(events.patientId, input.patientId),
        eq(events.metric, input.metric),
        gte(events.recordedAt, new Date(input.from)),
      ]
      if (input.to) conditions.push(lte(events.recordedAt, new Date(input.to)))

      const rows = await ctx.db
        .select({
          id: events.id,
          patientId: events.patientId,
          recordedAt: events.recordedAt,
          value: events.value,
          numericValue: valExpr.mapWith(Number),
          unit: events.unit,
          tags: events.tags,
          source: events.source,
          kind: events.kind,
        })
        .from(events)
        .where(and(...conditions))
        .orderBy(desc(events.recordedAt))
        .limit(input.limit)
        .offset(input.offset)

      return {
        metric: input.metric,
        fieldPath: input.fieldPath,
        unit: def.unit,
        rows: rows.reverse().map((r) => ({
          recordedAt: r.recordedAt.getTime(),
          value: r.value,
          numericValue: r.numericValue,
          unit: r.unit,
          tags: r.tags,
          source: r.source,
          kind: r.kind,
        })),
      }
    }),

  aggregate: protectedProcedure
    .use(requirePermission('patient:read'))
    .input(
      z.object({
        patientId: z.string().uuid(),
        metric: z.string().min(1),
        fieldPath: z.string().optional(),
        from: z.string().datetime(),
        to: z.string().datetime().optional(),
        interval: z.enum(['minute', 'hour', 'day', 'week']).default('day'),
        fn: z.enum(['avg', 'min', 'max', 'count']).default('avg'),
      }),
    )
    .query(async ({ ctx, input }) => {
      const def = getMetricOrDefault(input.metric)
      const valExpr = valueExpression(def, input.fieldPath)
      const timeBucket = truncExpr(input.interval)

      const conditions = [
        eq(events.patientId, input.patientId),
        eq(events.metric, input.metric),
        gte(events.recordedAt, new Date(input.from)),
      ]
      if (input.to) conditions.push(lte(events.recordedAt, new Date(input.to)))

      let aggFn: ReturnType<typeof sql>
      if (input.fn === 'count') aggFn = sql`count(${valExpr})`
      else if (input.fn === 'min') aggFn = sql`min(${valExpr})`
      else if (input.fn === 'max') aggFn = sql`max(${valExpr})`
      else aggFn = sql`avg(${valExpr})`

      const rows = await ctx.db
        .select({
          bucket: timeBucket.mapWith((v: unknown) => String(v)),
          value: aggFn.mapWith(Number),
        })
        .from(events)
        .where(and(...conditions))
        .groupBy(timeBucket)
        .orderBy(asc(timeBucket))

      return {
        metric: input.metric,
        fieldPath: input.fieldPath,
        interval: input.interval,
        fn: input.fn,
        unit: def.unit,
        rows,
      }
    }),

  compare: protectedProcedure
    .use(requirePermission('patient:read'))
    .input(
      z.object({
        metric: z.string().min(1),
        fieldPath: z.string().optional(),
        patientId: z.string().uuid(),
        beforeFrom: z.string().datetime(),
        beforeTo: z.string().datetime(),
        afterFrom: z.string().datetime(),
        afterTo: z.string().datetime(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const def = getMetricOrDefault(input.metric)
      const valExpr = valueExpression(def, input.fieldPath)

      async function avgInRange(from: string, to: string): Promise<number | null> {
        const [row] = await ctx.db
          .select({ avg: sql`avg(${valExpr})`.mapWith(Number) })
          .from(events)
          .where(
            and(
              eq(events.metric, input.metric),
              eq(events.patientId, input.patientId),
              gte(events.recordedAt, new Date(from)),
              lte(events.recordedAt, new Date(to)),
            ),
          )
        return row?.avg ?? null
      }

      const before = await avgInRange(input.beforeFrom, input.beforeTo)
      const after = await avgInRange(input.afterFrom, input.afterTo)

      return {
        metric: input.metric,
        fieldPath: input.fieldPath,
        unit: def.unit,
        before: { from: input.beforeFrom, to: input.beforeTo, avg: before },
        after: { from: input.afterFrom, to: input.afterTo, avg: after },
        delta: before != null && after != null ? after - before : null,
      }
    }),

  gap: protectedProcedure
    .use(requirePermission('patient:read'))
    .input(
      z.object({
        metric: z.string().min(1),
        patientId: z.string().uuid(),
        from: z.string().datetime(),
        to: z.string().datetime(),
        maxGapMinutes: z.number().min(1).default(60),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({ recordedAt: events.recordedAt })
        .from(events)
        .where(
          and(
            eq(events.metric, input.metric),
            eq(events.patientId, input.patientId),
            gte(events.recordedAt, new Date(input.from)),
            lte(events.recordedAt, new Date(input.to)),
          ),
        )
        .orderBy(asc(events.recordedAt))

      const gaps: { from: string; to: string; minutes: number }[] = []
      for (let i = 1; i < rows.length; i++) {
        const diff =
          (rows[i].recordedAt.getTime() - rows[i - 1].recordedAt.getTime()) / 60000
        if (diff > input.maxGapMinutes) {
          gaps.push({
            from: rows[i - 1].recordedAt.toISOString(),
            to: rows[i].recordedAt.toISOString(),
            minutes: Math.round(diff),
          })
        }
      }

      return {
        metric: input.metric,
        maxGapMinutes: input.maxGapMinutes,
        totalPoints: rows.length,
        gaps,
      }
    }),

  summary: protectedProcedure
    .use(requirePermission('patient:read'))
    .input(
      z.object({
        metric: z.string().min(1),
        fieldPath: z.string().optional(),
        patientId: z.string().uuid().optional(),
        from: z.string().datetime(),
        to: z.string().datetime(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const def = getMetricOrDefault(input.metric)
      const valExpr = valueExpression(def, input.fieldPath)

      const conditions = [
        eq(events.metric, input.metric),
        gte(events.recordedAt, new Date(input.from)),
        lte(events.recordedAt, new Date(input.to)),
      ]
      if (input.patientId) conditions.push(eq(events.patientId, input.patientId))

      const [row] = await ctx.db
        .select({
          count: sql`count(*)::int`.mapWith(Number),
          min: sql`min(${valExpr})`.mapWith(Number),
          max: sql`max(${valExpr})`.mapWith(Number),
          avg: sql`avg(${valExpr})`.mapWith(Number),
          stddev: sql`stddev(${valExpr})`.mapWith(Number),
        })
        .from(events)
        .where(and(...conditions))

      return {
        metric: input.metric,
        fieldPath: input.fieldPath,
        unit: def.unit,
        count: row?.count ?? 0,
        min: row?.min ?? null,
        max: row?.max ?? null,
        avg: row?.avg ?? null,
        stddev: row?.stddev ?? null,
      }
    }),
})
