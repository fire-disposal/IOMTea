import { Text } from '@mantine/core'
import { modals } from '@mantine/modals'

export function confirmDelete(
  title: string,
  onConfirm: () => void,
) {
  modals.openConfirmModal({
    title: '确认删除',
    children: <Text size="sm">{title}</Text>,
    labels: { confirm: '删除', cancel: '取消' },
    confirmProps: { color: 'red' },
    onConfirm,
  })
}
