import { createFileRoute } from '@tanstack/react-router'
import { MiiEditor } from '@/components/MiiAvatar'

export const Route = (createFileRoute as any)('/_auth/avatar-editor')({
  component: AvatarEditorPage,
})

function AvatarEditorPage() {
  return <MiiEditor />
}
