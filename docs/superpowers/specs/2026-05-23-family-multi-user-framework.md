# IOMTea Family Multi-User Framework — Design

> 2026-05-23

---

## 角色模型

| 角色 | 职责 | 权限 |
|------|------|------|
| **Admin** (监护人) | 管理设备、绑定老人、接收告警 | 全部：增删设备、查看所有数据、设置提醒 |
| **Member** (被监护人/老人) | 佩戴传感器设备 | 仅查看自己的数据 |
| **Viewer** (关注者) | 家属/医生 | 只读：查看被共享的数据，不可修改 |

一个家庭（Family）包含多个 User → 每个 User 可绑定多个 Device。

```
Family "张三的家"
├── User "张三" (admin, caregiver)
│   ├── Device "客厅主机" (Android phone, BLE hub)
│   └── Device "张三手环" (BLE)
├── User "张爷爷" (member, elderly)
│   └── Device "爷爷手环" (BLE)
└── User "李医生" (viewer)
    └── (只读共享数据)
```

## 数据隔离

| 数据 | 隔离级别 | 说明 |
|------|---------|------|
| health_events | device_id | 每设备独立 |
| ble_readings | device_id | 同上 |
| alerts | device_id | 同上 |
| medications | user_id | 一用户一套用药计划 |
| family membership | family_id | 成员关系 |

## 告警路由

```
Fall event (device=爷爷手环)
    ├── MQTT high priority → 后端
    ├── 本地通知 → 爷爷手机 (member)
    ├── Push/模板消息 → 张三 (admin)
    ├── Push/模板消息 → 所有 Admin 角色的家庭成员
    └── (可选) SMS → 紧急联系人
```

## 绑定流程

```
监护人（张三）                            被监护人（爷爷）
     │                                        │
     │  1. 创建 Family "张三的家"              │
     │  2. 生成邀请码 / QR 码                  │
     │                                        │
     │        3. 分享邀请码给爷爷              │
     │                                        │
     │                         4. 爷爷输入邀请码 + 自己的 PIN
     │                         5. 加入 Family, 角色=member
     │                                        │
     │  6. 张三在"设备管理"看到爷爷的设备      │
     │  7. 订阅爷爷的告警                     │
```

## 数据库扩展

```sql
ALTER TABLE devices ADD COLUMN family_id UUID REFERENCES families(id);
ALTER TABLE devices ADD COLUMN user_id UUID REFERENCES users(id);

CREATE TABLE families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(64) NOT NULL,
  invite_code VARCHAR(8) UNIQUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE family_members (
  family_id UUID REFERENCES families(id),
  user_id UUID REFERENCES users(id),
  role VARCHAR(16) NOT NULL DEFAULT 'member', -- admin / member / viewer
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (family_id, user_id)
);

CREATE TABLE alert_subscriptions (
  user_id UUID REFERENCES users(id),            -- 谁订阅
  target_device_id VARCHAR(64) NOT NULL,         -- 监控哪个设备
  alert_types TEXT[] DEFAULT '{fall}',           -- 订阅哪些告警类型
  push_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## API 扩展

```
POST   /api/v1/family/create            → {"name":"张三的家"} → {"inviteCode":"ABC123"}
POST   /api/v1/family/join              → {"inviteCode":"ABC123", "pin":"654321"}
GET    /api/v1/family/{id}/members      → [{"userId":"...","role":"admin"},...]
POST   /api/v1/alert/subscribe          → {"targetDeviceId":"...","types":["fall"]}
DELETE /api/v1/alert/unsubscribe        → {"targetDeviceId":"..."}
```
