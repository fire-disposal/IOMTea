import { Select } from '@mantine/core'

const ROLES = [
  { value: 'super_admin', label: '超级管理员' },
  { value: 'admin', label: '管理员' },
  { value: 'user', label: '普通用户' },
]

export function RoleSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (role: string) => void
}) {
  return <Select data={ROLES} value={value} onChange={(v) => v && onChange(v)} w={140} size="xs" />
}
