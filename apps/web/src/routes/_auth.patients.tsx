import { createFileRoute } from '@tanstack/react-router'
import { PatientWall } from '../pages/PatientWall'

export const Route = (createFileRoute as any)('/_auth/patients')({
  component: PatientWall,
})