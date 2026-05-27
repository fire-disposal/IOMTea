import { CronExpressionParser } from 'cron-parser'

export function cronMatchesToday(expression: string | null): boolean {
  if (!expression) return true
  try {
    const interval = CronExpressionParser.parse(expression)
    const next = interval.next().toDate()
    const now = new Date()
    return (
      next.getFullYear() === now.getFullYear() &&
      next.getMonth() === now.getMonth() &&
      next.getDate() === now.getDate()
    )
  } catch {
    return false
  }
}
