import { createFileRoute, useParams } from '@tanstack/react-router'
import { GraphEditorPage } from '../twin3d/GraphEditorPage'

function EditorPage() {
  const { id } = (useParams as any)({ from: '/_auth/patients/$id' })
  return <GraphEditorPage patientId={id} />
}

export const Route = (createFileRoute as any)('/_auth/patients/$id/map-editor')({
  component: EditorPage,
})