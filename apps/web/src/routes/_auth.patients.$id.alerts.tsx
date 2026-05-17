import { createFileRoute } from '@tanstack/react-router'
import { PatientAlerts } from '../pages/PatientAlerts'

export const Route = (createFileRoute as any)('/_auth/patients/$id/alerts')({
  component: PatientAlerts,
})