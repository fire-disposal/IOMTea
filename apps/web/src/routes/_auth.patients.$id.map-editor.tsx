import { createFileRoute, useParams } from '@tanstack/react-router'
import { MapEditor3D } from '../twin3d/MapEditor3D'

function EditorPage() {
  const { id } = (useParams as any)({ from: '/_auth/patients/$id' })
  return (
    <div style={{ height: 'calc(100vh - 56px)' }}>
      <MapEditor3D patientId={id} />
    </div>
  )
}

export const Route = (createFileRoute as any)('/_auth/patients/$id/map-editor')({
  component: EditorPage,
})