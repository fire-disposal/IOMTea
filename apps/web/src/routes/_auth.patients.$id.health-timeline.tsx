import { createFileRoute } from '@tanstack/react-router'
import { HealthTimeline } from '../pages/HealthTimeline'

export const Route = (createFileRoute as any)('/_auth/patients/$id/health-timeline')({
  component: HealthTimeline,
})