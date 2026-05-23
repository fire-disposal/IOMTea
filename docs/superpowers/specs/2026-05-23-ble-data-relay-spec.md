# BLE Health Data Relay — 技术规范

> IOMTea Tools v1.0 BLE 接入层设计
> 2026-05-23

---

## 1. 架构概览

```
BLE Peripheral (手表/手环/血压计)
    │  BLE GATT (标准健康 Profile)
    ▼
IOMTea Android App
  ├── BleManager        # 扫描 / 连接 / 配对管理
  ├── GattParser        # 标准 GATT 特征值解析
  ├── HealthDataBuffer  # SQLite 离线缓冲
  └── DataRelay         # MQTT/HTTP 批量回传
    │
    ▼
Cloud Backend (MQTT topic 或 HTTP tRPC)
```

---

## 2. BLE 设备模型

```dart
class BleDevice {
  final String id;           // MAC address or UUID
  final String? name;        // 广播名称
  final int rssi;            // 信号强度
  final DeviceType type;     // 设备类型枚举
  final DateTime lastSeen;   // 最后发现时间
  final Map<String, dynamic> metadata; // 厂商数据
}

enum DeviceType {
  smartWatch,       // 智能手表
  fitnessBand,      // 手环
  bloodPressure,    // 血压计
  pulseOximeter,    // 血氧仪
  thermometer,      // 体温计
  glucoseMeter,     // 血糖仪
  weightScale,      // 体重秤
  generic,          // 未识别
}
```

## 3. 设备发现

### 3.1 扫描策略

| 阶段 | 参数 | 说明 |
|------|------|------|
| 前台扫描 | `scanMode: lowLatency`, 持续 30s | 用户手动搜索 |
| 后台保活 | `scanMode: balanced`, 每 60s 扫 10s | `BackgroundHealthService` 轮询 |
| 重连扫描 | 按白名单 MAC 过滤 | 仅扫描已配对设备 |

### 3.2 广播过滤

```
Service UUID 白名单:
  0x180D — Heart Rate
  0x1809 — Health Thermometer
  0x1810 — Blood Pressure
  0x1822 — Pulse Oximeter
  0x1808 — Glucose
  0x181D — Weight Scale
  0x180A — Device Information
```

厂商数据解析优先级：
1. **Apple** — manufacturer ID 0x004C (Nearby / iBeacon)
2. **Xiaomi** — `0xFE95` service data (Mi Band protocol)
3. **Huawei** — `0xFE31` / `0xFE3F` service data
4. **Generic** — 标准 GATT 发现所有服务

### 3.3 设备过滤规则

```
reject if:
  - lastSeen > 300s (5min 未广播)
  - rssi < -85 (信号太弱)
  - type == generic && has no known service UUID
  - alreadyConnected (同一设备不重复连接)
```

---

## 4. 连接管理

### 4.1 连接生命周期

```
SCAN → DISCOVER → CONNECT → DISCOVER_SERVICES → READ_CHARACTERISTICS
                                                    │
                                              SUBSCRIBE_NOTIFICATIONS
                                                    │
                                              DATA_STREAMING
                                                    │
                                              DISCONNECT (timeout/idle/remote)
```

### 4.2 连接参数

| 参数 | 值 | 说明 |
|------|-----|------|
| 连接超时 | 10s | GATT connect 超时 |
| MTU 协商 | 512 | 请求最大 MTU |
| 连接间隔 | 30ms (低延迟) / 100ms (平衡) | Android 建议值 |
| 从延迟 | 0 | 设备不跳过连接事件 |
| 监督超时 | 4s | 链路断开检测 |

### 4.3 自动重连

```
reconnect strategy:
  attempt 1—3: immediate retry
  attempt 4—6: exponential backoff (1s, 2s, 4s)
  attempt 7—10: linear (8s interval)
  after 10: mark as disconnected, notify UI, wait 60s before next cycle
```

### 4.4 连接池

```dart
class BleConnectionPool {
  static const maxConcurrent = 3;  // 最多同时连接 3 个设备

  Future<BleConnection> connect(BleDevice device);
  void disconnect(String deviceId);
  void disconnectAll();
  List<BleConnection> get active;
}
```

---

## 5. GATT 数据解析

### 5.1 Heart Rate (0x180D)

| 特征 | UUID | 格式 |
|------|------|------|
| Heart Rate Measurement | 0x2A37 | Flags(1B) + HR(1-2B) + EE(0-2B) + RR(0-2nB) |
| Body Sensor Location | 0x2A38 | UINT8 (0=Chest, 1=Wrist, ...) |

### 5.2 Blood Pressure (0x1810)

| 特征 | UUID | 格式 |
|------|------|------|
| BP Measurement | 0x2A35 | Flags(1B) + Systolic(SFLOAT) + Diastolic(SFLOAT) + MAP(SFLOAT) + Timestamp |
| BP Feature | 0x2A49 | 设备能力位掩码 |

