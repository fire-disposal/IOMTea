import { useState } from 'react'
import { Paper } from '@mantine/core'
import { useParams } from '@tanstack/react-router'
import { EventTimeline } from '../components/sim/EventTimeline'

export function HealthTimeline() {
  const { id } = useParams({ from: '/_auth/patients/$id' })
  const [minutes, setMinutes] = useState(30)
  return (
    <Paper p="md" withBorder>
      <EventTimeline
        patientId={id!}
        minutes={minutes}
        onMinutesChange={setMinutes}
        title="健康事件时间线"
      />
    </Paper>
  )
}
