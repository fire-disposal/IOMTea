import fs from 'node:fs'
import path from 'node:path'
import { OpenAPIHono } from '@hono/zod-openapi'

import { alertRulesApp } from '../src/routes/alertRules'
import { alertsApp } from '../src/routes/alerts'
import { auth } from '../src/routes/auth'
import { dashboard } from '../src/routes/dashboard'
import { dataApp } from '../src/routes/data'
import { exportApp } from '../src/routes/export'
import { ingestApp } from '../src/routes/ingest'
import { patientsApp } from '../src/routes/patients'
import { pinsApp } from '../src/routes/pins'
import { tagsApp } from '../src/routes/tags'
import { twinApp } from '../src/routes/twin'
import { usersApp } from '../src/routes/users'

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
