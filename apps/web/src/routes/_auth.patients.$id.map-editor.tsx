import { createFileRoute } from '@tanstack/react-router'
import { MapEditorPage } from '../twin/Editor/MapEditorPage'

export const Route = (createFileRoute as any)('/_auth/patients/$id/map-editor')({
  component: MapEditorPage,
})