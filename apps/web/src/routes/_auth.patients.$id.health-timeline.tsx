import { createFileRoute } from '@tanstack/react-router'
import { HealthTimeline } from '../pages/HealthTimeline'

export const Route = createFileRoute('/_auth/patients/$id/health-timeline')({
  component: HealthTimeline,
})
