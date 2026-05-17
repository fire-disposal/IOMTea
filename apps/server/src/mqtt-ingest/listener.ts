import pino from 'pino'
import mqtt from 'mqtt'
import { routeMessage } from './router'

const logger = pino({ name: 'mqtt-ingest:listener' })

const TOPIC = 'users/+/+/+'

let client: mqtt.MqttClient | null = null

export function startMqttListener(brokerUrl: string, opts?: { username?: string; password?: string }): mqtt.MqttClient {
  client = mqtt.connect(brokerUrl, {
    username: opts?.username,
    password: opts?.password,
    clientId: `iomtea-pin-${Date.now()}`,
    reconnectPeriod: 5000,
    connectTimeout: 30000,
    keepalive: 60,
    clean: true,
  })

  client.on('connect', () => {
    logger.info({ brokerUrl }, 'MQTT PIN connected')
    client!.subscribe(TOPIC, { qos: 1 }, (err) => {
      if (err) logger.error({ err }, 'subscribe error')
      else logger.info({ topic: TOPIC }, 'subscribed')
    })
  })

  client.on('message', async (topic, payload) => {
    try {
      await routeMessage(topic, payload)
    } catch (err) {
      logger.error({ err, topic }, 'route error')
    }
  })

  client.on('error', (err) => {
    logger.error({ err }, 'connection error')
  })

  client.on('close', () => {
    logger.warn('MQTT PIN disconnected')
  })

  return client
}

export function stopMqttListener(): void {
  if (client) {
    client.end()
    client = null
    logger.info('MQTT PIN stopped')
  }
}
