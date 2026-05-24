import { createFileRoute } from '@tanstack/react-router'
import { Container, Title, Paper, Group, Button, Select, MultiSelect, Badge, Table, Text, Grid, Card, Stack, Switch } from '@mantine/core'
import { useState } from 'react'
import { IconPlayerPlay, IconPlayerStop } from '@tabler/icons-react'
import { trpc } from '../trpc'

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
  const [showConfig, setShowConfig] = useState(false)

  const { data: patientList } = trpc.patient.list.useQuery({})
  const { data: simStatus, refetch: refreshStatus } = trpc.sim.status.useQuery()
  const { data: profileConfig } = trpc.sim.profileConfig.useQuery(profile)

  const start = trpc.sim.start.useMutation({ onSuccess: () => refreshStatus() })
  const stop = trpc.sim.stop.useMutation({ onSuccess: () => refreshStatus() })

  const patientOptions = (patientList ?? []).map((p: any) => ({
    value: p.id,
    label: `${p.name}${simStatus?.find((s: any) => s.patientId === p.id) ? ' (运行中)' : ''}`,
  }))

  const running = (simStatus ?? []).filter((s: any) => s.running)

  return (
    <Container size="lg" py="md">
      <Title order={2} mb="md">模拟数据工厂</Title>

      <Paper p="md" withBorder mb="md">
        <Group>
          <MultiSelect
            data={patientOptions}
            value={selectedPatients}
            onChange={setSelectedPatients}
            placeholder="选择患者"
            searchable
            style={{ minWidth: 300 }}
          />
          <Select data={PROFILES} value={profile} onChange={(v) => setProfile(v!)} />
          <Button leftSection={<IconPlayerPlay size={18} />} color="green"
            onClick={() => start.mutate({ patientIds: selectedPatients, profile })}
            loading={start.isPending} disabled={selectedPatients.length === 0}>
            启动
          </Button>
          <Button leftSection={<IconPlayerStop size={18} />} color="red"
            onClick={() => stop.mutate({ patientIds: running.map((r: any) => r.patientId) })}
            loading={stop.isPending} disabled={running.length === 0}>
            停止全部
          </Button>
        </Group>

        <Group mt="sm">
          <Switch label="显示编排配置" checked={showConfig} onChange={(e) => setShowConfig(e.currentTarget.checked)} />
          <Badge size="lg" variant="light">运行中: {running.length}</Badge>
        </Group>

        {showConfig && profileConfig && (
          <Paper p="sm" withBorder mt="sm">
            <Text fw={700} mb="sm">{profile} 指标编排</Text>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>指标</Table.Th>
                  <Table.Th>最小间隔(ms)</Table.Th>
                  <Table.Th>最大间隔(ms)</Table.Th>
                  <Table.Th>抖动</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {profileConfig.map((m: any) => (
                  <Table.Tr key={m.metric}>
                    <Table.Td>{m.metric}</Table.Td>
                    <Table.Td>{m.interval.min}</Table.Td>
                    <Table.Td>{m.interval.max}</Table.Td>
                    <Table.Td>{m.jitter}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        )}
      </Paper>

      {running.length > 0 && (
        <Paper p="md" withBorder>
          <Text fw={700} mb="sm">实时监控</Text>
          <Grid>
            {running.map((s: any) => (
              <Grid.Col key={s.patientId} span={{ base: 12, sm: 6, md: 4 }}>
                <Card shadow="sm" padding="md" radius="md" withBorder>
                  <Group justify="space-between" mb="xs">
                    <Text fw={600}>{s.patientName}</Text>
                    <Badge size="sm">{s.profile}</Badge>
                  </Group>
                  <Stack gap={4}>
                    {(Object.entries(s.lastValues ?? {}) as [string, number][]).slice(0, 6).map(([k, v]) => (
                      <Group key={k} justify="space-between">
                        <Text size="sm" c="dimmed">{k}</Text>
                        <Text size="sm" fw={500}>{typeof v === 'number' ? v.toFixed(1) : String(v)}</Text>
                      </Group>
                    ))}
                  </Stack>
                  <Text size="xs" c="dimmed" mt="xs">tick: {s.tickCount}</Text>
                </Card>
              </Grid.Col>
            ))}
          </Grid>
        </Paper>
      )}
    </Container>
  )
}

export const Route = createFileRoute('/_auth/simulation')({
  component: SimulationPage,
})
