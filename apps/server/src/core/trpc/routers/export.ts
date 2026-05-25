import { z } from 'zod'
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
})
