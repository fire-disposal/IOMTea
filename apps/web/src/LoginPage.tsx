import { Alert, Button, Container, Paper, PasswordInput, Text, TextInput, Title } from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { useAuthStore } from './store/auth'
import { trpc } from './trpc'

export function LoginPage() {
  const [isRegister, setIsRegister] = useState(false)
  const setTokens = useAuthStore((s) => s.setTokens)

  const form = useForm({
    initialValues: { username: '', password: '' },
    validate: {
      username: (v: string) => (v.trim().length >= 2 ? null : '用户名至少 2 个字符'),
      password: (v: string) => (v.length >= 6 ? null : '密码至少 6 个字符'),
    },
  })

  const login = trpc.auth.login.useMutation({
    onSuccess: (data) => { setTokens(data.accessToken, data.refreshToken, data.expiresAt); notifications.show({ title: '登录成功', message: '欢迎使用 IOMTea', color: 'green' }) },
    onError: (err) => form.setFieldError('password', err.message),
  })

  const register = trpc.auth.register.useMutation({
    onSuccess: (data) => { setTokens(data.accessToken, data.refreshToken, data.expiresAt); notifications.show({ title: '注册成功', message: '已自动登录', color: 'green' }) },
    onError: (err) => form.setFieldError('password', err.message),
  })

  return (
    <Container size={420} my={80}>
      <Title ta="center" c="blue">IOMTea</Title>
      <Text c="dimmed" size="sm" ta="center" mt={5}>健康数据监护平台</Text>
      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <form onSubmit={form.onSubmit(() => isRegister ? register.mutate({ ...form.values, displayName: form.values.username }) : login.mutate(form.values))}>
          <TextInput label="用户名" placeholder="demo" required autoComplete="username" {...form.getInputProps('username')} />
          <PasswordInput label="密码" placeholder="demo123" required mt="md" autoComplete={isRegister ? 'new-password' : 'current-password'} {...form.getInputProps('password')} />
          <Button fullWidth mt="xl" type="submit" loading={login.isPending || register.isPending}>{isRegister ? '注册' : '登录'}</Button>
          <Button fullWidth mt="xs" variant="subtle" onClick={() => { setIsRegister(!isRegister); form.reset() }}>{isRegister ? '已有账号？登录' : '没有账号？注册'}</Button>
        </form>
      </Paper>
    </Container>
  )
}
