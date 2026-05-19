const STREAK_MULTIPLIER: Array<{ days: number; multiplier: number }> = [
  { days: 1, multiplier: 1.0 },
  { days: 3, multiplier: 1.2 },
  { days: 5, multiplier: 1.5 },
  { days: 7, multiplier: 2.0 },
  { days: 10, multiplier: 3.0 },
]

const BASE_CREDIT = 10

export function calculateCredit(streakDay: number): number {
  let multiplier = 1.0
  for (const tier of STREAK_MULTIPLIER) {
    if (streakDay >= tier.days) multiplier = tier.multiplier
  }
  return Math.round(BASE_CREDIT * multiplier)
}

export function calcNewStreak(
  lastRecordDate: Date | null | undefined,
  currentStreak: number,
  today: Date,
): { newStreak: number; action: 'continue' | 'reset' | 'same_day' } {
  if (!lastRecordDate) return { newStreak: 1, action: 'reset' }

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const lastStr = lastRecordDate.toISOString().slice(0, 10)
  const todayStr = today.toISOString().slice(0, 10)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  if (lastStr === todayStr) return { newStreak: currentStreak, action: 'same_day' }
  if (lastStr === yesterdayStr) return { newStreak: currentStreak + 1, action: 'continue' }
  return { newStreak: 1, action: 'reset' }
}
