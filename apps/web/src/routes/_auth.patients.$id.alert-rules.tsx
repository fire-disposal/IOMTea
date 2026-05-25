import { createFileRoute, useParams } from '@tanstack/react-router'
import { PatientAlertRules } from '../pages/PatientAlertRules'

function AlertRulesPage() {
  const { id } = useParams({ from: '/_auth/patients/$id' })
  return <PatientAlertRules patientId={id} />
}

export const Route = createFileRoute('/_auth/patients/$id/alert-rules')({
  component: AlertRulesPage,
})
