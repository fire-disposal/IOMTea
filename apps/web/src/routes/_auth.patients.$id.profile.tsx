import { createFileRoute } from '@tanstack/react-router'
import { PatientProfile } from '../pages/PatientProfile'

export const Route = createFileRoute('/_auth/patients/$id/profile')({
  component: PatientProfile,
})
