import { createFileRoute } from '@tanstack/react-router'
import { DeviceListPage } from '../pages/DeviceListPage'

export const Route = createFileRoute('/_auth/settings')({
  component: DeviceListPage,
})
