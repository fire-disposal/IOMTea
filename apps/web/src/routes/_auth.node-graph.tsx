import { createFileRoute } from '@tanstack/react-router'
import { NodeGraphPage } from '../pages/NodeGraphPage'

export const Route = (createFileRoute as any)('/_auth/node-graph')({
  component: NodeGraphPage,
})
