import { createFileRoute } from '@tanstack/react-router'
import { GlobalMedications } from '../pages/GlobalMedications'

export const Route = createFileRoute('/_auth/medications')({
  component: GlobalMedications,
})
