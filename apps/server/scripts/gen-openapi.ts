import { OpenAPIHono } from '@hono/zod-openapi'
import fs from 'node:fs'
import path from 'node:path'

import { auth } from '../src/routes/auth'
import { usersApp } from '../src/routes/users'
import { dashboard } from '../src/routes/dashboard'
import { pinsApp } from '../src/routes/pins'
import { tagsApp } from '../src/routes/tags'
import { patientsApp } from '../src/routes/patients'
import { alertsApp } from '../src/routes/alerts'
import { alertRulesApp } from '../src/routes/alertRules'
import { ingestApp } from '../src/routes/ingest'
import { dataApp } from '../src/routes/data'
import { exportApp } from '../src/routes/export'
import { twinApp } from '../src/routes/twin'
import { homeGraphApp } from '../src/routes/homeGraph'
import { nodeGraphApp } from '../src/routes/nodeGraph'

const app = new OpenAPIHono()

app.route('/auth', auth)
app.route('/users', usersApp)
app.route('/dashboard', dashboard)
app.route('/pins', pinsApp)
app.route('/tags', tagsApp)
app.route('/patients', patientsApp)
app.route('/alerts', alertsApp)
app.route('/alert-rules', alertRulesApp)
app.route('/ingest', ingestApp)
app.route('/data', dataApp)
app.route('/export', exportApp)
app.route('/twin', twinApp)
app.route('/home-graph', homeGraphApp)
app.route('/node-graph', nodeGraphApp)

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