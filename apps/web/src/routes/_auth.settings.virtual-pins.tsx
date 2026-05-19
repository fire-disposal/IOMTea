import { createFileRoute } from '@tanstack/react-router'
import { VirtualPinsPage } from '../pages/VirtualPinsPage'

export const Route = (createFileRoute as any)('/_auth/settings/virtual-pins')({
  component: VirtualPinsPage,
})