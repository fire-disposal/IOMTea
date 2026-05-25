import { createFileRoute } from '@tanstack/react-router'
import { DataDashboard } from '../pages/DataDashboard'

export const Route = createFileRoute('/_auth/data-dashboard')({
  component: DataDashboard,
})
