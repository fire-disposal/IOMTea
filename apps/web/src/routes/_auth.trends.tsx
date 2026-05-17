import { createFileRoute } from '@tanstack/react-router'
import { TrendsPage } from '../pages/TrendsPage'

export const Route = (createFileRoute as any)('/_auth/trends')({
  component: TrendsPage,
})