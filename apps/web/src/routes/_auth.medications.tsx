import { createFileRoute } from '@tanstack/react-router'
import { GlobalMedications } from '../pages/GlobalMedications'

export const Route = (createFileRoute as any)('/_auth/medications')({
  component: GlobalMedications,
})