import { Alert, Button, Container, Paper, PasswordInput, Text, TextInput, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { useAuthStore } from './store/auth'
import { trpc } from './trpc'

const loginSchema = z.object({
  username: z.string().min(2, '用户名至少 2 个字符'),
  password: z.string().min(6, '密码至少 6 个字符'),
})

function zodCheck(schema: z.ZodType<any>) {
  return ({ value }: { value: unknown }) => {
    const r = schema.safeParse(value)
    return r.success ? undefined : r.error.errors.map((e) => e.message).join(', ')
  }
}

export function LoginPage() {
  const [isRegister, setIsRegister] = useState(false)
  const setTokens = useAuthStore((s) => s.setTokens)

  const form = useForm({
    defaultValues: { username: '', password: '' },
    onSubmit: ({ value }) => {
      if (isRegister) register.mutate({ ...value, displayName: value.username })
      else login.mutate(value)
    },
  })

  const login = trpc.auth.login.useMutation({
    onSuccess: (data) => { setTokens(data.accessToken, data.refreshToken, data.expiresAt); notifications.show({ title: '登录成功', message: '欢迎使用 IOMTea', color: 'green' }) },
    onError: (err) => form.setFieldMeta('password', (prev) => ({ ...prev, errorMap: { onServer: err.message } })),
  })

  const register = trpc.auth.register.useMutation({
    onSuccess: (data) => { setTokens(data.accessToken, data.refreshToken, data.expiresAt); notifications.show({ title: '注册成功', message: '已自动登录', color: 'green' }) },
    onError: (err) => form.setFieldMeta('password', (prev) => ({ ...prev, errorMap: { onServer: err.message } })),
  })

  return (
    <Container size={420} my={80}>
      <Title ta="center" c="blue">IOMTea</Title>
      <Text c="dimmed" size="sm" ta="center" mt={5}>健康数据监护平台</Text>
      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>
          <form.Field name="username" validators={{ onChange: zodCheck(loginSchema.shape.username) }}>
            {(field) => (
              <TextInput
                label="用户名"
                placeholder="demo"
                required
                autoComplete="username"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.currentTarget.value)}
                error={field.state.meta.errors?.[0]}
              />
            )}
          </form.Field>
          <form.Field name="password" validators={{ onChange: zodCheck(loginSchema.shape.password) }}>
            {(field) => (
              <PasswordInput
                label="密码"
                placeholder="demo123"
                required
                mt="md"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.currentTarget.value)}
                error={field.state.meta.errors?.[0] || (field.state.meta.errorMap as any)?.onServer}
              />
            )}
          </form.Field>
          <Button fullWidth mt="xl" type="submit" loading={login.isPending || register.isPending}>
            {isRegister ? '注册' : '登录'}
          </Button>
          <Button fullWidth mt="xs" variant="subtle" onClick={() => { setIsRegister(!isRegister); form.reset() }}>
            {isRegister ? '已有账号？登录' : '没有账号？注册'}
          </Button>
        </form>
      </Paper>
    </Container>
  )
}