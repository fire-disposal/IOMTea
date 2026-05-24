# IOMTea — 居家健康物联网监控平台

> Internet of Medical Things Architecture — 居家/病区健康数据实时监控数字孪生系统

## 愿景

构建一套**可独立部署、端到端闭环**的居家健康监控系统：从传感设备数据接入 → 实时孪生仿真 → 异常告警处置 → 用药/随访管理，覆盖 Web 管理端、微信小程序用户端、Flutter 调试工具三端。目标用户为**居家养老/慢病管理场景**下的家庭成员、护理人员和机构管理者。

---

## 技术栈

| 层 | 技术 |
|---|------|
| 后端 | Node.js + Hono + tRPC v11 + Drizzle ORM + PostgreSQL |
| Web 前端 | React 19 + Vite 6 + Mantine v8 + React Three Fiber + react-router-dom |
| 微信小程序 | Taro 4 + React 18 |
| 实验工具 | Flutter 3.27 + Dart 3.6 |
| 协议网关 | MQTT 设备接入 (mqtt-ingest) |
| 共享契约 | Zod schemas + TypeScript types (`@iomtea/shared-types`) |
| 基础设施 | pnpm monorepo + Turborepo + Docker Compose + Biome |

---

## 各端完成度

### Server（后端）— 完成度 85%

| 能力 | 状态 | 备注 |
|------|------|------|
| JWT 认证 + 刷新令牌轮换 | ✅ | register/login/refresh/wechatLogin |
| RBAC 权限体系 (6 角色 × 16 权限) | ✅ | requirePermission 全覆盖 7 个子路由 |
| 患者 CRUD + 设备 CRUD | ✅ | 含分页、搜索、状态过滤 |
| 告警全生命周期 (指派→确认→处理→结案) | ✅ | 操作记录存入 events.tags |
| 用药管理 + 服药依从追踪 | ✅ | markTaken/markMissed + schedule |
| 预约/随访管理 | ✅ | CRUD + 状态机 |
| 数字孪生引擎 (5 种生理画像) | ✅ | 12 种生理指标实时仿真 |
| A* 寻路 + 行为规则引擎 | ✅ | 时间表驱动智能体移动 |
| 2D 居家地图系统 + 编辑器 | ✅ | Canvas 渲染 + Wall/Floor/Door 编辑 |
| 场景注入 (9 种临床场景) | ✅ | 一键触发异常模拟 |
| MQTT 设备数据接入 | ✅ | PIN 认证 + mattress 协议解析 |
| WebSocket 实时推送 | ✅ | JWT 鉴权, per-ward/per-map 订阅 |
| 批量查询优化 (listAll 端点) | ✅ | 消除 Global 页面的 N+1 查询 |
| 引擎状态持久化 | ❌ | 纯内存 Map, 重启丢失 |

### Web（管理端）— 完成度 75%

| 能力 | 状态 | 备注 |
|------|------|------|
| 工作台 (Dashboard) | ✅ | 统计卡片 + 最近告警列表 |
| 患者列表 + 创建/删除 | ✅ | 卡片视图 + 搜索 + 模态创建 |
| 患者详情 (概览/告警/用药/预约/档案/地图) | ✅ | 6 标签页 + 生命体征实时栏 |
| 数字孪生查看器 (Canvas 2D) | ✅ | 播放/暂停/倍速/场景注入/全屏 |
| 地图编辑器 | ✅ | 画笔工具绘制墙/门/地板 |
| 全局告警看板 (待处理/处理中/已完成) | ✅ | 三栏 Kanban + 指派下拉 |
| 全局用药/预约管理 | ✅ | 批量列表 + 患者链接 |
| 设备管理 + PIN 管理 | ✅ | CRUD + 复制/重置 |
| 健康趋势页 | ✅ | 患者选择 + 指标 × 时间范围图表 |
| 共享组件 (StatsBar, QueryGate) | ✅ | 消除模板代码 ~120 行 |
| 角色感知 UI (isAdmin) | ✅ | JWT 解码 → 侧边栏菜单动态显示 |
| 路由层类型安全 | ❌ | react-router-dom 路径字符串无类型检查 |
| 表单类型安全 | ❌ | Mantine useForm 依赖运行时验证 |

### 微信小程序（用户端）— 完成度 45%

