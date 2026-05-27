import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'
import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import { db } from '../core/db'
import { events } from '../core/db/schema'
import type { AppEnv } from '../core/http/types'
import { jwtAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

const exportRouter = new OpenAPIHono<AppEnv>()

const previewRoute = createRoute({
  method: 'get',
  path: '/preview',
  middleware: [jwtAuth, requirePermission('/export', 'read')] as const,
  request: {
    query: z.object({
      patientId: z.string().uuid().optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      pageSize: z.coerce.number().min(1).max(200).default(50),
    }),
  },
  responses: { 200: { description: 'Data preview' } },
})

exportRouter.openapi(previewRoute, async (c) => {
  const q = c.req.valid('query')
  const conditions = []
  if (q.patientId) conditions.push(eq(events.patientId, q.patientId))
  if (q.from) conditions.push(gte(events.recordedAt, new Date(q.from)))
  if (q.to) conditions.push(lte(events.recordedAt, new Date(q.to)))

  const rows = await db
    .select()
    .from(events)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(events.recordedAt))
    .limit(q.pageSize)

  const [countResult] = await db
    .select({ total: sql`count(*)::int`.mapWith(Number) })
    .from(events)
    .where(conditions.length ? and(...conditions) : undefined)

  const columns = ['recorded_at', 'patient_id', 'metric', 'source', 'value', 'unit', 'kind']
  return c.json({
    total: countResult?.total ?? 0,
    columns,
    rows: rows.map((r) => ({
      recorded_at: r.recordedAt?.toISOString(),
      patient_id: r.patientId,
      metric: r.metric,
      source: r.source,
      kind: r.kind,
      value: typeof r.value === 'object' ? JSON.stringify(r.value) : r.value,
      unit: r.unit,
    })),
  })
})

const downloadRoute = createRoute({
  method: 'post',
  path: '/download',
  middleware: [jwtAuth, requirePermission('/export', 'read')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            patientId: z.string().uuid().optional(),
            metrics: z.array(z.string()).optional(),
            from: z.string().datetime().optional(),
            to: z.string().datetime().optional(),
            format: z.enum(['csv', 'long', 'wide']),
          }),
        },
      },
    },
  },
  responses: { 200: { description: 'Export file (base64)' } },
})

exportRouter.openapi(downloadRoute, async (c) => {
  const input = c.req.valid('json')
  const conditions = []
  if (input.patientId) conditions.push(eq(events.patientId, input.patientId))
  if (input.from) conditions.push(gte(events.recordedAt, new Date(input.from)))
  if (input.to) conditions.push(lte(events.recordedAt, new Date(input.to)))
  if (input.metrics?.length) conditions.push(inArray(events.metric, input.metrics))

  const rows = await db
    .select()
    .from(events)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(events.recordedAt))

  let csvContent = ''

  if (input.format === 'csv') {
    const allFields = new Set<string>()
    for (const row of rows) {
      if (typeof row.value === 'object' && row.value) {
        Object.keys(row.value as object).forEach((k) => allFields.add(k))
      }
    }
    csvContent =
      ['recorded_at', 'patient_id', 'metric', 'source', 'value', ...allFields].join(',') + '\n'
    for (const row of rows) {
      const vals = [
        row.recordedAt?.toISOString() ?? '',
        row.patientId,
        row.metric,
        row.source ?? '',
        typeof row.value === 'object' ? '""' : `"${String(row.value ?? '').replace(/"/g, '""')}"`,
        ...Array.from(allFields).map((f) =>
          typeof row.value === 'object' && row.value
            ? `"${String((row.value as Record<string, unknown>)[f] ?? '').replace(/"/g, '""')}"`
            : '""',
        ),
      ]
      csvContent += vals.join(',') + '\n'
    }
  } else if (input.format === 'long') {
    csvContent = 'recorded_at,patient_id,metric,value,unit,source\n'
    for (const row of rows) {
      const v =
        typeof row.value === 'object' && row.value
          ? JSON.stringify(row.value)
          : String(row.value ?? '')
      csvContent +=
        [
          row.recordedAt?.toISOString() ?? '',
          row.patientId,
          row.metric,
          `"${v.replace(/"/g, '""')}"`,
          row.unit ?? '',
          row.source ?? '',
        ].join(',') + '\n'
    }
  } else if (input.format === 'wide') {
    const patientIds = [...new Set(rows.map((r) => r.patientId))]
    const timepoints = [...new Set(rows.map((r) => r.recordedAt?.toISOString() ?? ''))]
    const metricList = [...new Set(rows.map((r) => r.metric))]
    csvContent = 'patient_id,timepoint,' + metricList.join(',') + '\n'
    for (const pid of patientIds) {
      for (const tp of timepoints) {
        const vals = metricList.map((m) => {
          const found = rows.find(
            (r) => r.patientId === pid && r.recordedAt?.toISOString() === tp && r.metric === m,
          )
          if (!found) return ''
          return typeof found.value === 'number' ? String(found.value) : JSON.stringify(found.value)
        })
        csvContent += `${pid},${tp},${vals.join(',')}\n`
      }
    }
  }

  const base64 = Buffer.from(csvContent, 'utf-8').toString('base64')
  const filename = `export-${input.format}-${new Date().toISOString().slice(0, 10)}.csv`

  return c.json({ data: base64, filename, mime: 'text/csv;charset=utf-8' })
})

export { exportRouter }
