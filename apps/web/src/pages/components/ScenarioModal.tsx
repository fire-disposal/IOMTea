import { Button, Modal, SimpleGrid, Text } from '@mantine/core'

interface Scenario {
  key: string
  label: string
  desc: string
}

const SCENARIOS: Scenario[] = [
  { key: 'tachycardia', label: '心动过速', desc: 'HR 155 bpm' },
  { key: 'low_spo2', label: '低血氧', desc: 'SpO2 88%' },
  { key: 'hypotension', label: '低血压', desc: '收缩压 85' },
  { key: 'fall', label: '跌倒检测', desc: '触发跌倒告警' },
  { key: 'bed_exit', label: '离床', desc: '触发离床告警' },
  { key: 'hyperglycemia', label: '高血糖', desc: '血糖 13.5' },
  { key: 'hypoglycemia', label: '低血糖', desc: '血糖 2.8' },
  { key: 'arrhythmia', label: '心律失常', desc: 'HR 180 bpm' },
  { key: 'respiratory_distress', label: '呼吸窘迫', desc: 'RR 35 rpm' },
]

interface ScenarioModalProps {
  opened: boolean
  onClose: () => void
  onInject: (type: string) => void
  pending: boolean
}

export function ScenarioModal({ opened, onClose, onInject, pending }: ScenarioModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="场景注入" size="lg">
      <SimpleGrid cols={3} spacing="sm">
        {SCENARIOS.map((s) => (
          <Button
            key={s.key}
            variant="light"
            color="orange"
            onClick={() => onInject(s.key)}
            loading={pending}
            styles={{
              root: { height: 'auto', padding: '12px 8px', flexDirection: 'column', gap: 4 },
            }}
          >
            <Text size="sm" fw={600}>
              {s.label}
            </Text>
            <Text size="xs" c="dimmed">
              {s.desc}
            </Text>
          </Button>
        ))}
      </SimpleGrid>
    </Modal>
  )
}
