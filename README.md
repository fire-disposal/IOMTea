# IOMTea

给居家养老和慢病管理做的健康数据平台：设备数据进来，仿真和真实记录落到同一张事件表，家属、护理员、机构管理者看同一份数据。

**状态**：Server 85% / Web 75% / 微信小程序 45% / Flutter 实验工具 30%；**入口**：本地运行，`http://localhost:5173`，演示账号由 seed 生成；**仓库**：[fire-disposal/IOMTea](https://github.com/fire-disposal/IOMTea)

## 本质

把 MQTT 设备与仿真画像写成同一张事件表的居家/病区健康数据平台。

## 选型

基于 Hono + React 的 pnpm monorepo，前端 React + Mantine，后端 Hono + OpenAPI，数据 PostgreSQL + Drizzle，部署 Docker Compose。

- 前端
  - React 19
    - Vite
    - TanStack Query
    - TanStack Router
    - TanStack Table
    - TanStack Form
    - Mantine 8
    - Recharts
    - @xyflow/react
    - Zustand
  - 小程序
    - Taro 4
      - React 18
      - NutUI
  - Flutter
    - mqtt_client
    - sensors_plus
- 后端
  - Hono
    - @hono/zod-openapi
    - openapi-typescript
    - jose
    - @node-rs/argon2
    - ws
    - mqtt
- 数据
  - PostgreSQL 16
    - Drizzle ORM
      - drizzle-kit
  - Mosquitto
- 共享
  - Zod
  - @iomtea/shared-types
  - @iomtea/avatar-core
- 工程
  - pnpm
  - Turborepo
  - Biome
- 部署
  - Docker Compose
  - GHCR

## 功能

- Server 14 组路由：auth / users / dashboard / pins / tags / patients / alerts / alert-rules / ingest / data / export / twin / plans / credits
- RBAC 3 角色 × 14 权限；告警状态机 new → assigned → acknowledged → handled → resolved → closed，处置记录写 `events.tags`
- 数字孪生：5 种生理画像、每种 10 个指标、8 种场景注入；仿真状态只在内存
- 接入：MQTT 订阅 `users/+/+/+`、`users/+/admin/+`、`iomtea/device/+/events`，另有 `POST /ingest/single`；WebSocket `/ws` 按患者订阅
- 计划即问卷模板（choice / multi / likert / vas / number / text），完成后按 `rewardCredits` 记积分
- Web 15 个页面组件：Dashboard、患者列表与详情、告警看板与规则、健康时间线、数据看板与导出、模拟工厂、PIN、计划、用户
- 小程序：登录、8 类健康记录、历史、日历热图、CSV 导出、目标与提醒、积分；`sync.ts` 未连服务端
- Flutter：PIN 锁屏、MQTT、IMU 波形、YOLO 跌倒检测；BLE 未实现，无 `android/`、`ios/` 目录

## 启动流程

```bash
git clone https://github.com/fire-disposal/IOMTea.git && cd IOMTea
pnpm install
cp .env.example .env          # JWT_SECRET 改成 >=16 位随机串
pnpm --filter @iomtea/server db:migrate
pnpm dev                      # web 5173 + server 3000

pnpm --filter @iomtea/miniapp dev:weapp    # 产物导入微信开发者工具
cd apps/flutter && flutter run

docker compose up -d          # postgres + mosquitto + server + web
```

需要 Node 24、pnpm 9.15.9、PostgreSQL 16；OpenAPI 文档在 `http://localhost:3000/docs`。

## 边界与已知问题

- 仿真引擎是内存 Map，进程重启后所有 simulation 消失
- `devices` 表已删除，设备统一用 `users_pin` 的 PIN 标识；旧 README 的“设备 CRUD”不再成立
- 文档与代码不一致（以代码为准）：文档写的 tRPC、React Three Fiber、6 角色 × 16 权限、12 种生理指标、用药/随访模块、A* 寻路与地图编辑器，都没有对应实现，指标实际 10 个、角色 3 个
- `TCP_INGEST_PORT` 只在 `env.ts` 与 compose 中声明，没有 TCP 监听，5858 实际空着
- Web 路由与 Mantine 表单靠运行时校验，类型安全只到 API 层
- 小程序 TypeScript 编译有模块解析错误，消息页是空占位
- `.github/workflows/README.md` 描述的 `ci.yml`、`deploy-miniapp.yml` 已不存在
- 超级管理员初始口令只能本地用，部署前必须覆盖

## 文档索引

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 架构
- [docs/CODE_MAP.md](docs/CODE_MAP.md) — 代码地图
- [docs/UX_GAP_ANALYSIS.md](docs/UX_GAP_ANALYSIS.md) — 体验差距
- [SCRIPTS.md](SCRIPTS.md) — 脚本
