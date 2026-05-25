import '@xyflow/react/dist/style.css'
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Paper,
  Select,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconFilter, IconLink, IconTrash } from '@tabler/icons-react'
import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  MarkerType,
  MiniMap,
  type Node,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react'
import { useCallback, useEffect, useState } from 'react'
import { http } from '../api/client'
import { useGet } from '../api/hooks'

interface PatientNode {
  id: string
  name: string
  gender: string | null
  status: string
  tags?: Record<string, unknown> | null
}
interface UserNode {
  id: string
  username: string
  displayName: string | null
  role: string
}
interface Relation {
  patientId: string
  userId: string
  relation: string | null
}

export function NodeGraph() {
  const { data: patients } = useGet<PatientNode[]>('/patients', { pageSize: 200 })
  const { data: users } = useGet<UserNode[]>('/users')
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[])
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [filter, setFilter] = useState<'all' | 'patients' | 'users'>('all')
  const [relationMap, setRelationMap] = useState<
    Record<string, { userId: string; relation: string | null }[]>
  >({})

  const nodeTypes = {
    patient: PatientNodeComp,
    user: UserNodeComp,
  }

  const patToNode = useCallback(
    (p: PatientNode): Node => ({
      id: `pat-${p.id}`,
      type: 'patient',
      position: { x: Math.random() * 600 + 50, y: Math.random() * 400 + 50 },
      data: {
        label: p.name,
        status: p.status,
        tags: p.tags ? Object.values(p.tags as object) : [],
      },
      style: {
        borderRadius: 8,
        border: '2px solid #38b2ac',
        background: '#e6fffa',
        padding: '8px 16px',
        width: 150,
      },
    }),
    [],
  )

  const userToNode = useCallback(
    (u: UserNode): Node => ({
      id: `usr-${u.id}`,
      type: 'user',
      position: { x: Math.random() * 600 + 50, y: Math.random() * 400 + 200 },
      data: { label: u.displayName || u.username, role: u.role },
      style: {
        borderRadius: '50%',
        border: '2px solid #7950f2',
        background: '#f3f0ff',
        width: 80,
        height: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
      },
    }),
    [],
  )

  useEffect(() => {
    if (!patients || !users) return
    const pNodes = patients.map(patToNode)
    const uNodes = users.map(userToNode)
    setNodes([...pNodes, ...uNodes])

    Promise.all(
      patients.map((p) =>
        http
          .get(`/patients/${p.id}/users`)
          .then((r) => [p.id, r.data as { userId: string; relation: string | null }[]]),
      ),
    ).then((results) => {
      const map: Record<string, { userId: string; relation: string | null }[]> = {}
      const newEdges: Edge[] = []
      for (const [pid, rels] of results as [
        string,
        { userId: string; relation: string | null }[],
      ][]) {
        map[pid] = rels
        rels.forEach((r, i) => {
          newEdges.push({
            id: `edge-${pid}-${r.userId}-${i}`,
            source: `usr-${r.userId}`,
            target: `pat-${pid}`,
            label: r.relation || '',
            labelStyle: { fontSize: 10, fill: '#868e96' },
            style: { stroke: '#868e96', strokeWidth: 1.5, strokeDasharray: '4 2' },
            markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: '#868e96' },
          })
        })
      }
      setRelationMap(map)
      setEdges(newEdges)
    })
  }, [patients, users, patToNode, userToNode, setNodes, setEdges])

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
  }, [])

  const filteredNodes =
    filter === 'all'
      ? nodes
      : nodes.filter((n) => n.type === (filter === 'patients' ? 'patient' : 'user'))

  return (
    <div style={{ display: 'flex', height: 500, gap: 0 }}>
      <div style={{ flex: 1, border: '1px solid #dee2e6', borderRadius: 8, overflow: 'hidden' }}>
        <ReactFlow
          nodes={filteredNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode={['Backspace', 'Delete']}
        >
          <Controls />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <MiniMap nodeStrokeWidth={3} pannable zoomable />
          <Panel position="top-right">
            <Group
              gap="xs"
              style={{
                background: 'white',
                padding: 4,
                borderRadius: 6,
                boxShadow: '0 2px 8px rgba(0,0,0,.1)',
              }}
            >
              <ActionIcon
                variant={filter === 'all' ? 'filled' : 'light'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                <IconFilter size={14} />
              </ActionIcon>
              <Badge
                size="xs"
                style={{ cursor: 'pointer' }}
                variant={filter === 'patients' ? 'filled' : 'outline'}
                onClick={() => setFilter('patients')}
              >
                患者
              </Badge>
              <Badge
                size="xs"
                style={{ cursor: 'pointer' }}
                variant={filter === 'users' ? 'filled' : 'outline'}
                onClick={() => setFilter('users')}
              >
                用户
              </Badge>
            </Group>
          </Panel>
        </ReactFlow>
      </div>
      {selectedNode && (
        <Paper p="sm" withBorder style={{ width: 220, overflow: 'auto' }}>
          <Stack gap="xs">
            <Text fw={600}>{String(selectedNode.data?.label || '')}</Text>
            {selectedNode.type === 'patient' && (
              <>
                <Badge>{String(selectedNode.data?.status || '')}</Badge>
                <Text size="xs" c="dimmed">
                  关联用户:
                </Text>
                {(relationMap[selectedNode.id.replace('pat-', '')] || []).map((r) => (
                  <Group key={r.userId} gap={4}>
                    <Text size="xs">{r.userId.slice(0, 8)}...</Text>
                    <Badge size="xs" variant="light">
                      {r.relation || '-'}
                    </Badge>
                  </Group>
                ))}
              </>
            )}
            {selectedNode.type === 'user' && (
              <Badge color="violet">{String(selectedNode.data?.role || '')}</Badge>
            )}
            <Button size="xs" variant="light" color="red" onClick={() => setSelectedNode(null)}>
              关闭
            </Button>
          </Stack>
        </Paper>
      )}
    </div>
  )
}

function PatientNodeComp({ data }: { data: Record<string, unknown> }) {
  const tags = (data.tags as string[]) || []
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <Text size="xs" fw={600} style={{ color: '#0c8599' }}>
        {String(data.label || '')}
      </Text>
      {tags.length > 0 && (
        <Group gap={2}>
          {tags.slice(0, 2).map((t) => (
            <Badge key={t} size="xs" variant="outline" color="teal">
              {String(t)}
            </Badge>
          ))}
        </Group>
      )}
    </div>
  )
}

function UserNodeComp({ data }: { data: Record<string, unknown> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <Text size="xs" fw={600} style={{ color: '#5f3dc4' }}>
        {String(data.label || '')}
      </Text>
      <Text size="xs" c="dimmed">
        {String(data.role || '')}
      </Text>
    </div>
  )
}
