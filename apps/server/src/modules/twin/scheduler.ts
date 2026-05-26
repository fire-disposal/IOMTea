export class MetricScheduler {
  private timers = new Map<string, ReturnType<typeof setTimeout>>()
  private speed = 1

  setSpeed(speed: number) {
    this.speed = speed
  }

  schedule(patientId: string, metric: any, callback: (metric: string) => Promise<void>) {
    const key = `${patientId}:${metric.metric ?? metric.name}`
    const mName = metric.metric ?? metric.name
    const run = () => {
      const baseInterval =
        metric.interval.min + Math.random() * (metric.interval.max - metric.interval.min)
      const jitteredInterval = baseInterval * (1 + (Math.random() - 0.5) * 2 * metric.jitter)
      const interval = Math.max(100, jitteredInterval / this.speed)
      this.timers.set(
        key,
        setTimeout(async () => {
          try {
            await callback(mName)
          } catch (err) {
            console.error('[twin-scheduler] callback error:', err)
          }
          if (this.timers.has(key)) run()
        }, interval),
      )
    }
    run()
  }

  cancel(patientId: string, metricName?: string) {
    const prefix = `${patientId}:${metricName ?? ''}`
    for (const [key, timer] of this.timers) {
      if (key.startsWith(prefix)) {
        clearTimeout(timer)
        this.timers.delete(key)
      }
    }
  }

  destroy() {
    for (const timer of this.timers.values()) clearTimeout(timer)
    this.timers.clear()
  }
}
