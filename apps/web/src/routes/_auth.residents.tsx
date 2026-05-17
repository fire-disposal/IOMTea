import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = (createFileRoute as any)('/_auth/residents')({
  beforeLoad: () => { throw redirect({ to: '/patients' }) },
})