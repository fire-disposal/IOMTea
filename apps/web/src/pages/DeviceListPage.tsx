import { Container, Title, Text, Button } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'

export function DeviceListPage() {
  const navigate = useNavigate()
  return (
    <Container size="lg" py="md">
      <Title order={2} mb="md">
        设备与接入
      </Title>
      <Text c="dimmed" ta="center" py="xl">
        设备管理已合并至 PIN 管理。所有硬件设备、虚拟生成器、模拟器统一使用 PIN 作为标识。
      </Text>
      <Button variant="light" mt="md" onClick={() => navigate({ to: '/iot/pins' })}>
        前往 PIN 管理
      </Button>
    </Container>
  )
}
