import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { trpcServer } from '@hono/trpc-server'
import { serve } from '@hono/node-server'
import { appRouter } from './trpc/routers/_app'
import { createContext } from './trpc/context'
import { env } from './env'
import pino from 'pino'

const logger = pino({
  transport: { target: 'pino-pretty', options: { colorize: true } },
})

const app = new Hono()

app.use('*', cors({
  origin: ['http://localhost:5173'],
  credentials: true,
}))

app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
    createContext,
  }),
)

app.get('/health', (c) => c.json({ status: 'ok' }))

logger.info({ port: env.PORT }, 'starting server')
serve({ fetch: app.fetch, port: env.PORT })

export type { AppRouter } from './trpc/routers/_app'
