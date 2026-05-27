import { loginSchema } from '@iomtea/shared-types'
import { Button, Container, Paper, PasswordInput, TextInput, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useForm } from '@tanstack/react-form'
import { useNavigate } from '@tanstack/react-router'
import type { AxiosError } from 'axios'
import { useState } from 'react'
import { http } from '../api/client'
import { useAuthStore } from '../store/auth'
import classes from './LoginPage.module.css'

function zodCheck(schema: {
  safeParse: (v: unknown) => { success: boolean; error?: { issues: { message: string }[] } }
}) {
  return ({ value }: { value: unknown }) => {
    const r = schema.safeParse(value)
    return r.success ? undefined : r.error?.issues.map((e) => e.message).join(', ')
  }
}

const particles = Array.from({ length: 32 }, (_, i) => ({
  id: i,
  left: `${Math.random() * 100}%`,
  top: `${Math.random() * 100}%`,
  animationDelay: `${Math.random() * 6}s`,
  animationDuration: `${4 + Math.random() * 8}s`,
  width: `${2 + Math.random() * 4}px`,
  height: `${2 + Math.random() * 4}px`,
}))

export function LoginPage() {
  const [isRegister, setIsRegister] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const setTokens = useAuthStore((s) => s.setTokens)
  const navigate = useNavigate()

  const handleAuthSuccess = (data: {
    accessToken: string
    refreshToken: string
    user: unknown
  }) => {
    setTokens(data.accessToken, data.refreshToken, Date.now() + 3600000)
    notifications.show({ title: '登录成功', message: '欢迎使用 IOMTea', color: 'green' })
    const params = new URLSearchParams(window.location.search)
    const redirect = params.get('redirect') || '/'
    navigate({ to: redirect })
  }

  const form = useForm({
    defaultValues: { username: '', password: '' },
    onSubmit: async ({ value }) => {
      setLoading(true)
      setError('')
      try {
        const endpoint = isRegister ? '/auth/register' : '/auth/login'
        const res = await http.post(endpoint, value)
        if (res.data.error) {
          setError(res.data.error)
        } else {
          handleAuthSuccess(res.data)
        }
      } catch (err) {
        const axiosErr = err as AxiosError<{ error?: string }>
        setError(axiosErr.response?.data?.error || axiosErr.message)
      } finally {
        setLoading(false)
      }
    },
  })

  return (
    <div className={classes.root}>
      <div className={classes.particles}>
        {particles.map((p) => (
          <div
            key={p.id}
            className={classes.particle}
            style={{
              left: p.left,
              top: p.top,
              animationDelay: p.animationDelay,
              animationDuration: p.animationDuration,
              width: p.width,
              height: p.height,
            }}
          />
        ))}
      </div>
      <div className={classes.shapeCube} />
      <div className={classes.shapeCircle} />
      <div className={classes.shapeTriangle} />

      <Container size={420} style={{ position: 'relative', zIndex: 1 }}>
        <Title
          ta="center"
          fz={36}
          fw={800}
          className={classes.title}
          style={{ textTransform: 'uppercase' }}
        >
          IOMTea
        </Title>
        <Title ta="center" order={6} fw={400} mt={4} className={classes.subtitle}>
          健康数据监护平台
        </Title>

        <Paper className={classes.card} p={32} mt={28} radius="lg">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              form.handleSubmit()
            }}
          >
            <form.Field
              name="username"
              validators={{ onChange: zodCheck(loginSchema.shape.username) }}
            >
              {(field) => (
                <TextInput
                  label="用户名"
                  placeholder="admin"
                  required
                  autoComplete="username"
                  value={field.state.value}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    field.handleChange(e.currentTarget.value)
                  }
                  error={field.state.meta.errors?.[0] || error}
                  styles={{
                    input: {
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#e2e8f0',
                      '&:focus': { borderColor: '#38b2ac' },
                    },
                    label: { color: '#a0aec0' },
                  }}
                />
              )}
            </form.Field>
            <form.Field
              name="password"
              validators={{ onChange: zodCheck(loginSchema.shape.password) }}
            >
              {(field) => (
                <PasswordInput
                  label="密码"
                  placeholder="admin123"
                  required
                  mt="md"
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  value={field.state.value}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    field.handleChange(e.currentTarget.value)
                  }
                  error={field.state.meta.errors?.[0]}
                  styles={{
                    input: {
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#e2e8f0',
                      '&:focus': { borderColor: '#38b2ac' },
                    },
                    label: { color: '#a0aec0' },
                    innerInput: { color: '#e2e8f0' },
                  }}
                />
              )}
            </form.Field>
            <Button
              fullWidth
              mt="xl"
              size="md"
              radius="md"
              type="submit"
              loading={loading}
              styles={{
                root: {
                  background: 'linear-gradient(135deg, #38b2ac, #48bb78)',
                  border: 'none',
                  fontWeight: 600,
                  '&:hover': { background: 'linear-gradient(135deg, #319795, #38a169)' },
                },
              }}
            >
              {isRegister ? '注册' : '登录'}
            </Button>
            <Button
              fullWidth
              mt="sm"
              variant="subtle"
              className={classes.toggleBtn}
              onClick={() => {
                setIsRegister(!isRegister)
                form.reset()
                setError('')
              }}
            >
              {isRegister ? '已有账号？登录' : '没有账号？注册'}
            </Button>
          </form>
        </Paper>
      </Container>
    </div>
  )
}
