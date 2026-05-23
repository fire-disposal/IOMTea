# IOMTea Backend Design — 健康数据中继与分析系统

> 后端设计规范 v1.0
> 2026-05-23

---

## 1. 架构总览

```
┌─ Android App ─────────────────────────────────────┐
│  DataPipeline.ingest() → MQTT / HTTP              │
└──────────────┬───────────────────┬────────────────┘
               │                   │
               ▼                   ▼
┌── MQTT Broker ──┐  ┌── API Gateway (tRPC / REST) ──┐
│  EMQX / Mosquitto│  │  Nginx → tRPC-Go Server       │
└────────┬─────────┘  └──────────┬────────────────────┘
         │                       │
         ▼                       ▼
┌────────────────────────────────────────────────────┐
│                  Core Services                      │
│  ┌──────────┐ ┌──────────┐ ┌───────────────────┐   │
│  │ Auth     │ │ Ingest   │ │ Alert Engine       │   │
│  │ Service  │ │ Service  │ │ (fall→push/email)  │   │
│  └──────────┘ └──────────┘ └───────────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌───────────────────┐   │
│  │ Device   │ │ Query    │ │ Analytics          │   │
│  │ Registry │ │ Service  │ │ (daily summary)    │   │
│  └──────────┘ └──────────┘ └───────────────────┘   │
├────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │ PostgreSQL       │  │ Redis (cache / pubsub)  │  │
│  └─────────────────┘  └─────────────────────────┘  │
└────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────┐
│              Admin Dashboard (Web)                  │
│  设备管理 | 实时监测 | 历史数据 | 告警记录           │
└────────────────────────────────────────────────────┘
```

---

## 2. 技术栈建议

| 层 | 推荐 | 备选 |
|----|------|------|
| API 框架 | tRPC-Go | Gin + Protobuf |
| MQTT Broker | EMQX | Mosquitto (轻量) |
| 数据库 | PostgreSQL 15+ | MySQL 8.0 |
| 缓存 | Redis 7 | — |
| 消息队列 | Redis Streams | RabbitMQ / Kafka |
| 时序存储 | TimescaleDB (PG 扩展) | InfluxDB |
| 对象存储 | MinIO / S3 | 本地文件 |
| 容器编排 | Docker Compose | K8s |

---

## 3. 数据模型

### 3.1 PostgreSQL Schema

```sql
-- 设备注册表
CREATE TABLE devices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id     VARCHAR(64) NOT NULL UNIQUE,    -- app 生成
  pin           VARCHAR(16) NOT NULL,            -- 6位 PIN
  nickname      VARCHAR(64),
  label         VARCHAR(128),                    -- "客厅", "卧室"
  user_id       UUID REFERENCES users(id),
  platform      VARCHAR(16) DEFAULT 'android',   -- android / ios / esp32
  app_version   VARCHAR(16),
  last_seen     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_devices_pin ON devices(pin);
CREATE INDEX idx_devices_user ON devices(user_id);

-- 设备连接的 BLE 外设
CREATE TABLE ble_peripherals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id     VARCHAR(64) NOT NULL REFERENCES devices(device_id),
  ble_mac       VARCHAR(32) NOT NULL,            -- MAC 地址
  ble_name      VARCHAR(128),                    -- 广播名称
  device_type   VARCHAR(32) NOT NULL,            -- smartWatch / bloodPressure / ...
  vendor        VARCHAR(32),                     -- xiaomi / huawei / apple
  last_seen     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(device_id, ble_mac)
);

-- 健康事件（时序核心表）
-- 使用 TimescaleDB hypertable 自动分区
CREATE TABLE health_events (
  time          TIMESTAMPTZ NOT NULL,             -- 分区键
  device_id     VARCHAR(64) NOT NULL REFERENCES devices(device_id),
  event_type    VARCHAR(32) NOT NULL,             -- fall / activity_change / posture_change / ble_reading / ...
  subtype       VARCHAR(32),                      -- walking / running / standing / lying
  confidence    REAL,
  accel_x       REAL, accel_y       REAL, accel_z REAL,
  accel_mag     REAL,
  gyro_x        REAL, gyro_y        REAL, gyro_z  REAL,
  ble_metric    VARCHAR(32),                      -- heart_rate / spo2 / temperature / ...
  ble_value     REAL,
  ble_unit      VARCHAR(16),
  location_lat  DOUBLE PRECISION,
  location_lng  DOUBLE PRECISION,
  metadata      JSONB DEFAULT '{}',
  source        VARCHAR(32) DEFAULT 'iomtea-android'
);

SELECT create_hypertable('health_events', 'time');
CREATE INDEX idx_he_device_time ON health_events (device_id, time DESC);
CREATE INDEX idx_he_type_time ON health_events (event_type, time DESC);
CREATE INDEX idx_he_device_type_time ON health_events (device_id, event_type, time DESC);

-- 告警记录
CREATE TABLE alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id     VARCHAR(64) NOT NULL REFERENCES devices(device_id),
  alert_type    VARCHAR(32) NOT NULL,             -- fall / low_battery / disconnect / threshold
  severity      VARCHAR(16) NOT NULL DEFAULT 'warning', -- critical / warning / info
  message       TEXT,
  acknowledged  BOOLEAN NOT NULL DEFAULT false,
  acked_by      UUID REFERENCES users(id),
  acked_at      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 每日摘要（物化聚合）
CREATE TABLE daily_summaries (
  date          DATE NOT NULL,
  device_id     VARCHAR(64) NOT NULL REFERENCES devices(device_id),
  fall_count    INT DEFAULT 0,
  step_count    INT DEFAULT 0,
  hr_min        REAL, hr_max REAL, hr_avg REAL,
  spo2_min      REAL, spo2_max REAL, spo2_avg REAL,
  dominant_activity VARCHAR(32),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (date, device_id)
);

-- 用户（可选 Web 端管理）
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         VARCHAR(32) UNIQUE,
  wechat_openid VARCHAR(64),
  email         VARCHAR(128),
  display_name  VARCHAR(64),
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.2 Redis 数据结构

```
# 设备在线状态 (TTL 120s, 心跳刷新)
device:online:{deviceId} → {"ts": 1716..., "mqtt":true, "http":true}

