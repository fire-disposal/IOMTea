import { createFileRoute } from '@tanstack/react-router'
import { PatientMedications } from '../pages/PatientMedications'

export const Route = createFileRoute('/_auth/patients/$id/medications')({
  component: PatientMedications,
})
