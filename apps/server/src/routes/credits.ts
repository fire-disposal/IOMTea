import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { db } from '../core/db'
import { creditTransactions } from '../core/db/schema/plan'
import { eq, and, desc } from 'drizzle-orm'
import { jwtAuth } from '../middleware/auth'

const creditsApp = new OpenAPIHono()
creditsApp.use('*', jwtAuth)

const transactionsRoute = createRoute({
  method: 'get', path: '/transactions',
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