### 5.3 Health Thermometer (0x1809)

| 特征 | UUID | 格式 |
|------|------|------|
| Temperature Measurement | 0x2A1C | Flags(1B) + Temp(FLOAT) + Timestamp(optional) |
| Temperature Type | 0x2A1D | UINT8 (1=Armpit, 2=Body, 6=Ear, ...) |

### 5.4 Pulse Oximeter (0x1822)

| 特征 | UUID | 格式 |
|------|------|------|
| PLX Spot-check | 0x2A5E | Flags(1B) + SpO2(SFLOAT) + PR(SFLOAT) + Timestamp(optional) |
| PLX Continuous | 0x2A5F | 同上，连续流 |

### 5.5 通用解析器接口

```dart
abstract class GattHealthParser {
  String get serviceUuid;           // 标准 GATT Service UUID
  List<String> get characteristicUuids;

  HealthReading? parse(Uint8List data, String characteristicUuid);
}

class HealthReading {
  final String metric;             // heart_rate, spo2, temperature, ...
  final double value;
  final String unit;               // bpm, %, celsius, mmHg, ...
  final DateTime timestamp;
  final Map<String, dynamic>? extra;
}
```

### 5.6 私有协议支持

对于非标准 GATT 设备（小米手环、华为手表），通过 `VendorProtocolPlugin` 接口扩展：

```dart
abstract class VendorProtocolPlugin {
  String get vendorName;            // xiaomi, huawei, fitbit
  List<int> get manufacturerIds;    // BLE manufacturer IDs
  bool canHandle(ScanResult result);
  Stream<HealthReading> parseStream(BluetoothDevice device);
}
```

---

## 6. 数据传输

### 6.1 本地缓冲

SQLite `ble_readings` 表：

```sql
CREATE TABLE ble_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,       -- MAC 地址
  device_name TEXT,              -- 广播名称
  metric TEXT NOT NULL,          -- heart_rate / spo2 / temperature / ...
  value REAL NOT NULL,
  unit TEXT NOT NULL,            -- bpm / % / celsius / mmHg
  timestamp INTEGER NOT NULL,    -- Unix ms
  synced INTEGER DEFAULT 0       -- 0:未上传, 1:已上传
);
```

缓冲策略：
- 每个设备最多 1000 条本地缓存
- 超过 1000 条 → 裁剪最早 500 条
- 联网时每 30s 批量上传一次（单次最多 50 条）

### 6.2 MQTT 回传

```
topic: iomtea/device/{deviceId}/ble_report
qos: 1
payload (JSON):
{
  "pin": "123456",
  "device_id": "AB:CD:EF:01:23:45",
  "readings": [
    {"metric":"heart_rate", "value":72, "unit":"bpm", "ts":1716460800000},
    {"metric":"spo2", "value":98, "unit":"%", "ts":1716460801000}
  ],
  "batch_id": "uuid-v4"
}
```

### 6.3 HTTP 回传

```
POST /trpc/homeGraph.reportDeviceEvent
Content-Type: application/json

{
  "pin": "123456",
  "deviceId": "AB:CD:EF:01:23:45",
  "event": "bleHealthObservation",
  "metric": "heart_rate",
  "value": 72,
  "unit": "bpm",
  "source": "ble_relay",
  "ble_device_name": "Mi Band 7"
}
```

---

## 7. 异常处理

| 场景 | 处理 |
|------|------|
| 连接超时 (10s) | 标记 disconnect，入重连队列 |
| GATT 错误 (133/137/257) | 断开重连（最多 3 次） |
| MTU 协商失败 | 降级到 MTU 23（默认） |
| 设备主动断连 | 移除重连队列，记入日志 |
| BLE 适配器不可用 | 通知用户开启蓝牙 |
| 权限被拒 | 引导到系统设置页 |
| 数据解析失败 | 丢弃本帧，记录错误次数，>5次标记设备 incompatible |
| SQLite 满 | 裁剪最旧 50% 记录 |
| MQTT 离线 | 入 sync_queue，定时重试 |
| 内存压力 | 暂停扫描，释放连接池中 idle > 30s 的设备 |

---

## 8. 安全

- 不存储任何 BLE 外设的认证密钥明文
- MQTT payload 中的 PIN 使用现有 PinService 认证体系
- 仅连接已知 Service UUID 列表中的设备，拒绝未知服务
- SQLite 数据库存储在 app 私有目录（无 root 无法访问）

---

## 9. 依赖

```yaml
# pubspec.yaml
flutter_blue_plus: ^2.2.1   # BLE (pub cache 已有)
```

---

## 10. UI 界面规划（后续）

| 页面 | 内容 |
|------|------|
| `BleScanPage` | 扫描列表（设备名、RSSI、类型图标），点击连接 |
| `BleDevicePage` | 已连接设备管理，实时读数卡片，历史图表 |
| `BleSettingsPage` | 扫描间隔、自动重连开关、白名单管理 |
