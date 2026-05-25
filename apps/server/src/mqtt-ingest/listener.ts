import mqtt from 'mqtt'
import { createChildLogger } from '../core/lib/logger'
import { routeMessage } from './router'

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
  let reconnectAttempts = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  const MAX_RECONNECT = 3
  const BASE_DELAY_MS = 1000

  const mqttClient = mqtt.connect(brokerUrl, {
    username: opts?.username,
    password: opts?.password,
    clientId: `iomtea-pin-${Date.now()}`,
    reconnectPeriod: 0,
    connectTimeout: 30000,
    keepalive: 60,
    clean: true,
  })
  client = mqttClient

  const scheduleReconnect = () => {
    const delay = Math.min(BASE_DELAY_MS * Math.pow(2, reconnectAttempts), 30000)
    reconnectTimer = setTimeout(() => {
      mqttClient.reconnect()
    }, delay)
  }

  mqttClient.on('connect', () => {
    reconnectAttempts = 0
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
    logger.info('✓ MQTT Broker 已连接')
    subscribeTopic(mqttClient, TOPIC, `√ 已订阅 PIN 数据主题: ${TOPIC}`, '✗ MQTT 主题订阅失败')
    subscribeTopic(mqttClient, ADMIN_TOPIC, `√ 已订阅管理主题: ${ADMIN_TOPIC}`, '✗ MQTT 管理主题订阅失败')
    subscribeTopic(mqttClient, DEVICE_EVENTS_TOPIC, `√ 已订阅设备事件主题: ${DEVICE_EVENTS_TOPIC}`, '✗ MQTT 设备事件主题订阅失败')
  })

  mqttClient.on('message', async (topic, payload) => {
    try { await routeMessage(topic, payload, mqttClient) }
    catch (err) { logger.error({ err, topic }, 'MQTT 消息路由失败') }
  })

  mqttClient.on('error', (err) => {
    logger.error({ err }, 'MQTT 连接错误')
  })

  mqttClient.on('close', () => {
    reconnectAttempts++
    if (reconnectAttempts > MAX_RECONNECT) {
      logger.warn(`MQTT 重连已达上限 (${MAX_RECONNECT} 次)，放弃连接`)
      mqttClient.end()
      client = null
      return
    }
    const delay = Math.min(BASE_DELAY_MS * Math.pow(2, reconnectAttempts), 30000)
    logger.warn(`MQTT 断开，${delay / 1000}s 后重连 (${reconnectAttempts}/${MAX_RECONNECT})`)
    scheduleReconnect()
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
