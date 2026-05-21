import mqtt from 'mqtt'
import { routeMessage } from './router'
import { createChildLogger } from '../core/lib/logger'

const logger = createChildLogger('mqtt')

const TOPIC = 'users/+/+/+'
const ADMIN_TOPIC = 'users/+/admin/+'
const DEVICE_EVENTS_TOPIC = 'iomtea/device/+/events'

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
    logger.info('✓ MQTT Broker 已连接')

    client!.subscribe(TOPIC, { qos: 1 }, (err) => {
      if (err) {
        logger.error({ err }, '✗ MQTT 主题订阅失败')
      } else {
        logger.info(`√ 已订阅 PIN 数据主题: ${TOPIC}`)
      }
    })

    client!.subscribe(ADMIN_TOPIC, { qos: 1 }, (err) => {
      if (err) {
        logger.error({ err }, '✗ MQTT 管理主题订阅失败')
      } else {
        logger.info(`√ 已订阅管理主题: ${ADMIN_TOPIC}`)
      }
    })

    client!.subscribe(DEVICE_EVENTS_TOPIC, { qos: 1 }, (err) => {
      if (err) {
        logger.error({ err }, '✗ MQTT 设备事件主题订阅失败')
      } else {
        logger.info(`√ 已订阅设备事件主题: ${DEVICE_EVENTS_TOPIC}`)
      }
    })
  })

  client.on('message', async (topic, payload) => {
    try {
      await routeMessage(topic, payload, client ?? undefined)
    } catch (err) {
      logger.error({ err, topic }, 'MQTT 消息路由失败')
    }
  })

  client.on('error', (err) => {
    logger.error({ err }, 'MQTT 连接错误')
  })

  client.on('close', () => {
    logger.warn('MQTT Broker 连接已断开，将自动重连')
  })

  client.on('reconnect', () => {
    logger.info('MQTT 正在重连 ...')
  })

  client.on('offline', () => {
    logger.warn('MQTT 客户端离线')
  })

  return client
}

export function stopMqttListener(): void {
  if (client) {
    client.end()
    client = null
    logger.info('MQTT 监听已停止')
  }
}
