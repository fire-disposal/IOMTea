import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { patientListSchema, patientResponseSchema, successSchema } from '@iomtea/shared-types'
import { and, eq } from 'drizzle-orm'
import { db } from '../core/db'
import { patients } from '../core/db/schema'
import { userPatientLinks } from '../core/db/schema/user-patient'
import { jwtAuth } from '../middleware/auth'

const patientsApp = new OpenAPIHono()
patientsApp.use('*', jwtAuth)

const listPatRoute = createRoute({
  method: 'get',
  path: '/',
  request: {
    query: z.object({
      page: z.coerce.number().min(1).default(1),
      pageSize: z.coerce.number().min(1).max(200).default(50),
      status: z.string().optional(),
      search: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: patientListSchema } },
      description: 'Patient list',
    },
  },
})

patientsApp.openapi(listPatRoute, async (c) => {
  const q = c.req.valid('query')
  const rows = await db
    .select()
    .from(patients)
    .limit(q.pageSize)
    .offset((q.page - 1) * q.pageSize)
  return c.json(rows)
})

const createPatRoute = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().min(1).max(100).openapi({ example: '张三' }),
            birthDate: z.string().optional().openapi({ example: '1960-01-01' }),
            gender: z.string().optional().openapi({ example: 'male' }),
            heightCm: z.number().optional(),
            weightKg: z.number().optional(),
            bloodType: z.string().optional(),
            phone: z.string().optional(),
            address: z.string().optional(),
            tags: z.record(z.string(), z.unknown()).optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: patientResponseSchema } },
      description: 'Created',
    },
  },
})

patientsApp.openapi(createPatRoute, async (c) => {
  const body = c.req.valid('json')
  const [row] = await db
    .insert(patients)
    .values({
      name: body.name,
      birthDate: body.birthDate ?? null,
      gender: body.gender ?? null,
      heightCm: body.heightCm ?? null,
      weightKg: body.weightKg ?? null,
      bloodType: body.bloodType ?? null,
      phone: body.phone ?? null,
      address: body.address ?? null,
      tags: body.tags ?? {},
    } as any)
    .returning()
  return c.json(row, 201 as any)
})

const detailPatRoute = createRoute({
  method: 'get',
  path: '/:id',
  responses: {
    200: {
      content: { 'application/json': { schema: patientResponseSchema } },
      description: 'Patient detail',
    },
    404: { description: 'Not found' },
  },
})

patientsApp.openapi(detailPatRoute, async (c) => {
  const id = c.req.param('id')
  const [row] = await db.select().from(patients).where(eq(patients.id, id)).limit(1)
  if (!row) return c.json({ error: 'Not found' }, 404 as any)
  return c.json(row)
})

const updatePatRoute = createRoute({
  method: 'patch',
  path: '/:id',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().optional(),
            gender: z.string().optional(),
            heightCm: z.number().optional(),
            weightKg: z.number().optional(),
            phone: z.string().optional(),
            address: z.string().optional(),
            status: z.string().optional(),
            tags: z.record(z.string(), z.unknown()).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: patientResponseSchema } },
      description: 'Updated',
    },
    404: { description: 'Not found' },
  },
})

patientsApp.openapi(updatePatRoute, async (c) => {
  const id = c.req.param('id')
  const body = c.req.valid('json')
  const [row] = await db
    .update(patients)
    .set(body as any)
    .where(eq(patients.id, id))
    .returning()
  if (!row) return c.json({ error: 'Not found' }, 404 as any)
  return c.json(row)
})

const deletePatRoute = createRoute({
  method: 'delete',
  path: '/:id',
  responses: {
    200: { content: { 'application/json': { schema: successSchema } }, description: 'Deleted' },
  },
})

patientsApp.openapi(deletePatRoute, async (c) => {
  const id = c.req.param('id')
  await db.delete(patients).where(eq(patients.id, id))
  return c.json({ success: true })
})

const linkUserPatRoute = createRoute({
  method: 'post',
  path: '/:id/users',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            userId: z.string().uuid(),
            relation: z.string().optional().openapi({ example: 'caregiver' }),
          }),
        },
      },
    },
  },
  responses: {
    201: { content: { 'application/json': { schema: successSchema } }, description: 'User linked' },
  },
})

patientsApp.openapi(linkUserPatRoute, async (c) => {
  const patientId = c.req.param('id')
  const body = c.req.valid('json')
  await db.insert(userPatientLinks).values({
    userId: body.userId,
    patientId,
    relation: body.relation ?? null,
  } as any)
  return c.json({ success: true }, 201 as any)
})

const unlinkUserPatRoute = createRoute({
  method: 'delete',
  path: '/:id/users/:userId',
  responses: {
    200: {
      content: { 'application/json': { schema: successSchema } },
      description: 'User unlinked',
    },
  },
})

patientsApp.openapi(unlinkUserPatRoute, async (c) => {
  const patientId = c.req.param('id')
  const userId = c.req.param('userId')
  await db
    .delete(userPatientLinks)
    .where(and(eq(userPatientLinks.userId, userId), eq(userPatientLinks.patientId, patientId)))
  return c.json({ success: true })
})

// ── Batch create patients ──

const bulkCreatePatRoute = createRoute({
  method: 'post',
  path: '/bulk',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            patients: z
              .array(
                z.object({
                  name: z.string().min(1).max(100),
                  gender: z.string().optional(),
                  birthDate: z.string().optional(),
                  tags: z.record(z.string(), z.unknown()).optional(),
                }),
              )
              .min(1)
              .max(100),
          }),
        },
      },
    },
  },
  responses: {
    201: { description: 'Batch created' },
    200: {
      content: {
        'application/json': {
          schema: z.object({ created: z.number(), errors: z.array(z.string()) }),
        },
      },
      description: 'Batch result',
    },
  },
})

patientsApp.openapi(bulkCreatePatRoute, async (c) => {
  const body = c.req.valid('json')
  let created = 0
  const errors: string[] = []
  for (const p of body.patients) {
    try {
      await db.insert(patients).values({
        name: p.name,
        gender: p.gender ?? null,
        birthDate: p.birthDate ?? null,
        tags: p.tags ?? {},
      } as any)
      created++
    } catch (e) {
      errors.push(`${p.name}: ${(e as Error).message}`)
    }
  }
  return c.json({ created, errors })
})

// ── List linked users for a patient ──

const listUsersPatRoute = createRoute({
  method: 'get',
  path: '/:id/users',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(z.object({ userId: z.string(), relation: z.string().nullable() })),
        },
      },
      description: 'Linked users',
    },
  },
})

patientsApp.openapi(listUsersPatRoute, async (c) => {
  const patientId = c.req.param('id')
  const rows = await db
    .select({ userId: userPatientLinks.userId, relation: userPatientLinks.relation })
    .from(userPatientLinks)
    .where(eq(userPatientLinks.patientId, patientId))
  return c.json(rows)
})

export { patientsApp }
