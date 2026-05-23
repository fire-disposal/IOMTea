import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow, Controls, Background, MiniMap, useNodesState, useEdgesState,
  addEdge, Connection, Edge, Node as FlowNode, BackgroundVariant, MarkerType,
} from '@xyflow/react'
import type { NodeTypes } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Box, Button, Group, Modal, Select, Stack, TextInput, LoadingOverlay } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { trpc } from '../trpc'
import { RoomNode } from '../components/graph/RoomNode'
import { NodePanel } from '../components/graph/NodePanel'
import { GraphToolbar } from '../components/graph/GraphToolbar'
import { ContextMenu } from '../components/graph/ContextMenu'

const nodeTypes = useMemo(() => ({ roomNode: RoomNode }), []) as NodeTypes

const roomTypeOptions = [
  { value: 'bedroom', label: '卧室' },
  { value: 'livingroom', label: '客厅' },
  { value: 'kitchen', label: '厨房' },
  { value: 'bathroom', label: '卫生间' },
  { value: 'study', label: '书房' },
  { value: 'corridor', label: '走廊' },
  { value: 'entry', label: '玄关' },
  { value: 'balcony', label: '阳台' },
  { value: 'storage', label: '储物间' },
  { value: 'dining', label: '餐厅' },
]

interface GraphItem {
  id: string; label: string; deviceType?: string
  status?: string; latestVitals?: { metric: string; value: number; unit: string }[]
}

