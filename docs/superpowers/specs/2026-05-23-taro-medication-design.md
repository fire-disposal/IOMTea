# Taro 小程序 — 用药提醒功能设计

> 小程序端功能，Flutter 端不参与
> 2026-05-23

---

## 架构

```
微信小程序 (Taro)
├── 药品管理 (CRUD)
├── 定时任务触发器 (云函数 cron)
├── 微信订阅消息推送
└── 服药记录 + 统计
        │
        ▼
   Backend API (HTTP REST)
        │
        ▼
   PostgreSQL (同 Flutter 共享)
```

## 数据模型（PostgreSQL — 与 Flutter 共享同一库实例）

```sql
CREATE TABLE medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR(64) NOT NULL,       -- 药品名
  dosage VARCHAR(32) NOT NULL,     -- 剂量
  unit VARCHAR(8) DEFAULT '片',
  schedule JSONB NOT NULL,         -- [{"hour":8,"minute":0},{"hour":12,"minute":0}]
  weekdays INTEGER[] DEFAULT '{1,2,3,4,5,6,7}',
  note VARCHAR(128),
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE medication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id UUID REFERENCES medications(id) ON DELETE CASCADE,
  taken_at TIMESTAMPTZ NOT NULL,
  skipped BOOLEAN DEFAULT false
);
```

## API

```
GET    /api/v1/medications?userId=xxx
POST   /api/v1/medications          → {name, dosage, unit, schedule, ...}
PUT    /api/v1/medications/{id}
DELETE /api/v1/medications/{id}

POST   /api/v1/medications/{id}/log → {skipped: false}
GET    /api/v1/medications/{id}/logs?date=2026-05-23

GET    /api/v1/medications/today-status?userId=xxx
  ← { "items": [{name:"..", dosage:"..", nextTime:"14:00", taken:false}, ...] }
```

## 推送机制

不使用 Flutter 的 `flutter_local_notifications`。改用微信**订阅消息**：

1. 用户在小程序内授权「用药提醒」订阅模板
2. 后端云函数（cron）每分钟扫描 `medications` 表
3. 匹配到当前时间的用药计划 → 调用微信 `subscribeMessage.send` API
4. 推送到用户微信「服务通知」

```
云函数 hourlyCheck():
  for each medication WHERE enabled AND today IN weekdays:
    for each time in schedule:
      if time matches current time (±1min):
        查 log 表 → 今日此时段未服用 → 发订阅消息
```

## 小程序页面

```
/pages/medication/index     —— 用药列表（今日待服 + 全部计划）
/pages/medication/edit      —— 新增/编辑用药（表单页）
/pages/medication/history   —— 历史记录（日历 + 完成率）
```

## 编辑页交互

- 药品名：输入框
- 剂量 + 单位：数字框 + 选择器（片/粒/包/ml）
- 每日次数：横向 Chip 选择（1次~6次）
- 每次时间：时间选择器（pickTime），15分钟粒度
- 生效日期：多选 Chip（周一~周日）
- 备注：输入框（可选）
- 启用开关
- 保存按钮

## Flutter 与小程序分工

| 功能 | Flutter | Taro 小程序 |
|------|---------|------------|
| 用药提醒触发 | ❌ | ✅ 微信订阅消息 |
| 用药计划管理 UI | ❌ | ✅ 表单编辑页 |
| 服药记录查询 | ❌ | ✅ 历史日历视图 |
| 传感器采集 | ✅ | ❌ |
| 跌倒检测 | ✅ | ❌ |
