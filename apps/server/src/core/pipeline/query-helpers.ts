// apps/server/src/core/pipeline/query-helpers.ts

import { sql } from 'drizzle-orm'
import { events } from '../db/schema'
import type { MetricDefinition } from './registry'

export function valueExpression(def: MetricDefinition, fieldPath?: string): ReturnType<typeof sql> {
  if (def.valueType === 'scalar' || !fieldPath) {
    return sql`(${events.value})::numeric`
  }
  return sql`(${events.value}->>${fieldPath})::numeric`
}

export function truncExpr(interval: string): ReturnType<typeof sql> {
  const valid = ['minute', 'hour', 'day', 'week']
  const ival = valid.includes(interval) ? interval : 'day'
  return sql`date_trunc(${ival}, ${events.recordedAt})`
}


