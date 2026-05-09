import { Hono } from 'hono'
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
