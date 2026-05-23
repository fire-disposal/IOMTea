# 轻量级设备在线状态服务

> 零数据库依赖，纯内存 + MQTT retained 消息驱动
> 2026-05-23

---

## 原理

```
App 连接/断线 → MQTT retained: iomtea/device/{deviceId}/status {"online":true/false}
                                    │
                                    ▼
              Backend MemoryCache (Map<string, DeviceStatus>)
                                    │
                                    ▼
                    GET /api/v1/device/online?pin=123456
                    GET /api/v1/device/online/all
```

EMQX 的 retained 消息会自动分发给所有订阅者。后端启动时订阅 `iomtea/device/+/status` 即可实时同步所有设备状态到内存，无需任何数据库。

---

## 实现（Go 伪代码）

```go
type DeviceStatus struct {
    Online    bool   `json:"online"`
    Timestamp int64  `json:"ts"`
    Version   string `json:"version"`
}

var cache sync.Map // map[string]DeviceStatus, key=deviceId

func InitMQTTSubscriber() {
    client.Subscribe("iomtea/device/+/status", 1, func(topic string, payload []byte) {
        deviceId := extractDeviceId(topic) // "iomtea/device/{id}/status"
        var s DeviceStatus
        json.Unmarshal(payload, &s)
        cache.Store(deviceId, s)
    })
}

// HTTP Handler
func GetDeviceOnline(w http.ResponseWriter, r *http.Request) {
    pin := r.URL.Query().Get("pin")
    deviceId := resolveDeviceId(pin) // 从内存 PIN→deviceId 映射
    v, ok := cache.Load(deviceId)
    if !ok {
        json.NewEncoder(w).Encode(map[string]any{"online": false, "reason": "never_connected"})
        return
    }
    json.NewEncoder(w).Encode(v)
}

func GetAllOnlineDevices(w http.ResponseWriter, r *http.Request) {
    result := map[string]DeviceStatus{}
    cache.Range(func(k, v any) bool {
        result[k.(string)] = v.(DeviceStatus)
        return true
    })
    json.NewEncoder(w).Encode(result)
}
```

---

## API

```
GET /api/v1/device/online?pin=123456
  → {"online": true, "ts": 1716460800000, "version": "1.0.0"}

GET /api/v1/device/online/all
  → {
      "abc123": {"online": true, "ts": 1716460800000, "version": "1.0.0"},
      "def456": {"online": false, "ts": 1716460700000, "version": "1.0.0"}
    }
```

---

## 为什么不需要数据库

| 数据 | 存储方式 | 原因 |
|------|---------|------|
| 在线状态 | MQTT retained + 内存 | retained 消息由 broker 持久化，重启后自动恢复。只需内存加速查询 |
| PIN→deviceId | 内存 | 设备注册时写入内存，量小（家庭场景 <100 台），重启从 MQTT 重载 |
| 历史上线记录 | 不需要 | 仅查询"当前"状态，不涉及历史 |

如需持久化历史，可在 `health_events` 表中记录 `event_type='online'/'offline'` 事件。
