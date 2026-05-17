import React, { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { Container, Title, Loader, Alert, Badge, Group, Paper } from '@mantine/core'
import { useHomeMap } from '../hooks/useHomeMap'
import { HomeMapCanvas } from '../twin'

export function HomeMapViewerPage() {
  const { patientId } = (useParams as any)({ from: '/_auth/patients/$id/map' })
  const { runtime, isLoading, error } = useHomeMap(patientId)
  const [selectedRoom, setSelectedRoom] = useState<string | undefined>()

  if (isLoading) return <Container><Loader /></Container>
  if (error) return <Container><Alert color="red">加载地图失败</Alert></Container>
  if (!runtime) return <Container><Alert color="yellow">该患者暂无地图</Alert></Container>

  const handleTileClick = (x: number, y: number) => {
    const roomId = runtime.tileToRoomId.get(`${x},${y}`)
    setSelectedRoom(roomId === selectedRoom ? undefined : roomId)
    if (roomId) {
      const room = runtime.rooms.find(r => r.id === roomId)
      if (room) console.log(`Tile (${x},${y}) → ${room.type} (${room.label})`)
    }
  }

  return (
    <Container>
      <Group mb="sm">
        <Title order={3}>居家地图</Title>
        <Badge>房间数: {runtime.rooms.length}</Badge>
        <Badge>物体: {runtime.things.length}</Badge>
      </Group>
      <Paper shadow="xs" p="md" withBorder>
        <HomeMapCanvas
          runtime={runtime}
          cellSize={36}
          showRoomOverlay
          selectedRoomId={selectedRoom}
          onTileClick={handleTileClick}
        />
      </Paper>
    </Container>
  )
}