export function NodeGraphPage() {
  const utils = trpc.useUtils()
  const { data: graphData, isLoading } = trpc.nodeGraph.getGraph.useQuery()
  const saveGraph = trpc.nodeGraph.saveGraph.useMutation({
    onSuccess: () => notifications.show({ title: '已保存', message: '图谱布局已保存', color: 'green' }),
    onError: (e) => notifications.show({ title: '保存失败', message: e.message, color: 'red' }),
  })
  const assignDevice = trpc.nodeGraph.assignDevice.useMutation()
  const deleteRoom = trpc.nodeGraph.deleteRoom.useMutation({
    onSuccess: () => (notifications as any).show({ title: '已删除', color: 'orange' }),
  })

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null)
  const [creatingRoom, setCreatingRoom] = useState(false)
  const [editingRoom, setEditingRoom] = useState<any>(null)
  const [connectingRoom, setConnectingRoom] = useState<string | null>(null)
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomType, setNewRoomType] = useState<string>('bedroom')
  const [searchText, setSearchText] = useState('')
  const reactFlowRef = useRef<any>(null)
  const [undoStack, setUndoStack] = useState<{ nodes: FlowNode[]; edges: Edge[] }[]>([])
  const [redoStack, setRedoStack] = useState<{ nodes: FlowNode[]; edges: Edge[] }[]>([])

  const pushUndo = useCallback(() => {
    setUndoStack((prev) => {
      const snapshot = { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }
      if (prev.length >= 50) return [...prev.slice(1), snapshot]
      return [...prev, snapshot]
    })
    setRedoStack([])
  }, [nodes, edges])

  const handleNodeDrop = useCallback((itemId: string, itemType: string, roomId: string) => {
    if (itemType === 'device') {
      assignDevice.mutate({ deviceId: itemId, roomId })
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === roomId) {
            const subNodes = [...(n.data.subNodes as any[] || [])]
            if (!subNodes.find((sn) => sn.id === itemId)) {
              const item: any = (graphData?.unassignedDevices || []).find((d: any) => d.id === itemId)
              subNodes.push({
                id: itemId, label: item?.label ?? item?.serialNumber ?? itemId,
                deviceType: item?.deviceType, status: item?.status,
              })
            }
            return { ...n, data: { ...n.data, subNodes, deviceCount: subNodes.length } }
          }
          return n
        }),
      )
      utils.nodeGraph.getGraph.invalidate()
    } else if (itemType === 'patient') {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === roomId) {
            const patient = (graphData?.patients || []).find((p: any) => p.id === itemId)
            return { ...n, data: { ...n.data, patientId: itemId, patientName: patient?.name } }
          }
          return n
        }),
      )
    }
  }, [assignDevice, setNodes, graphData, utils])

  useEffect(() => {
    if (!graphData) return
    const roomNodes: FlowNode[] = (graphData.rooms || []).map((room: any) => ({
      id: room.id,
      type: 'roomNode',
      position: { x: room.x ?? Math.random() * 400, y: room.y ?? Math.random() * 300 },
      data: {
        label: room.name ?? room.id.slice(0, 8),
        roomType: room.type ?? 'bedroom',
        patientName: (room as any).patientName,
        patientId: (room as any).patientId,
        deviceCount: room.devices?.length ?? 0,
        subNodes: (room.devices || []).map((d: any) => ({
          id: d.id ?? d.pin,
          label: d.label ?? d.serialNumber ?? d.pin ?? 'unknown',
          deviceType: d.deviceType,
          status: d.status,
        })),
        onNodeDrop: handleNodeDrop,
      },
    }))

    const roomEdges: Edge[] = []
    for (const room of graphData.rooms || []) {
      for (const connId of room.connections || []) {
        const edgeId = `${room.id}-${connId}`
        if (!roomEdges.find((e) => e.id === edgeId || e.id === `${connId}-${room.id}`)) {
          roomEdges.push({
            id: edgeId,
            source: room.id,
            target: connId,
            type: 'smoothstep',
            animated: false,
            style: { stroke: 'var(--mantine-color-matchaGreen-3)', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--mantine-color-matchaGreen-4)' },
          })
        }
      }
    }

    setNodes(roomNodes)
    setEdges(roomEdges)
  }, [graphData, setNodes, setEdges])

  const onConnect = useCallback(
    (params: Connection) => {
      pushUndo()
      setEdges((eds) => addEdge({
        ...params, type: 'smoothstep',
        style: { stroke: 'var(--mantine-color-matchaGreen-3)', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--mantine-color-matchaGreen-4)' },
      }, eds))
    },
    [setEdges, pushUndo],
  )

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: FlowNode) => {
      event.preventDefault()
      setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id })
    },
    [],
  )

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  const handleEditNode = useCallback(() => {
    if (!contextMenu) return
    const node = nodes.find((n) => n.id === contextMenu.nodeId)
    if (node) {
      setEditingRoom({ id: node.id, name: node.data.label as string, type: node.data.roomType as string })
    }
    closeContextMenu()
  }, [contextMenu, nodes, closeContextMenu])

  const handleConnectRoom = useCallback(() => {
    if (!contextMenu) return
    setConnectingRoom(contextMenu.nodeId)
    closeContextMenu()
  }, [contextMenu, closeContextMenu])

  const handleDeleteNode = useCallback(() => {
    if (!contextMenu) return
    pushUndo()
    const nodeId = contextMenu.nodeId
    deleteRoom.mutate({ roomId: nodeId })
    setNodes((nds) => nds.filter((n) => n.id !== nodeId))
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
    closeContextMenu()
  }, [contextMenu, pushUndo, deleteRoom, setNodes, setEdges, closeContextMenu])

  const handleCreateRoom = useCallback(() => {
    pushUndo()
    const id = `room-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const newNode: FlowNode = {
      id,
      type: 'roomNode',
      position: { x: 200 + Math.random() * 300, y: 100 + Math.random() * 200 },
      data: {
        label: newRoomName || '新房间',
        roomType: newRoomType,
        deviceCount: 0,
        subNodes: [],
        onNodeDrop: handleNodeDrop,
      },
    }
    setNodes((nds) => [...nds, newNode])
    setCreatingRoom(false)
    setNewRoomName('')
    setNewRoomType('bedroom')
  }, [pushUndo, newRoomName, newRoomType, setNodes])

  const handleEditSave = useCallback(() => {
    if (!editingRoom) return
    pushUndo()
    setNodes((nds) =>
      nds.map((n) =>
        n.id === editingRoom.id
          ? { ...n, data: { ...n.data, label: editingRoom.name, roomType: editingRoom.type } }
          : n,
      ),
    )
    setEditingRoom(null)
  }, [editingRoom, pushUndo, setNodes])

  const handleSaveGraph = useCallback(() => {
    const rooms = nodes.map((n) => ({
      id: n.id,
      name: (n.data.label as string) || n.id,
      type: (n.data.roomType as string) || 'bedroom',
      x: n.position.x,
      y: n.position.y,
      connections: edges
        .filter((e) => e.source === n.id)
        .map((e) => e.target),
      patientId: (n.data.patientId as string) || undefined,
    }))
    saveGraph.mutate({ graph: { rooms } } as any)
  }, [nodes, edges, saveGraph])

  const onNodeDragStop = useCallback(() => {
    pushUndo()
  }, [pushUndo])

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return
    const snapshot = undoStack[undoStack.length - 1]
    setRedoStack((prev) => [...prev, { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }])
    setNodes(snapshot.nodes)
    setEdges(snapshot.edges)
    setUndoStack((prev) => prev.slice(0, -1))
  }, [undoStack, nodes, edges, setNodes, setEdges])

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return
    const snapshot = redoStack[redoStack.length - 1]
    setUndoStack((prev) => [...prev, { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }])
    setNodes(snapshot.nodes)
    setEdges(snapshot.edges)
    setRedoStack((prev) => prev.slice(0, -1))
  }, [redoStack, nodes, edges, setNodes, setEdges])

  const handleAutoLayout = useCallback(() => {
    pushUndo()
    const cols = Math.ceil(Math.sqrt(nodes.length))
    setNodes((nds) =>
      nds.map((n, i) => ({
        ...n,
        position: { x: 150 + (i % cols) * 220, y: 80 + Math.floor(i / cols) * 160 },
      })),
    )
  }, [nodes.length, pushUndo, setNodes])

  const handleSearch = useCallback(() => {
    const el = document.querySelector('.react-flow__renderer') as HTMLElement
    if (!el) return
    const matching = Array.from(el.querySelectorAll('.react-flow__node')).find((node) => {
      const text = node.textContent?.toLowerCase() ?? ''
      return text.includes(searchText.toLowerCase())
    })
    if (matching) {
      matching.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [searchText])

  const handleFitView = useCallback(() => {
    reactFlowRef.current?.fitView({ padding: 0.2, duration: 300 })
  }, [])

  const handleZoomIn = useCallback(() => {
    reactFlowRef.current?.zoomIn()
  }, [])

  const handleZoomOut = useCallback(() => {
    reactFlowRef.current?.zoomOut()
  }, [])

  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'smoothstep' as const,
      style: { stroke: 'var(--mantine-color-matchaGreen-3)', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--mantine-color-matchaGreen-4)' },
    }),
    [],
  )

  const unassignedDevices: GraphItem[] = useMemo(() =>
    (graphData?.unassignedDevices || []).map((d: any) => ({
      id: d.id, label: d.label ?? d.serialNumber ?? d.id, deviceType: d.deviceType, status: d.status,
    })),
  [graphData])

  const unassignedPatients: GraphItem[] = useMemo(() =>
    (graphData?.patients || []).map((p: any) => ({
      id: p.id, label: p.name, latestVitals: p.latestVitals,
    })),
  [graphData])

  if (isLoading) {
    return (
      <Box style={{ height: 'calc(100vh - 112px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingOverlay visible />
      </Box>
    )
  }

  return (
    <Box style={{ height: 'calc(100vh - 112px)', display: 'flex', position: 'relative' }}>
      <Box style={{ flex: 1, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10 }}>
          <GraphToolbar
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onAutoLayout={handleAutoLayout}
            onSearch={handleSearch}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onFitView={handleFitView}
          />
        </div>
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}>
          <Group gap="xs">
            <TextInput
              size="xs"
              placeholder="搜索房间..."
              value={searchText}
              onChange={(e) => setSearchText(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
            />
            <Button size="xs" variant="light" onClick={handleSaveGraph} loading={saveGraph.isPending}>
              保存布局
            </Button>
          </Group>
        </div>
        <ReactFlow
          ref={reactFlowRef}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeContextMenu={onNodeContextMenu}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          deleteKeyCode={null}
          style={{ background: '#f8faf9' }}
        >
          <Controls />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--mantine-color-gray-3)" />
          <MiniMap nodeStrokeWidth={2} pannable zoomable style={{ background: '#f8faf9' }} />
        </ReactFlow>
      </Box>

      <Box style={{ width: 240, flexShrink: 0, borderLeft: '1px solid var(--mantine-color-gray-2)' }}>
        <NodePanel
          devices={unassignedDevices}
          patients={unassignedPatients}
          onCreateRoom={() => { setNewRoomName(''); setNewRoomType('bedroom'); setCreatingRoom(true) }}
        />
      </Box>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          roomName={nodes.find((n) => n.id === contextMenu.nodeId)?.data.label as string}
          onEdit={handleEditNode}
          onConnect={handleConnectRoom}
          onDelete={handleDeleteNode}
          onClose={closeContextMenu}
        />
      )}

      <Modal opened={creatingRoom} onClose={() => setCreatingRoom(false)} title="创建房间" size="sm">
        <Stack gap="sm">
          <TextInput
            label="房间名称"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.currentTarget.value)}
            placeholder="例如：主卧"
          />
          <Select
            label="房间类型"
            data={roomTypeOptions}
            value={newRoomType}
            onChange={(v) => setNewRoomType(v ?? 'bedroom')}
          />
          <Button onClick={handleCreateRoom}>创建</Button>
        </Stack>
      </Modal>

      <Modal opened={!!editingRoom} onClose={() => setEditingRoom(null)} title="编辑房间" size="sm">
        <Stack gap="sm">
          <TextInput
            label="房间名称"
            value={editingRoom?.name ?? ''}
            onChange={(e) => setEditingRoom((prev: any) => ({ ...prev, name: e.currentTarget.value }))}
          />
          <Select
            label="房间类型"
            data={roomTypeOptions}
            value={editingRoom?.type ?? 'bedroom'}
            onChange={(v) => setEditingRoom((prev: any) => ({ ...prev, type: v ?? 'bedroom' }))}
          />
          <Button onClick={handleEditSave}>保存</Button>
        </Stack>
      </Modal>
    </Box>
  )
}
