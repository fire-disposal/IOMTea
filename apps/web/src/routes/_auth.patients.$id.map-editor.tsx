import { createFileRoute, useParams } from '@tanstack/react-router'
import { GraphEditorPage } from '../twin3d/GraphEditorPage'

function EditorPage() {
  const { id } = useParams({ from: '/_auth/patients/$id' })
  return <GraphEditorPage patientId={id} />
}

export const Route = createFileRoute('/_auth/patients/$id/map-editor')({
  component: EditorPage,
})
