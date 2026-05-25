import { createFileRoute } from '@tanstack/react-router'
import { PatientWall } from '../pages/PatientWall'

export const Route = createFileRoute('/_auth/patients')({
  component: PatientWall,
})
