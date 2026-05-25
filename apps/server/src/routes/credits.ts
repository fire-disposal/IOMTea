import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '../core/db'
import { users } from '../core/db/schema'
import { creditTransactions } from '../core/db/schema/plan'
import { jwtAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

type Env = {
  Variables: {
    userId: string
    userRole: string
  }
}

const creditsApp = new OpenAPIHono<Env>()

const balanceRoute = createRoute({
  method: 'get',
  path: '/balance',
  middleware: [jwtAuth, requirePermission('/credits', 'read')] as const,
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ balance: z.number() }) } },
      description: 'Current credit balance',
    },
  },
})

creditsApp.openapi(balanceRoute, async (c) => {
  const uid = c.get('userId')
  const [user] = await db
    .select({ credit: users.credit })
    .from(users)
    .where(eq(users.id, uid))
    .limit(1)
  return c.json({ balance: user?.credit ?? 0 })
})

const earnRoute = createRoute({
  method: 'post',
  path: '/earn',
  middleware: [jwtAuth, requirePermission('/credits', 'write')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            userId: z.string().uuid(),
            amount: z.number().int().min(1),
            source: z.string().default('manual'),
            description: z.string().optional(),
            patientId: z.string().uuid().optional(),
          }),
        },
      },
    },
  },
  responses: { 201: { description: 'Credits earned' } },
})

creditsApp.openapi(earnRoute, async (c) => {
  const body = c.req.valid('json')

  await db.insert(creditTransactions).values({
    userId: body.userId,
    patientId: body.patientId ?? null,
    amount: body.amount,
    kind: 'earn',
    source: body.source,
    description: body.description ?? null,
  } as any)

  await db
    .update(users)
    .set({ credit: sql`${users.credit} + ${body.amount}` })
    .where(eq(users.id, body.userId))

  return c.json({ success: true }, 201 as any)
})

const spendRoute = createRoute({
  method: 'post',
  path: '/spend',
  middleware: [jwtAuth, requirePermission('/credits', 'write')] as const,
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            userId: z.string().uuid(),
            amount: z.number().int().min(1),
            source: z.string().default('redeem'),
            description: z.string().optional(),
            patientId: z.string().uuid().optional(),
          }),
        },
      },
    },
  },
  responses: { 201: { description: 'Credits spent' } },
})

creditsApp.openapi(spendRoute, async (c) => {
  const body = c.req.valid('json')

  const [user] = await db
    .select({ credit: users.credit })
    .from(users)
    .where(eq(users.id, body.userId))
    .limit(1)
  if (!user || (user.credit ?? 0) < body.amount) {
    return c.json({ error: 'Insufficient credits' }, 400 as any)
  }

  await db.insert(creditTransactions).values({
    userId: body.userId,
    patientId: body.patientId ?? null,
    amount: -body.amount,
    kind: 'spend',
    source: body.source,
    description: body.description ?? null,
  } as any)

  await db
    .update(users)
    .set({ credit: sql`${users.credit} - ${body.amount}` })
    .where(eq(users.id, body.userId))

  return c.json({ success: true }, 201 as any)
})

const transactionsRoute = createRoute({
  method: 'get',
  path: '/transactions',
  middleware: [jwtAuth, requirePermission('/credits', 'read')] as const,
  request: {
    query: z.object({
      patientId: z.string().uuid().optional(),
      userId: z.string().uuid().optional(),
      page: z.coerce.number().min(1).default(1),
      pageSize: z.coerce.number().min(1).max(200).default(50),
    }),
  },
  responses: { 200: { description: 'Credit transactions' } },
})

creditsApp.openapi(transactionsRoute, async (c) => {
  const q = c.req.valid('query')
  const conds = []
  if (q.patientId) conds.push(eq(creditTransactions.patientId, q.patientId))
  if (q.userId) conds.push(eq(creditTransactions.userId, q.userId))

  const rows = await db
    .select()
    .from(creditTransactions)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(creditTransactions.createdAt))
    .limit(q.pageSize)
    .offset((q.page - 1) * q.pageSize)

  return c.json(rows)
})

export { creditsApp }
