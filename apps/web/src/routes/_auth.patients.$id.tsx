import { Outlet, createFileRoute } from '@tanstack/react-router'
import { PatientDetailShell } from '../pages/PatientDetailShell'

export const Route = createFileRoute('/_auth/patients/$id')({
  component: () => (
    <PatientDetailShell>
      <Outlet />
    </PatientDetailShell>
  ),
})
