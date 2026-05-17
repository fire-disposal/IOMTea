import { createFileRoute } from '@tanstack/react-router'
import { DeviceListPage } from '../pages/DeviceListPage'

export const Route = (createFileRoute as any)('/_auth/settings')({
  component: DeviceListPage,
})