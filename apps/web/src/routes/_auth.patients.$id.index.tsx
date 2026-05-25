import { createFileRoute } from '@tanstack/react-router'
import { PatientOverview } from '../pages/PatientOverview'

export const Route = createFileRoute('/_auth/patients/$id/')({
  component: PatientOverview,
})
