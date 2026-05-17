import { createFileRoute } from '@tanstack/react-router'
import { GlobalAppointments } from '../pages/GlobalAppointments'

export const Route = (createFileRoute as any)('/_auth/appointments')({
  component: GlobalAppointments,
})