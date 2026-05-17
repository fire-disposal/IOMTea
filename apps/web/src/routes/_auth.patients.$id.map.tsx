import { createFileRoute } from '@tanstack/react-router'
import { HomeMapViewerPage } from '../pages/HomeMapViewerPage'

export const Route = (createFileRoute as any)('/_auth/patients/$id/map')({
  component: HomeMapViewerPage,
})