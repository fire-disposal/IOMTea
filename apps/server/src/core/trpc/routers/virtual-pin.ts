import { randomInt } from 'node:crypto'
import { TRPCError } from '@trpc/server'
import { eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { events, patients } from '../../db/schema.js'
import { userPatientLinks } from '../../db/schema/user-patient'
import { usersPin } from '../../db/schema/pin'
import { protectedProcedure, router } from '../index'

const metricConfigSchema = z.object({
  metric: z.string(),
  min: z.number(),
  max: z.number(),
  unit: z.string().default(''),
  variance: z.number().default(0.1),
})

const generatorConfigSchema = z.object({
  enabled: z.boolean().default(false),
  intervalMs: z.number().min(1000).max(300000).default(10000),
  metrics: z.array(metricConfigSchema).default([]),
})

const activeGenerators = new Map<string, ReturnType<typeof setInterval>>()

function generateValue(min: number, max: number, variance: number): number {
  const base = min + Math.random() * (max - min)
  const noise = (Math.random() - 0.5) * 2 * variance * (max - min)
  return Math.round((base + noise) * 10) / 10
}

function startVirtualPin(pin: string, config: z.infer<typeof generatorConfigSchema>) {
  stopVirtualPin(pin)
  if (!config.enabled || config.metrics.length === 0) return

  const interval = setInterval(async () => {
    try {
      const [pinRecord] = await import('../../db').then((m) =>
        m.db.select().from(usersPin).where(eq(usersPin.pin, pin)).limit(1),
      )
      if (!pinRecord) {
        stopVirtualPin(pin)
        return
      }

      const patientRows = await import('../../db').then((m) =>
        m.db
          .select({ id: patients.id })
          .from(patients)
          .innerJoin(userPatientLinks, eq(userPatientLinks.patientId, patients.id))
          .where(eq(userPatientLinks.userId, pinRecord.userId))
          .limit(1),
      )
      const patientId = patientRows[0]?.id

      const db = (await import('../../db')).db
      for (const m of config.metrics) {
        const value = generateValue(m.min, m.max, m.variance)
        await db
          .insert(events)
          .values({
            patientId: patientId || pinRecord.userId,
            pinCode: pin,
            kind: 'observation',
            metric: m.metric,
            value,
            unit: m.unit || undefined,
            source: 'simulator',
            tags: { virtual: true, pin },
            recordedAt: new Date(),
          } as any)
          .catch(() => {})
      }

      await db
        .update(usersPin)
        .set({ lastSeenAt: new Date() })
        .where(eq(usersPin.pin, pin))
        .catch(() => {})
    } catch {
      /* generator tick error */
    }
  }, config.intervalMs)

  activeGenerators.set(pin, interval)
}

function stopVirtualPin(pin: string) {
  const interval = activeGenerators.get(pin)
  if (interval) {
    clearInterval(interval)
    activeGenerators.delete(pin)
  }
}

export async function startAllVirtualPins() {
  const { db } = await import('../../db')
  const pins = await db.select().from(usersPin).where(eq(usersPin.isVirtual, true))
  for (const p of pins) {
    const config = generatorConfigSchema.safeParse(p.generatorConfig)
    if (config.success && config.data.enabled) {
      startVirtualPin(p.pin, config.data)
    }
  }
}

export const virtualPinRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(usersPin).where(eq(usersPin.isVirtual, true))
  }),

  save: protectedProcedure
    .input(
      z.object({
        pin: z.string().min(4).max(6).optional(),
        userId: z.string().uuid(),
        label: z.string().max(64).default(''),
        nickname: z.string().max(32).default(''),
        generatorConfig: generatorConfigSchema.default({}),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const pin = input.pin || String(randomInt(100000, 1000000))

      const existing = await ctx.db.select().from(usersPin).where(eq(usersPin.pin, pin)).limit(1)
      if (existing.length > 0 && !input.pin) {
        throw new TRPCError({ code: 'CONFLICT', message: 'PIN exists, retry' })
      }

      if (existing.length > 0 && input.pin) {
        await ctx.db
          .update(usersPin)
          .set({
            label: input.label,
            nickname: input.nickname,
            generatorConfig: input.generatorConfig as any,
            isVirtual: true,
          })
          .where(eq(usersPin.pin, pin))
      } else {
        await ctx.db.insert(usersPin).values({
          pin,
          userId: input.userId,
          label: input.label,
          nickname: input.nickname,
          generatorConfig: input.generatorConfig as any,
          isVirtual: true,
        })
      }

      const config = generatorConfigSchema.parse(input.generatorConfig)
      if (config.enabled) startVirtualPin(pin, config)
      else stopVirtualPin(pin)

      return { pin }
    }),

  delete: protectedProcedure
    .input(z.object({ pin: z.string().min(4).max(6) }))
    .mutation(async ({ ctx, input }) => {
      stopVirtualPin(input.pin)
      await ctx.db.delete(usersPin).where(eq(usersPin.pin, input.pin))
      return { success: true }
    }),
})
