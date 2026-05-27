import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import {
  planCompleteSchema,
  planCreateSchema,
  planSchema,
  planUpdateSchema,
} from '@iomtea/shared-types'
import { successSchema } from '@iomtea/shared-types'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '../core/db'
import { events, users } from '../core/db/schema'
import { creditTransactions, planCompletions, plans } from '../core/db/schema/plan'
import type { AppEnv } from '../core/http/types'
import { jwtAuth } from '../middleware/auth'
import { requirePermission } from '../middleware/rbac'

const plansApp = new OpenAPIHono<AppEnv>()

const listRoute = createRoute({
  method: 'get',
  path: '/',
  middleware: [jwtAuth, requirePermission('/plans', 'read')] as const,
  responses: { 200: { description: 'All plans' } },
})
plansApp.openapi(listRoute, async (c) => {
  const rows = await db.select().from(plans).orderBy(plans.createdAt)
  return c.json(rows)
})

const createPlanRoute = createRoute({
  method: 'post',
  path: '/',
  middleware: [jwtAuth, requirePermission('/plans', 'write')] as const,
  request: { body: { content: { 'application/json': { schema: planCreateSchema } } } },
  responses: { 201: { description: 'Created' } },
})
plansApp.openapi(createPlanRoute, async (c) => {
  const body = c.req.valid('json')
  const [row] = await db.insert(plans).values(body).returning()
  return c.json(row, 201)
})

const updateRoute = createRoute({
  method: 'patch',
  path: '/:id',
  middleware: [jwtAuth, requirePermission('/plans', 'write')] as const,
  request: { body: { content: { 'application/json': { schema: planUpdateSchema } } } },
  responses: { 200: { description: 'Updated' }, 404: { description: 'Not found' } },
})
plansApp.openapi(updateRoute, async (c) => {
  const id = c.req.param('id')
  const [row] = await db
    .update(plans)
    .set(c.req.valid('json') as any)
    .where(eq(plans.id, id))
    .returning()
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(row)
})

const deleteRoute = createRoute({
  method: 'delete',
  path: '/:id',
  middleware: [jwtAuth, requirePermission('/plans', 'write')] as const,
  responses: { 200: { description: 'Archived' } },
})
plansApp.openapi(deleteRoute, async (c) => {
  const id = c.req.param('id')
  await db
    .update(plans)
    .set({ status: 'archived' } as any)
    .where(eq(plans.id, id))
  return c.json({ success: true })
})

const todayRoute = createRoute({
  method: 'get',
  path: '/today',
  middleware: [jwtAuth, requirePermission('/plans', 'read')] as const,
  request: { query: z.object({ patientId: z.string().uuid() }) },
  responses: { 200: { description: 'Today plans' } },
})
plansApp.openapi(todayRoute, async (c) => {
  const { patientId } = c.req.valid('query')
  const allPlans = await db.select().from(plans).where(eq(plans.status, 'active'))

  const doneIds = (
    await db
      .select({ planId: planCompletions.planId })
      .from(planCompletions)
      .where(eq(planCompletions.patientId, patientId))
  ).map((r) => r.planId)

  const pending = allPlans.filter((p) => !doneIds.includes(p.id))
  return c.json(pending)
})

const completeRoute = createRoute({
  method: 'post',
  path: '/:id/complete',
  middleware: [jwtAuth, requirePermission('/plans', 'write')] as const,
  request: { body: { content: { 'application/json': { schema: planCompleteSchema } } } },
  responses: { 201: { description: 'Completed + credits earned' } },
})
plansApp.openapi(completeRoute, async (c) => {
  const planId = c.req.param('id')
  const body = c.req.valid('json')

  const [plan] = await db.select().from(plans).where(eq(plans.id, planId)).limit(1)
  if (!plan) return c.json({ error: 'Not found' }, 404)

  const completion = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(planCompletions)
      .values({
        planId,
        patientId: body.patientId,
        userId: c.var.userId || null,
        responses: body.responses ?? null,
        creditsEarned: plan.rewardCredits,
      })
      .returning()

    if (plan.rewardCredits > 0) {
      const uid = c.get('userId') || body.userId || null
      if (uid) {
        await tx.insert(creditTransactions).values({
          userId: uid,
          patientId: body.patientId,
          amount: plan.rewardCredits,
          kind: 'earn',
          source: 'plan',
          description: `完成: ${plan.title}`,
        } as any)

        await tx.insert(events).values({
          patientId: body.patientId,
          kind: 'plan_earn',
          metric: 'credits',
          value: plan.rewardCredits,
          source: 'plan',
        } as any)

        await tx
          .update(users)
          .set({ credit: sql`${users.credit} + ${plan.rewardCredits}` } as any)
          .where(eq(users.id, uid))
      }
    }

    return row
  })

  return c.json(completion, 201)
})

const completionsRoute = createRoute({
  method: 'get',
  path: '/:id/completions',
  middleware: [jwtAuth, requirePermission('/plans', 'read')] as const,
  request: { query: z.object({ patientId: z.string().uuid().optional() }) },
  responses: { 200: { description: 'Completion history' } },
})
plansApp.openapi(completionsRoute, async (c) => {
  const planId = c.req.param('id')
  const { patientId } = c.req.valid('query')
  const conds = [eq(planCompletions.planId, planId)]
  if (patientId) conds.push(eq(planCompletions.patientId, patientId))
  const rows = await db
    .select()
    .from(planCompletions)
    .where(and(...conds))
    .orderBy(planCompletions.completedAt)
  return c.json(rows)
})

export { plansApp }
