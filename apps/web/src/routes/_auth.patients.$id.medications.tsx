import { createFileRoute } from '@tanstack/react-router'
import { PatientMedications } from '../pages/PatientMedications'

export const Route = (createFileRoute as any)('/_auth/patients/$id/medications')({
  component: PatientMedications,
})