# 实时最新读数 (供 Dashboard 轮询)
device:latest:{deviceId} → {
  "activity": "walking",
  "posture": "standing",
  "heart_rate": 72,
  "spo2": 98,
  "fall_count_today": 0,
  "step_count_today": 2340,
  "battery": 85,
  "updated_at": 1716460800000
}

# 推送设备映射 (极光/个推/FCM)
push:token:{userId} → ["token1", "token2"]
push:device:{deviceId} → userId
```

---

## 4. API 设计

### 4.1 数据上报

#### MQTT Topic 规范

```
topic: iomtea/device/{deviceId}/events

# 单事件
{
  "deviceId": "abc123",
  "pin": "123456",
  "event": "fall",
  "confidence": 0.92,
  "timestamp": 1716460800000,
  "accel_x": 1.2, "accel_y": 8.5, "accel_z": -3.1,
  "accel_mag": 12.3,
  "source": "iomtea-android"
}

# 批量事件
{
  "events": [
    {"event":"activity_change","subtype":"walking","confidence":0.85,"timestamp":...},
    {"event":"ble_reading","ble_metric":"heart_rate","ble_value":72,"ble_unit":"bpm","timestamp":...}
  ],
  "pin": "123456"
}
```

#### HTTP tRPC

```
POST /trpc/homeGraph.reportDeviceEvent
Content-Type: application/json

// 单事件 — 与 MQTT payload 相同
{
  "deviceId": "abc123",
  "pin": "123456",
  "event": "healthObservation",
  "metric": "heart_rate",
  "value": 72,
  "unit": "bpm",
  "timestamp": 1716460800000
}

// 批量事件 — 用于离线回传
{
  "events": [{...}, {...}],
  "deviceId": "abc123",
  "pin": "123456"
}
```

### 4.2 设备管理 API

```
POST   /api/v1/device/register        # PIN 绑定设备
  → { "pin": "123456", "deviceId": "abc123", "nickname": "客厅主机" }
  ← { "ok": true, "device": {...} }

POST   /api/v1/device/verify-pin      # 验证 PIN
  → { "pin": "123456" }
  ← { "valid": true, "deviceId": "abc123", "nickname": "..." }

GET    /api/v1/device/{deviceId}/status # 设备当前状态
  ← { "online": true, "activity": "walking", "battery": 85, ... }

DELETE /api/v1/device/{deviceId}       # 解绑设备
```

### 4.3 数据查询 API

```
GET /api/v1/health/{deviceId}/latest
  ← { "activity":"walking", "posture":"standing", "heart_rate":72, ... }

