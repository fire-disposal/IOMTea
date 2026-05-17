import { createFileRoute } from '@tanstack/react-router'
import { PatientAppointments } from '../pages/PatientAppointments'

export const Route = (createFileRoute as any)('/_auth/patients/$id/appointments')({
  component: PatientAppointments,
})