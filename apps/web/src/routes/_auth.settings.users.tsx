import { createFileRoute } from '@tanstack/react-router'
import { UserManagementPage } from '../pages/UserManagementPage'

export const Route = createFileRoute('/_auth/settings/users')({
  component: UserManagementPage,
})
