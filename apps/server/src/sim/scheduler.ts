import type { MetricConfig } from './types'

export class MetricScheduler {
  private timers = new Map<string, ReturnType<typeof setTimeout>>()
  private speed = 1

  setSpeed(speed: number) { this.speed = speed }

  schedule(patientId: string, metric: MetricConfig, callback: (metric: string) => Promise<void>) {
    const key = `${patientId}:${metric.metric}`
    const run = () => {
      const baseInterval = metric.interval.min + Math.random() * (metric.interval.max - metric.interval.min)
      const jitteredInterval = baseInterval * (1 + (Math.random() - 0.5) * 2 * metric.jitter)
      const interval = Math.max(100, jitteredInterval / this.speed)
      this.timers.set(key, setTimeout(async () => {
        await callback(metric.metric)
        if (this.timers.has(key)) run()
      }, interval))
    }
    run()
  }

  destroy() {
    for (const timer of this.timers.values()) clearTimeout(timer)
    this.timers.clear()
  }
}