| 能力 | 状态 | 备注 |
|------|------|------|
| 微信登录 + 演示登录 | ✅ | OAuth code2session |
| PIN 绑定/管理 | ✅ | 查看/复制/编辑昵称 |
| 首页 (问候 + 今日记录 + 本周动态) | ✅ | 快速记录入口 (血糖/血压/体重/用药) |
| 健康记录 (8 种指标) | ✅ | FormShell + NumberInput + SegmentPicker |
| 记录历史查看 | ✅ | 按类型过滤, 时间倒序 |
| 日历热力图 | ✅ | 月份导航 + 每日记录点 |
| 数据导出 CSV | ✅ | 多选模块 → 分享文件 |
| 健康目标设置 | ✅ | 血糖/体重/血压目标值 |
| 记录模块开关 + 提醒 | ✅ | 8 模块 toggle + 早晚睡前提醒 |
| 底部导航栏 (首页/健康/消息/我的) | ✅ | 自定义 TabBar 组件 |
| matchaGreen 主题统一 | ✅ | CSS 变量全部对齐品牌色 |
| 服务端数据同步 | ❌ | 仅本地存储, sync.ts 未连接 |
| 告警查看 | ⚠️ | 只读列表, 无处置操作 |
| 设备列表 | ⚠️ | 只读展示, 无绑定操作 |
| TypeScript 编译 | ⚠️ | 38 个预先存在的模块解析错误 |
| 消息页 | ❌ | 空占位页 "暂无消息" |

### Flutter（实验工具）— 完成度 30%

| 能力 | 状态 | 备注 |
|------|------|------|
| PIN 锁屏 + 本地验证 | ✅ | 安全漏洞已修复 |
| MQTT 设置 + 连接/发布 | ✅ | 连接前状态检查 |
| IMU 运动监测 (加速度计+陀螺仪) | ✅ | 实时波形渲染 |
| YOLO 视觉跌倒检测 | ✅ | 模型预检 + 错误提示 |
| 设置页 (更换/清除 PIN) | ✅ | 旧 PIN 校验 |
| matchaGreen 主题 | ✅ | Flutter ThemeData 统一 |
| BLE 调试 | ❌ | 声明但未实现 |
| 平台构建产物 | ❌ | 无 android/ios/ 目录 |

---

## 架构概览

采用 DDD-Lite 领域驱动设计，三个有界上下文：

1. **Core** — 用户认证、患者/设备 CRUD、事件存储、PIN 管理
2. **Twin** — 数字孪生引擎，生理仿真，A* 寻路，智能体行为
3. **MQTT-Ingest** — MQTT 设备数据接入

Context 间通过 Domain Event (`events` 表) 或 tRPC 调用通信，禁止跨 Context import 内部实现。

`@iomtea/shared-types` 作为跨端共享契约层 —— Zod schema 作为 single source of truth，server 端用于 tRPC input 校验，web/miniapp 端用于表单校验和类型推导。

详细说明见 [ARCHITECTURE.md](./docs/ARCHITECTURE.md)，代码导航见 [CODE_MAP.md](./docs/CODE_MAP.md)。

---

## 项目结构

```
iomtea/
├── apps/
│   ├── server/         # Hono + tRPC 后端
│   │   └── src/
│   │       ├── core/          # 核心上下文 (DB, Auth, CRUD)
│   │       ├── twin/          # 数字孪生引擎
│   │       └── mqtt-ingest/   # MQTT 设备数据接入
│   ├── web/            # Web 仪表盘 + 2D/3D 数字孪生
│   ├── miniapp/        # 微信小程序 (Taro)
│   └── flutter/        # Flutter 实验工具
├── packages/
│   └── shared-types/   # Zod 共享类型 + 居家地图引擎
└── docs/               # 架构规范 + 代码地图 + 审查报告
```

---

## 快速开始

### 前置条件
- Node.js >= 22, pnpm >= 9
- PostgreSQL 16 (本地或 Docker)
- (可选) Docker Compose, Flutter SDK 3.27+

### 本地开发

```bash
git clone https://github.com/fire-disposal/IOMTea.git && cd iomtea
pnpm install
cp .env.example .env
# 编辑 .env 设置 JWT_SECRET (>=16字符)
pnpm --filter @iomtea/server db:migrate
pnpm dev
# Web: http://localhost:5173  账号: demo / demo123
```

### 常用命令

```bash
pnpm dev                    # 启动全部开发服务
pnpm typecheck              # 全项目类型检查
pnpm lint                   # 代码检查 (Biome)
pnpm format                 # 代码格式化 (Biome)

# 选启动
pnpm --filter @iomtea/server dev
pnpm --filter @iomtea/web dev
pnpm --filter @iomtea/miniapp dev:weapp
cd apps/flutter && flutter run
```

---

## 关键环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql://127.0.0.1:5432/iomtea` |
| `JWT_SECRET` | JWT 签名密钥 (≥16字符) | 必填 |
| `JWT_EXPIRES_IN` | 访问令牌有效期 | `2h` |
| `JWT_REFRESH_EXPIRES_IN` | 刷新令牌有效期 | `7d` |
| `MQTT_ENABLED` | 启用 MQTT 设备接入 | `false` |
| `CORS_ORIGIN` | 允许的前端域名 | `http://localhost:5173` |
| `PORT` | 服务端口 | `3000` |

---

## 部署

`.github/workflows/` 包含 CI/CD 流水线（server / web / miniapp）。

---

## License

Private
