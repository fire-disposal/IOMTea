import '@xyflow/react/dist/style.css'
import dagre from '@dagrejs/dagre'
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Select,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconFilter } from '@tabler/icons-react'
import { useNavigate } from '@tanstack/react-router'
import type { FitViewOptions } from '@xyflow/react'
import {
  Background,
  BackgroundVariant,
  type Connection,
  Controls,
  type Edge,
  MarkerType,
  MiniMap,
  type Node,
  Panel,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
} from '@xyflow/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { http } from '../api/client'
import { useGet } from '../api/hooks'

const PATIENT_RELATIONS = [
  'primary',
  'spouse',
  'child',
  'parent',
  'sibling',
  'caregiver',
  'doctor',
  'nurse',
  'admin',
  'other',
] as const

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
  const navigate = useNavigate()
  const { data: patients } = useGet<PatientNode[]>('/patients', { pageSize: 200 })
  const { data: users } = useGet<UserNode[]>('/users')
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[])
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [filter, setFilter] = useState<'all' | 'patients' | 'users'>('all')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node?: Node } | null>(null)
  const [pendingLink, setPendingLink] = useState<{
    source: string
    target: string
    userId: string
    patientId: string
  } | null>(null)
  const [linkRelation, setLinkRelation] = useState<string | null>('caregiver')
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

  const onEdgesDelete = useCallback((deletedEdges: Edge[]) => {
    for (const edge of deletedEdges) {
      const patientId = edge.target.replace('pat-', '')
      const userId = edge.source.replace('usr-', '')
      http.delete(`/patients/${patientId}/users/${userId}`).catch(() =>
        notifications.show({
          color: 'red',
          title: '删除失败',
          message: `关系 ${edge.label || ''} 删除失败，请重试`,
        }),
      )
    }
  }, [])

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault()
    setContextMenu({ x: event.clientX, y: event.clientY, node })
  }, [])

  const onPaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault()
    setContextMenu({ x: event.clientX, y: event.clientY })
  }, [])

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source?.startsWith('usr-') || !connection.target?.startsWith('pat-')) return
    setPendingLink({
      source: connection.source,
      target: connection.target,
      userId: connection.source.replace('usr-', ''),
      patientId: connection.target.replace('pat-', ''),
    })
    setLinkRelation('caregiver')
  }, [])

  const confirmLink = useCallback(async () => {
    if (!pendingLink) return
    const { userId, patientId, source, target } = pendingLink
    const relation = linkRelation ?? undefined
    try {
      await http.post(`/patients/${patientId}/users`, { userId, relation })
      const newEdge: Edge = {
        id: `edge-${patientId}-${userId}-${Date.now()}`,
        source,
        target,
        label: relation || '',
        labelStyle: { fontSize: 10, fill: '#868e96' },
        style: { stroke: '#868e96', strokeWidth: 1.5, strokeDasharray: '4 2' },
        markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: '#868e96' },
      }
      setEdges((eds) => addEdge(newEdge, eds))
      setPendingLink(null)
      notifications.show({ color: 'green', title: '关联成功', message: '' })
    } catch {
      notifications.show({ color: 'red', title: '关联失败', message: '请重试' })
      setPendingLink(null)
    }
  }, [pendingLink, linkRelation, setEdges])

  const cancelLink = useCallback(() => setPendingLink(null), [])

  const rfInstanceRef = useRef<{ fitView: (opts?: FitViewOptions) => void } | null>(null)

  const autoLayout = useCallback(() => {
    const g = new dagre.graphlib.Graph()
    g.setDefaultEdgeLabel(() => ({}))
    g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 100 })
    for (const node of nodes)
      g.setNode(node.id, { width: (node.style?.width as number) || 150, height: (node.style?.height as number) || 80 })
    for (const edge of edges) g.setEdge(edge.source, edge.target)
    dagre.layout(g)
    setNodes(
      nodes.map((node) => {
        const pos = g.node(node.id)
        return { ...node, position: { x: pos.x - ((node.style?.width as number) || 150) / 2, y: pos.y - ((node.style?.height as number) || 80) / 2 } }
      }),
    )
  }, [nodes, edges, setNodes])

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
          onEdgesDelete={onEdgesDelete}
          onConnect={onConnect}
          onNodeContextMenu={onNodeContextMenu}
          onPaneContextMenu={onPaneContextMenu}
          onPaneClick={() => setContextMenu(null)}
          onInit={(instance) => { rfInstanceRef.current = instance }}
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
              <Badge
                size="xs"
                color="gray"
                style={{ cursor: 'pointer' }}
                variant="outline"
                onClick={() => autoLayout()}
              >
                自动布局
              </Badge>
            </Group>
          </Panel>
        </ReactFlow>
      </div>
      <Modal opened={!!pendingLink} onClose={cancelLink} title="选择关系类型" size="auto" centered>
        <Stack gap="sm">
          <Select
            placeholder="关系类型"
            data={PATIENT_RELATIONS.map((r) => ({ value: r, label: r }))}
            value={linkRelation}
            onChange={setLinkRelation}
          />
          <Group justify="flex-end" gap="xs">
            <Button size="xs" variant="light" onClick={cancelLink}>
              取消
            </Button>
            <Button size="xs" onClick={confirmLink}>
              确认关联
            </Button>
          </Group>
        </Stack>
      </Modal>
      {contextMenu && (
        <div
          role="presentation"
          tabIndex={-1}
          style={{ position: 'fixed', inset: 0, zIndex: 999 }}
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault()
            setContextMenu(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setContextMenu(null)
          }}
        >
          <Paper
            style={{
              position: 'fixed',
              left: contextMenu.x,
              top: contextMenu.y,
              minWidth: 120,
              zIndex: 1000,
            }}
            shadow="md"
            withBorder
            p={4}
            onClick={(e) => e.stopPropagation()}
          >
            <Stack gap={2}>
              {contextMenu.node ? (
                <Button
                  size="compact-sm"
                  variant="subtle"
                  onClick={() => {
                    setSelectedNode(contextMenu.node ?? null)
                    setContextMenu(null)
                  }}
                >
                  查看详情
                </Button>
              ) : (
                <>
                  <Button
                    size="compact-sm"
                    variant="subtle"
                    onClick={() => {
                      autoLayout()
                      setContextMenu(null)
                    }}
                  >
                    自动布局
                  </Button>
                  <Button
                    size="compact-sm"
                    variant="subtle"
                    onClick={() => {
                      rfInstanceRef.current?.fitView()
                      setContextMenu(null)
                    }}
                  >
                    重置视图
                  </Button>
                </>
              )}
              <Button
                size="compact-sm"
                variant="subtle"
                color="gray"
                onClick={() => setContextMenu(null)}
              >
                取消
              </Button>
            </Stack>
          </Paper>
        </div>
      )}
      {selectedNode && (
        <Paper p="sm" withBorder style={{ width: 220, overflow: 'auto' }}>
          <Stack gap="xs">
            <Text fw={600}>{String(selectedNode.data?.label || '')}</Text>
            {selectedNode.type === 'patient' && (
              <>
                <Badge>{String(selectedNode.data?.status || '')}</Badge>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() =>
                    navigate({ to: `/patients/${selectedNode.id.replace('pat-', '')}` })
                  }
                >
                  查看患者
                </Button>
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
              <>
                <Badge color="violet">{String(selectedNode.data?.role || '')}</Badge>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => navigate({ to: '/settings/users' })}
                >
                  查看用户
                </Button>
              </>
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
