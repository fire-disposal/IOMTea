# IOMTea — 医疗健康物联网监控平台

> Internet of Medical Things Architecture — 居家/病区健康数据实时监控数字孪生系统

## 技术栈

| 层 | 技术 |
|---|------|
| 后端 | Node.js + Hono + tRPC v11 + Drizzle ORM + PostgreSQL |
| Web 前端 | React 19 + Vite 6 + Mantine v8 + React Three Fiber + Three.js 0.184 |
| 微信小程序 | Taro 4 + React 18 |
| 实验工具 | Flutter 3.27 + Dart 3.6 |
| 协议网关 | Rust + Tokio + rumqttc (MQTT) |
| 基础设施 | pnpm monorepo + Turborepo + Docker Compose + Biome |

## 快速开始

### 前置条件
- Node.js >= 22
- pnpm >= 9
- PostgreSQL 16 (本地或 Docker)
- (可选) Docker Compose

### 本地开发 (Docker)

```bash
# 1. 克隆 + 安装
git clone <repo-url> iomtea && cd iomtea
pnpm install

# 2. 配置环境
cp .env.example .env
# 编辑 .env 设置 DB_PASSWORD, JWT_SECRET (至少16字符)

# 3. 启动数据库 + MQTT + 服务
docker compose up -d

# 4. 打开浏览器
# Web: http://localhost:5173
# 账号: demo / demo123 (仅 DEMO_MODE=true 时可用)
```

### 本地开发 (无 Docker)

```bash
# 1. 确保 PostgreSQL 运行中，创建 iomtea 数据库
# 2. 复制配置
cp .env.example .env

# 3. .env 中设置:
#    DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/iomtea
#    JWT_SECRET=<至少16字符随机字符串>
#    DEMO_MODE=true (开发时启用演示数据)
#    MQTT_ENABLED=false (无 MQTT 时关闭)

# 4. 安装 + 迁移 + 启动
pnpm install
pnpm --filter @iomtea/server db:migrate
pnpm dev
```

### 关键环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql://127.0.0.1:5432/iomtea` |
| `JWT_SECRET` | JWT 签名密钥 (≥16字符) | 无默认值，必填 |
| `JWT_EXPIRES_IN` | JWT 访问令牌有效期 | `2h` |
| `JWT_REFRESH_EXPIRES_IN` | JWT 刷新令牌有效期 | `7d` |
| `DEMO_MODE` | 启用演示账号和仿真病房 | `false` |
| `CORS_ORIGIN` | 允许的前端域名 (逗号分隔) | `http://localhost:5173` |
| `MQTT_ENABLED` | 启用 MQTT 设备数据接入 | `false` |
| `MQTT_BROKER` | MQTT Broker 地址 | `mqtt://localhost:1883` |
| `PORT` | 服务端口 | `3000` |

Docker Compose 额外变量见 `.env.example`（`DB_PASSWORD`, `SERVER_PORT`, `WEB_PORT`, `IMAGE_REPO` 等）。

## 项目结构

```
iomtea/
├── apps/
│   ├── server/         # Hono + tRPC 后端
│   │   └── src/
│   │       ├── core/          # 核心上下文 (DB, Auth, CRUD)
│   │       ├── simulator/     # 生理仿真引擎 + 5种患者画像
│   │       ├── ingest/        # MQTT 数据接入 (智能床垫)
│   │       └── events/        # Domain Event 共享层
│   ├── web/            # Web 仪表盘 + 3D 数字孪生
│   ├── miniapp/        # 微信小程序 (Taro)
│   └── flutter/        # Flutter 实验工具 (MQTT/YOLO/IMU/BLE)
├── packages/
│   └── shared-types/   # Zod 共享类型
├── gateway/            # Rust TCP→MQTT 协议网关
├── docs/
│   ├── ARCHITECTURE.md   # 架构规范 (DDD-Lite)
│   └── CODE_MAP.md       # 代码地图 + 功能清单
├── docker-compose.yml
├── turbo.json
├── biome.json
└── pnpm-workspace.yaml
```

## 功能特性

| 功能 | 状态 |
|------|------|
| JWT 认证 (注册/登录/刷新) | ✅ |
| 患者 CRUD 管理 | ✅ |
| 设备 CRUD 管理 | ✅ |
| 5 种患者生理画像仿真 | ✅ |
| 12 种生理指标生成 (HR/RR/SpO2/体温/血压/血糖/体动/姿势/ECG/呼吸波形/体压分布) | ✅ |
| 9 种临床场景一键注入 | ✅ |
| 实时数据仪表盘 (2s 轮询) | ✅ |
| Web 3D 数字孪生 (R3F 瓦片程序化居家场景) | ✅ |
| 微信小程序 (6 页面) | ✅ |
| 智能床垫 MQTT 数据接入 | ✅ |
| Rust TCP→MQTT 协议网关 | ✅ |
| CI/CD (GitHub Actions → Docker → 自托管) | ✅ |

## 常用命令

```bash
pnpm dev              # 启动全部开发服务
pnpm typecheck        # 全项目类型检查
pnpm lint             # 全项目代码检查 (Biome)
pnpm build            # 全项目构建
pnpm format           # 全项目格式化 (Biome)

# 服务器相关
pnpm --filter @iomtea/server dev          # 仅启动后端
pnpm --filter @iomtea/server db:migrate   # 数据库迁移
pnpm --filter @iomtea/server db:generate  # 生成迁移文件

# Web 前端
pnpm --filter @iomtea/web dev             # 仅启动前端

# 小程序
pnpm --filter @iomtea/miniapp dev:weapp   # 微信小程序开发模式
```

## 架构概览

采用 DDD-Lite 领域驱动设计，三个有界上下文：

1. **Core** — 用户认证、患者/设备 CRUD、事件存储
2. **Simulator** — 生理仿真引擎，5 种患者画像，实时数据生成
3. **Ingest** — MQTT 设备接入，智能床垫数据解析，睡眠状态机

Context 间通过 Domain Event (`events` 表) 或 tRPC 调用通信，禁止跨 Context import 内部实现。

详细架构说明见 [ARCHITECTURE.md](./docs/ARCHITECTURE.md)，代码导航见 [CODE_MAP.md](./docs/CODE_MAP.md)。

## 部署

见 `.github/workflows/` 目录下的 CI/CD 配置。包含四个部署流水线：

- `deploy-server.yml` — 后端服务
- `deploy-web.yml` — Web 前端
- `deploy-gateway.yml` — Rust 协议网关
- `deploy-miniapp.yml` — 微信小程序

部署前需配置 GitHub Secrets: `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `DEPLOY_PATH`, `GITHUB_TOKEN`。

## License

Private
