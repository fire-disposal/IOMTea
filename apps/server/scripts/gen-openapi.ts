import fs from 'node:fs'
import path from 'node:path'
import { OpenAPIHono } from '@hono/zod-openapi'

import { alertRulesRouter } from '../src/routes/alert-rules'
import { alertsRouter } from '../src/routes/alerts'
import { auth } from '../src/routes/auth'
import { creditsRouter } from '../src/routes/credits'
import { dashboard } from '../src/routes/dashboard'
import { dataRouter } from '../src/routes/data'
import { emaRouter } from '../src/routes/ema'
import { exportRouter } from '../src/routes/export'
import { ingestRouter } from '../src/routes/ingest'
import { patientsRouter } from '../src/routes/patients'
import { pinsRouter } from '../src/routes/pins'
import { plansRouter } from '../src/routes/plans'
import { tagsRouter } from '../src/routes/tags'
import { twinRouter } from '../src/routes/twin'
import { usersRouter } from '../src/routes/users'

const app = new OpenAPIHono()

app.route('/auth', auth)
app.route('/users', usersRouter)
app.route('/dashboard', dashboard)
app.route('/pins', pinsRouter)
app.route('/tags', tagsRouter)
app.route('/patients', patientsRouter)
app.route('/alerts', alertsRouter)
app.route('/alert-rules', alertRulesRouter)
app.route('/ingest', ingestRouter)
app.route('/data', dataRouter)
app.route('/export', exportRouter)
app.route('/twin', twinRouter)
app.route('/plans', plansRouter)
app.route('/credits', creditsRouter)
app.route('/ema', emaRouter)

const partialDoc = (app as any).getOpenAPIDocument()
const doc = {
  openapi: '3.0.0',
  info: { title: 'IOMTea API', version: '2.0.0', description: 'Home health IoT monitoring' },
  ...partialDoc,
}

const outPath = path.resolve(import.meta.dirname, '..', 'openapi.json')
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2), 'utf-8')
console.log(`OpenAPI spec written to ${outPath} (${JSON.stringify(doc).length} bytes)`)
process.exit(0)
