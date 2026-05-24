import { createFileRoute } from '@tanstack/react-router'
import { Container, Title, Paper, Group, Button, Select, MultiSelect, Badge, Text } from '@mantine/core'
import { useState } from 'react'
import { IconPlayerPlay } from '@tabler/icons-react'

const PROFILES = [
  { value: 'elderly-cardiac', label: '老年心脏' },
  { value: 'diabetes', label: '糖尿病' },
  { value: 'post-surgery', label: '术后恢复' },
  { value: 'copd-respiratory', label: 'COPD呼吸' },
  { value: 'maternity', label: '产科' },
]

function SimulationPage() {
  const [selectedPatients, setSelectedPatients] = useState<string[]>([])
  const [profile, setProfile] = useState<string>('elderly-cardiac')

  return (
    <Container size="lg" py="md">
      <Title order={2} mb="md">模拟数据工厂</Title>
      <Paper p="md" withBorder mb="md">
        <Group>
          <MultiSelect
            data={[]}
            value={selectedPatients}
            onChange={setSelectedPatients}
            placeholder="选择患者 (加载中...)"
            searchable
            style={{ minWidth: 300 }}
          />
          <Select data={PROFILES} value={profile} onChange={(v) => setProfile(v!)} />
          <Button leftSection={<IconPlayerPlay size={18} />} color="green" disabled={selectedPatients.length === 0}>
            启动
          </Button>
        </Group>
        <Badge size="lg" variant="light" mt="sm">运行中: 0</Badge>
      </Paper>
      <Text c="dimmed" ta="center">选择患者并启动模拟即可实时生成健康数据</Text>
    </Container>
  )
}

export const Route = createFileRoute('/_auth/simulation')({
  component: SimulationPage,
})
