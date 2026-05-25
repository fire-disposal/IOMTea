import { createFileRoute } from '@tanstack/react-router'
import { PinManagementPage } from '../pages/PinManagementPage'

export const Route = createFileRoute('/_auth/iot/pins')({
  component: PinManagementPage,
})
