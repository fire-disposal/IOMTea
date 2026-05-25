import { z } from 'zod'
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { router, protectedProcedure } from '../index'
import { requirePermission } from '../middleware/rbac'
import { patients, events } from '../../db/schema'
import { medications } from '../../db/schema/medication'

const entityEnum = z.enum(['patients', 'events', 'medications'])
const formatEnum = z.enum(['csv', 'xlsx'])

const entityFields: Record<string, string[]> = {
  patients: [
    'id',
    'name',
    'gender',
    'birth_date',
    'phone',
    'height_cm',
    'weight_kg',
    'blood_type',
    'address',
    'status',
    'created_at',
  ],
  events: [
    'id',
    'patient_id',
    'kind',
    'metric',
    'value',
    'unit',
    'source',
    'severity',
    'status',
    'pin_code',
    'recorded_at',
    'created_at',
  ],
  medications: [
    'id',
    'patient_id',
    'drug_name',
    'dosage',
    'dosage_unit',
    'frequency',
    'route',
    'start_date',
    'end_date',
    'status',
    'created_at',
  ],
}

function getTable(entity: string) {
  switch (entity) {
    case 'patients':
      return patients
    case 'events':
      return events
    case 'medications':
      return medications
    default:
      return patients
  }
}

export const exportRouter = router({
  preview: protectedProcedure
    .use(requirePermission('patient:read'))
    .input(
      z.object({
        entity: entityEnum,
        fields: z.array(z.string()),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        patientId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const safeFields = input.fields.filter((f) => entityFields[input.entity]?.includes(f))
      if (safeFields.length === 0) safeFields.push('id', 'created_at')
      const rows = (await ctx.db.select().from(getTable(input.entity))) as Record<string, unknown>[]
      return { columns: safeFields, rows: rows.slice(0, 20), total: rows.length }
    }),

  download: protectedProcedure
    .use(requirePermission('patient:read'))
    .input(
      z.object({
        entity: entityEnum,
        fields: z.array(z.string()),
        format: formatEnum,
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        patientId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const safeFields = input.fields.filter((f) => entityFields[input.entity]?.includes(f))
      if (safeFields.length === 0) safeFields.push('id', 'created_at')
      const rows = (await ctx.db.select().from(getTable(input.entity))) as Record<string, unknown>[]
      if (input.format === 'csv') {
        const header = safeFields.join(',')
        const body = rows
          .map((r) => safeFields.map((f) => `"${String(r[f] ?? '')}"`).join(','))
          .join('\n')
        const csv = header + '\n' + body
        return {
          data: Buffer.from(csv).toString('base64'),
          filename: `${input.entity}.csv`,
          mime: 'text/csv',
        }
      }
      return { data: '', filename: `${input.entity}.csv`, mime: 'text/csv' }
    }),

  eventsDownload: protectedProcedure
    .use(requirePermission('patient:read'))
    .input(
      z.object({
        patientId: z.string().uuid().optional(),
        metrics: z.array(z.string()).optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        format: z.enum(['csv', 'long', 'wide']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const conditions = []
      if (input.patientId) conditions.push(eq(events.patientId, input.patientId))
      if (input.from) conditions.push(gte(events.recordedAt, new Date(input.from)))
      if (input.to) conditions.push(lte(events.recordedAt, new Date(input.to)))
      if (input.metrics?.length) {
        conditions.push(eq(events.metric, input.metrics[0]))
      }

      const rows = await ctx.db
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
        const headers = ['recorded_at', 'patient_id', 'metric', 'source', 'value', ...allFields]
        csvContent = headers.join(',') + '\n'
        for (const row of rows) {
          const v = typeof row.value === 'object' ? '' : String(row.value)
          const extraFields = Array.from(allFields).map((f) => {
            if (typeof row.value === 'object' && row.value) {
              return String((row.value as Record<string, unknown>)[f] ?? '')
            }
            return ''
          })
          csvContent += [
            row.recordedAt?.toISOString() ?? '',
            row.patientId,
            row.metric,
            row.source ?? '',
            `"${v.replace(/"/g, '""')}"`,
            ...extraFields,
          ].join(',') + '\n'
        }
      } else if (input.format === 'long') {
        csvContent = 'recorded_at,patient_id,metric,value,unit,source\n'
        for (const row of rows) {
          const v = typeof row.value === 'object' && row.value
            ? JSON.stringify(row.value)
            : String(row.value ?? '')
          csvContent += [
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
                (r) => r.patientId === pid &&
                  r.recordedAt?.toISOString() === tp &&
                  r.metric === m,
              )
              if (!found) return ''
              return typeof found.value === 'number'
                ? String(found.value)
                : JSON.stringify(found.value)
            })
            csvContent += `${pid},${tp},${vals.join(',')}\n`
          }
        }
      } else {
        csvContent = 'No data'
      }

      const base64 = Buffer.from(csvContent, 'utf-8').toString('base64')
      const filename = `export-${input.format}-${new Date().toISOString().slice(0, 10)}.csv`

      return {
        data: base64,
        filename,
        mime: 'text/csv;charset=utf-8',
      }
    }),

  eventsPreview: protectedProcedure
    .use(requirePermission('patient:read'))
    .input(
      z.object({
        patientId: z.string().uuid().optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        limit: z.number().default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = []
      if (input.patientId) conditions.push(eq(events.patientId, input.patientId))
      if (input.from) conditions.push(gte(events.recordedAt, new Date(input.from)))
      if (input.to) conditions.push(lte(events.recordedAt, new Date(input.to)))

      const rows = await ctx.db
        .select()
        .from(events)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(events.recordedAt))
        .limit(input.limit)

      const [countResult] = await ctx.db
        .select({ total: sql`count(*)::int`.mapWith(Number) })
        .from(events)
        .where(conditions.length ? and(...conditions) : undefined)

      const columns = ['recorded_at', 'patient_id', 'metric', 'source', 'value', 'unit', 'kind']
      return {
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
      }
    }),
})
