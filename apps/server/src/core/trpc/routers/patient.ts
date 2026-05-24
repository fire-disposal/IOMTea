import {
  patientCreateSchema,
  patientListInputSchema,
  patientSchema,
  patientUpdateSchema,
} from '@iomtea/shared-types'
import { TRPCError } from '@trpc/server'
import { eq, inArray, and, sql } from 'drizzle-orm'
import { z } from 'zod'
import { patients, users } from '../../db/schema.js'
import { patientTagLinks } from '../../db/schema/tag'
import { hashPassword } from '../../lib/password'
import { requirePermission } from '../middleware/rbac'
import { protectedProcedure, router } from '../index'

export const patientRouter = router({
  list: protectedProcedure
    .use(requirePermission('patient:read'))
    .input(patientListInputSchema)
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.pageSize
      let query = ctx.db
        .select({
          id: patients.id,
          name: patients.name,
          birthDate: patients.birthDate,
          gender: patients.gender,
          status: patients.status,
          tags: patients.tags,
          phone: patients.phone,
          createdAt: patients.createdAt,
          isActivated: sql<boolean>`CASE WHEN ${users.lastLoginAt} IS NOT NULL THEN true ELSE false END`,
        })
        .from(patients)
        .leftJoin(users, eq(patients.userId, users.id))
        .$dynamic()
      if (input.status) {
        query = query.where(eq(patients.status, input.status))
      }
      const rows = await query.limit(input.pageSize).offset(offset).orderBy(patients.createdAt)

      return rows.map((p) =>
        patientSchema.parse({
          id: p.id,
          name: p.name,
          birthDate: p.birthDate,
          gender: p.gender,
          status: p.status,
          tags: p.tags,
          phone: p.phone,
          isActivated: p.isActivated,
          createdAt: p.createdAt.getTime(),
        }),
      )
    }),

  byId: protectedProcedure
    .use(requirePermission('patient:read'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(patients).where(eq(patients.id, input.id)).limit(1)

      if (rows.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Patient not found' })
      }
      const p = rows[0]
      return patientSchema.parse({
        id: p.id,
        name: p.name,
        birthDate: p.birthDate,
        gender: p.gender,
        status: p.status,
        tags: p.tags,
        createdAt: p.createdAt.getTime(),
      })
    }),

  create: protectedProcedure
    .use(requirePermission('patient:write'))
    .input(patientCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db.insert(patients).values(input).returning()
      return patientSchema.parse({
        id: created.id,
        name: created.name,
        birthDate: created.birthDate,
        gender: created.gender,
        status: created.status,
        createdAt: created.createdAt.getTime(),
      })
    }),

  update: protectedProcedure
    .use(requirePermission('patient:write'))
    .input(z.object({ id: z.string().uuid(), data: patientUpdateSchema }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(patients)
        .set(input.data)
        .where(eq(patients.id, input.id))
        .returning()

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Patient not found' })
      }
      return patientSchema.parse({
        id: updated.id,
        name: updated.name,
        birthDate: updated.birthDate,
        gender: updated.gender,
        status: updated.status,
        createdAt: updated.createdAt.getTime(),
      })
    }),

  delete: protectedProcedure
    .use(requirePermission('patient:delete'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(patients).where(eq(patients.id, input.id))
      return { success: true }
    }),

  bulkCreate: protectedProcedure
    .use(requirePermission('patient:write'))
    .input(z.object({
      defaultPassword: z.string().min(6),
      tagIds: z.array(z.string().uuid()).optional(),
      patients: z.array(z.object({
        name: z.string().min(1),
        gender: z.enum(['male', 'female', 'other']).optional(),
        birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        phone: z.string().max(20).optional(),
        heightCm: z.number().optional(),
        weightKg: z.number().optional(),
        bloodType: z.enum(['A', 'B', 'AB', 'O']).optional(),
        address: z.string().optional(),
        emergencyContact: z.string().max(100).optional(),
        emergencyPhone: z.string().max(20).optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const results = { created: 0, errors: [] as { index: number; reason: string }[] }
      for (let i = 0; i < input.patients.length; i++) {
        const p = input.patients[i]
        try {
          const username = p.phone || `user-${crypto.randomUUID().slice(0, 8)}`
          const pwHash = await hashPassword(input.defaultPassword)
          const [user] = await ctx.db.insert(users).values({
            username,
            passwordHash: pwHash,
            displayName: p.name,
            phone: p.phone,
            role: 'user',
          }).returning()
          const [patient] = await ctx.db.insert(patients).values({
            name: p.name,
            userId: user.id,
            gender: p.gender,
            birthDate: p.birthDate,
            phone: p.phone,
            heightCm: p.heightCm,
            weightKg: p.weightKg,
            bloodType: p.bloodType,
            address: p.address,
            emergencyContact: p.emergencyContact,
            emergencyPhone: p.emergencyPhone,
          }).returning()
          if (input.tagIds?.length) {
            await ctx.db.insert(patientTagLinks).values(
              input.tagIds.map((tagId) => ({ patientId: patient.id, tagId })),
            )
          }
          results.created++
        } catch (err: any) {
          results.errors.push({ index: i, reason: err?.message ?? 'Unknown error' })
        }
      }
      return results
    }),

  bulkUpdateStatus: protectedProcedure
    .use(requirePermission('patient:write'))
    .input(z.object({ ids: z.array(z.string().uuid()), status: z.enum(['active', 'discharged', 'archived']) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(patients).set({ status: input.status }).where(inArray(patients.id, input.ids))
      return { updated: input.ids.length }
    }),

  bulkAddTags: protectedProcedure
    .use(requirePermission('patient:write'))
    .input(z.object({ patientIds: z.array(z.string().uuid()), tagIds: z.array(z.string().uuid()) }))
    .mutation(async ({ ctx, input }) => {
      const rows = input.patientIds.flatMap((pid) =>
        input.tagIds.map((tid) => ({ patientId: pid, tagId: tid })),
      )
      await ctx.db.insert(patientTagLinks).values(rows).onConflictDoNothing()
      return { linked: rows.length }
    }),

  bulkRemoveTags: protectedProcedure
    .use(requirePermission('patient:write'))
    .input(z.object({ patientIds: z.array(z.string().uuid()), tagIds: z.array(z.string().uuid()) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(patientTagLinks).where(
        and(inArray(patientTagLinks.patientId, input.patientIds), inArray(patientTagLinks.tagId, input.tagIds)),
      )
    }),
})
