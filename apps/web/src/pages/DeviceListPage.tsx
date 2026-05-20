import { Paper, Stack, Text, Title } from '@mantine/core'

export function DeviceListPage() {
  return (
    <Paper p="xl" radius="md" withBorder>
      <Stack align="center" gap="md" py="xl">
        <Title order={3}>系统设置</Title>
        <Text c="dimmed">设备管理与系统配置功能开发中</Text>
      </Stack>
    </Paper>
  )
}
