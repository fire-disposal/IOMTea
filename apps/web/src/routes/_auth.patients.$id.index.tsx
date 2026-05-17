import { createFileRoute } from '@tanstack/react-router'
import { PatientOverview } from '../pages/PatientOverview'

export const Route = (createFileRoute as any)('/_auth/patients/$id/')({
  component: PatientOverview,
})