import { Container, Title, Text } from '@mantine/core'
import { IconDevices } from '@tabler/icons-react'

export function DeviceListPage() {
  return (
    <Container size="lg" py="md">
      <Title order={2} mb="md">设备与接入</Title>
      <Text c="dimmed" ta="center" py="xl">
        设备管理已合并至 <strong>PIN 管理</strong> 页面。所有硬件设备、虚拟生成器、模拟器统一使用 PIN 作为标识。
      </Text>
    </Container>
  )
}
