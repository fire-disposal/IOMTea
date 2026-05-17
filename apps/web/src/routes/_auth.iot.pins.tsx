import { createFileRoute } from '@tanstack/react-router'
import { PinManagementPage } from '../pages/PinManagementPage'

export const Route = (createFileRoute as any)('/_auth/iot/pins')({
  component: PinManagementPage,
})