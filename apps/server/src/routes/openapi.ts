import { OpenAPIHono } from '@hono/zod-openapi'

const openapiApp = new OpenAPIHono()

openapiApp.doc('/openapi.json', {
  openapi: '3.0.0',
  info: {
    title: 'IOMTea API',
    version: '2.0.0',
    description: 'Home health IoT monitoring platform — REST API',
  },
})

export { openapiApp }
