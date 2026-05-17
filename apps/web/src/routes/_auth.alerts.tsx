import { createFileRoute } from '@tanstack/react-router'
import { AlertBoard } from '../pages/AlertBoard'

export const Route = (createFileRoute as any)('/_auth/alerts')({
  component: AlertBoard,
})