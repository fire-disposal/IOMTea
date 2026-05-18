import { createFileRoute } from '@tanstack/react-router'
import { DataDashboard } from '../pages/DataDashboard'

export const Route = (createFileRoute as any)('/_auth/data-dashboard')({
  component: DataDashboard,
})