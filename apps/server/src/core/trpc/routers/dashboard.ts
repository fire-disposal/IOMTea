import { desc, eq, and, count } from 'drizzle-orm'
import { z } from 'zod'
import { events, patients } from '../../db/schema.js'
import { medications } from '../../db/schema/medication'
import { userPatientLinks } from '../../db/schema/user-patient'
import { requirePermission } from '../middleware/rbac'
import { protectedProcedure, router } from '../index'

export const dashboardRouter = router({
  summary: protectedProcedure.use(requirePermission('dashboard:view')).query(async ({ ctx }) => {
    const userId = ctx.userId

    const links = await ctx.db
      .select({
        patientId: userPatientLinks.patientId,
        relation: userPatientLinks.relation,
      })
      .from(userPatientLinks)
      .where(eq(userPatientLinks.userId, userId))

    const patientIds = links.map((l) => l.patientId)

    if (patientIds.length === 0) {
      return { patients: [], stats: { totalAlerts: 0, totalMedications: 0 } }
    }

    const patientRows = await ctx.db
      .select({
        id: patients.id,
        name: patients.name,
        status: patients.status,
      })
      .from(patients)
      .where(
        and(
          ...patientIds.map((id: string) => eq(patients.id, id)),
          patientIds.length > 0 ? undefined : eq(patients.id, patientIds[0]),
        ),
      )
      .limit(50)

    const activePatientIds = patientRows.map((p) => p.id)

    const activeAlertCount =
      activePatientIds.length > 0
        ? await ctx.db
            .select({ count: count() })
            .from(events)
            .where(
              and(
                eq(events.kind, 'alert' as const),
                eq(events.status, 'active' as const),
                ...activePatientIds.map((id: string) => eq(events.patientId, id)),
              ) as any,
            )
            .then((r) => r[0]?.count ?? 0)
        : 0

    const activeMedicationCount =
      activePatientIds.length > 0
        ? await ctx.db
            .select({ count: count() })
            .from(medications)
            .where(
              and(
                eq(medications.status, 'active' as const),
                ...activePatientIds.map((id: string) => eq(medications.patientId, id)),
              ) as any,
            )
            .then((r) => r[0]?.count ?? 0)
        : 0

    return {
      patients: patientRows.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        relation: links.find((l) => l.patientId === p.id)?.relation ?? 'caregiver',
      })),
      stats: {
        totalAlerts: activeAlertCount,
        totalMedications: activeMedicationCount,
      },
    }
  }),
})
