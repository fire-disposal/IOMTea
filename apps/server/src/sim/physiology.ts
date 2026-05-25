function gaussian(mean: number, std: number): number {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

function circadianFactor(hour: number, min: number, max: number): number {
  const rad = (hour * Math.PI * 2) / 24
  return min + ((max - min) * (1 - Math.cos(rad))) / 2
}

export function generateHeartRate(
  baseline: { mean: number; std: number },
  hour: number,
  _prev?: number,
): number {
  return Math.round(gaussian(baseline.mean + circadianFactor(hour, -3, 5), baseline.std))
}

export function generateSpO2(
  baseline: { mean: number; std: number },
  hour: number,
  _prev?: number,
): number {
  const dip = hour >= 2 && hour <= 5 ? -1.5 : 0
  return Number(gaussian(baseline.mean + dip, baseline.std).toFixed(1))
}

export function generateTemperature(
  baseline: { mean: number; std: number },
  hour: number,
  _prev?: number,
): number {
  return Number(gaussian(baseline.mean + circadianFactor(hour, -0.5, 0.3), baseline.std).toFixed(1))
}

export function generateSystolicBp(
  baseline: { mean: number; std: number },
  hour: number,
  _prev?: number,
): number {
  return Math.round(gaussian(baseline.mean + circadianFactor(hour, -5, 8), baseline.std))
}

export function generateDiastolicBp(
  baseline: { mean: number; std: number },
  hour: number,
  _prev?: number,
): number {
  return Math.round(gaussian(baseline.mean + circadianFactor(hour, -3, 5), baseline.std))
}

export function generateGlucose(
  baseline: { mean: number; std: number },
  hour: number,
  _prev?: number,
): number {
  const mealSpike = [8, 12, 18].some((h) => Math.abs(hour - h) <= 1) ? 2.0 : 0
  return Number(gaussian(baseline.mean + mealSpike, baseline.std).toFixed(1))
}

export function generateRespiratoryRate(
  baseline: { mean: number; std: number },
  _hour: number,
  _prev?: number,
): number {
  return Math.round(gaussian(baseline.mean, baseline.std))
}

export function generatePosture(): string {
  const postures = ['lying', 'sitting', 'standing', 'walking']
  return postures[Math.floor(Math.random() * postures.length)]
}

export function generateBedStatus(): string {
  return Math.random() > 0.3 ? 'in_bed' : 'out_of_bed'
}

export function generateMotionIndex(): number {
  return Number(Math.max(0, Math.min(1, gaussian(0.3, 0.2))).toFixed(2))
}
