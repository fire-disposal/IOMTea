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
import { jwtAuth } from '../middleware/auth'

const plansApp = new OpenAPIHono()
plansApp.use('*', jwtAuth)

const listRoute = createRoute({
  method: 'get',
  path: '/',
  responses: { 200: { description: 'All plans' } },
})
plansApp.openapi(listRoute, async (c) => {
  const rows = await db.select().from(plans).orderBy(plans.createdAt)
  return c.json(rows)
})

const createPlanRoute = createRoute({
  method: 'post',
  path: '/',
  request: { body: { content: { 'application/json': { schema: planCreateSchema } } } },
  responses: { 201: { description: 'Created' } },
})
plansApp.openapi(createPlanRoute, async (c) => {
  const body = c.req.valid('json')
  const [row] = await db.insert(plans).values(body).returning()
  return c.json(row, 201 as any)
})

const updateRoute = createRoute({
  method: 'patch',
  path: '/:id',
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
  if (!row) return c.json({ error: 'Not found' } as any, 404)
  return c.json(row)
})

const deleteRoute = createRoute({
  method: 'delete',
  path: '/:id',
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
  request: { body: { content: { 'application/json': { schema: planCompleteSchema } } } },
  responses: { 201: { description: 'Completed + credits earned' } },
})
plansApp.openapi(completeRoute, async (c) => {
  const planId = c.req.param('id')
  const body = c.req.valid('json')

  const [plan] = await db.select().from(plans).where(eq(plans.id, planId)).limit(1)
  if (!plan) return c.json({ error: 'Not found' } as any, 404)

  const [completion] = await db
    .insert(planCompletions)
    .values({
      planId,
      patientId: body.patientId,
      userId: body.userId ?? null,
      responses: body.responses ?? null,
      creditsEarned: plan.rewardCredits,
    })
    .returning()

  if (plan.rewardCredits > 0) {
    const uid = body.userId ?? completion.userId ?? null
    if (uid) {
      await db.insert(creditTransactions).values({
        userId: uid,
        patientId: body.patientId,
        amount: plan.rewardCredits,
        kind: 'earn',
        source: 'plan',
        description: `完成: ${plan.title}`,
      } as any)

      await db.insert(events).values({
        patientId: body.patientId,
        kind: 'plan_earn',
        metric: 'credits',
        value: plan.rewardCredits,
        source: 'plan',
      } as any)

      await db
        .update(users)
        .set({ credit: sql`${users.credit} + ${plan.rewardCredits}` } as any)
        .where(eq(users.id, uid))
    }
  }

  return c.json(completion, 201 as any)
})

const completionsRoute = createRoute({
  method: 'get',
  path: '/:id/completions',
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