GET /api/v1/health/{deviceId}/events?type=fall&from=2026-05-20&to=2026-05-23&limit=100
  ← { "events": [{...}, {...}], "total": 42 }

GET /api/v1/health/{deviceId}/daily-summary?date=2026-05-23
  ← { "falls":0, "steps":5230, "hr_avg":71, "dominant":"walking" }

GET /api/v1/health/{deviceId}/timeline?from=2026-05-20&to=2026-05-23
  ← { "timeline": [
    {"ts":"08:15","event":"posture_change","subtype":"standing"},
    {"ts":"08:32","event":"activity_change","subtype":"walking"},
    {"ts":"09:00","event":"ble_reading","heart_rate":78},
    ...
  ]}
```

### 4.4 告警 API

```
GET  /api/v1/alerts/{deviceId}?status=unacknowledged
  ← { "alerts": [{...}] }

POST /api/v1/alerts/{alertId}/acknowledge
  → { "userId": "..." }
  ← { "ok": true }
```

### 4.5 BLE 数据管理

```
POST /api/v1/ble/{deviceId}/register-peripheral
  → { "ble_mac":"AB:CD:...","device_type":"bloodPressure","ble_name":"..." }
  ← { "ok":true }

GET  /api/v1/ble/{deviceId}/peripherals
  ← { "peripherals": [{...}] }

GET  /api/v1/ble/{deviceId}/{bleMac}/readings?metric=heart_rate&limit=100
  ← { "readings": [{...}] }
```

---

## 5. 实时处理流程

### 5.1 Fall Alert Pipeline

```
MQTT "fall" event
    │
    ▼
Alert Engine
    ├── 1. INSERT INTO health_events
    ├── 2. UPDATE daily_summaries SET fall_count+1
    ├── 3. INSERT INTO alerts (severity=critical)
    ├── 4. Redis PUBLISH "alert:new" → Web Dashboard WebSocket
    ├── 5. Push notification → 所有绑定的用户设备
    └── 6. (可选) SMS / 电话告警 → 紧急联系人
```

### 5.2 Health Summary Aggregation (CRON)

```sql
-- 每日凌晨 2:00 执行
INSERT INTO daily_summaries (date, device_id, ...)
SELECT
  CURRENT_DATE,
  device_id,
  COUNT(*) FILTER (WHERE event_type='fall') as fall_count,
  -- 步数、心率最值、主导活动等
FROM health_events
WHERE time >= CURRENT_DATE AND time < CURRENT_DATE + 1
GROUP BY device_id
ON CONFLICT (date, device_id) DO UPDATE SET ...;
```

---

## 6. 安全设计

| 维度 | 实现 |
|------|------|
| **设备认证** | PIN 码验证，首次连接后签发 JWT token (7天有效) |
| **MQTT ACL** | EMQX HTTP ACL 插件回调验证 PIN → 设备映射 |
| **API 鉴权** | JWT Bearer token + device-level scope |
| **传输加密** | MQTT → TLS 8883; HTTP → HTTPS |
| **数据隔离** | device_id 级别行级隔离，user_id 聚合 |
| **速率限制** | 每 device 100 事件/分钟 (超过警戒线告警) |
| **敏感字段** | PIN 仅存 hash (bcrypt)，不存明文 |

---

## 7. 部署拓扑

```
                        Internet
                           │
              ┌────────────┼────────────┐
              │            │            │
         MQTT (8883)   HTTPS (443)   WSS (443)
              │            │            │
         ┌────┴────┐  ┌───┴────┐  ┌───┴─────┐
         │  EMQX   │  │ Nginx  │  │  Web UI │
         └────┬────┘  └───┬────┘  └─────────┘
              │            │
         ┌────┴────────────┴────┐
         │   tRPC-Go Server     │
         │  (Ingest + Query)    │
         └──────────┬───────────┘
                    │
         ┌──────────┼──────────┐
         │          │          │
    PostgreSQL   Redis     MinIO (备份)
    (TimescaleDB)
```

## 8. 最小可行部署

如果后端尚未搭建，最小部署方案：

```
docker-compose.yml:
  postgres:     # 健康事件存储
  emqx:         # MQTT broker
  redis:        # 设备在线状态
  trpc-server:  # 接收上报 + 基础查询
```

开发阶段可先用单节点 PostgreSQL + EMQX 社区版跑通链路。TimescaleDB 和 Redis 可后续按需追加。
