import mqtt from 'mqtt'
import { routeMessage } from './router'
import { createChildLogger } from '../core/lib/logger'

const logger = createChildLogger('mqtt')

const TOPIC = 'users/+/+/+'
const ADMIN_TOPIC = 'users/+/admin/+'
const DEVICE_EVENTS_TOPIC = 'iomtea/device/+/events'

let client: mqtt.MqttClient | null = null

function subscribeTopic(
  mqttClient: mqtt.MqttClient,
  topic: string,
  successMessage: string,
  failureMessage: string,
): void {
  mqttClient.subscribe(topic, { qos: 1 }, (err) => {
    if (err) {
      logger.error({ err }, failureMessage)
      return
    }
    logger.info(successMessage)
  })
}

export function startMqttListener(
  brokerUrl: string,
  opts?: { username?: string; password?: string },
): mqtt.MqttClient {
  const mqttClient = mqtt.connect(brokerUrl, {
    username: opts?.username,
    password: opts?.password,
    clientId: `iomtea-pin-${Date.now()}`,
    reconnectPeriod: 5000,
    connectTimeout: 30000,
    keepalive: 60,
    clean: true,
  })
  client = mqttClient

  mqttClient.on('connect', () => {
    logger.info('✓ MQTT Broker 已连接')
    subscribeTopic(mqttClient, TOPIC, `√ 已订阅 PIN 数据主题: ${TOPIC}`, '✗ MQTT 主题订阅失败')
    subscribeTopic(
      mqttClient,
      ADMIN_TOPIC,
      `√ 已订阅管理主题: ${ADMIN_TOPIC}`,
      '✗ MQTT 管理主题订阅失败',
    )
    subscribeTopic(
      mqttClient,
      DEVICE_EVENTS_TOPIC,
      `√ 已订阅设备事件主题: ${DEVICE_EVENTS_TOPIC}`,
      '✗ MQTT 设备事件主题订阅失败',
    )
  })

  mqttClient.on('message', async (topic, payload) => {
    try {
      await routeMessage(topic, payload, mqttClient)
    } catch (err) {
      logger.error({ err, topic }, 'MQTT 消息路由失败')
    }
  })

  mqttClient.on('error', (err) => {
    logger.error({ err }, 'MQTT 连接错误')
  })

  mqttClient.on('close', () => {
    logger.warn('MQTT Broker 连接已断开，将自动重连')
  })

  mqttClient.on('reconnect', () => {
    logger.info('MQTT 正在重连 ...')
  })

  mqttClient.on('offline', () => {
    logger.warn('MQTT 客户端离线')
  })

  return mqttClient
}

export function stopMqttListener(): void {
  if (client) {
    client.end()
    client = null
    logger.info('MQTT 监听已停止')
  }
}
