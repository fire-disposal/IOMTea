# IOMTea Developer Cheatsheet

> 护理研究技术基座平台 — Hono REST + React 19 + Taro 4 + PostgreSQL

## 快速上手（首次启动）

```bash
pnpm install                                                # 安装所有依赖
cd apps/server && pnpm db:push                              # 初始化数据库表
pnpm dev                                                    # 启动全栈（server + web）
```

打开浏览器：
- 前端：`http://localhost:5173`
- API 文档：`http://localhost:3000/docs`
- OpenAPI 规格：`http://localhost:3000/openapi.json`

---

## 日常开发（你每天用的）

```bash
pnpm dev                                    # 一键启动 server + web

cd apps/server && pnpm dev                  # 仅后端（tsx watch 热重载）
cd apps/web && pnpm dev                     # 仅前端（Vite, 端口 5173）

pnpm --filter @iomtea/miniapp dev:weapp     # 小程序（Taro watch）
```

---

## 数据库（改了 schema 后跑这个）

```bash
cd apps/server

# 三步流程：
pnpm db:generate                            # ① 生成 SQL migration 文件
pnpm db:migrate                             # ② 应用到数据库
# 或开发中直接：
pnpm db:push                                # 一步推送（跳过 migration）
```

> **什么地方改？** `apps/server/src/core/db/schema/*.ts` — 这些是 Drizzle 定义的单一数据源。
> 想手动跑特殊 migration？`npx tsx scripts/migrate-plans.ts`

---

## API 类型自动生成（改了路由后跑这个）

```
后端路由 createRoute()                openapi-typescript
───────────────────────────→  openapi.json  ─────────────────→  types.ts
  (运行时自动收集)            (31512 bytes)                   (2700+ lines)
```

```bash
# ① 生成 OpenAPI spec
cd apps/server && npx tsx scripts/gen-openapi.ts

# ② Web 端生成类型
cd apps/web && pnpm generate-api

# ③ 小程序端生成类型（同一份 spec）
cd apps/miniapp && pnpm generate-api
```

> 生成的 `src/api/types.ts` 文件已入 `.gitignore`，无需提交。
> Web 端的 `useGet<T>('/path')` 和 miniapp 的 `api.get<T>('/path')` 都通过这份类型获得编译期检查。

---

## 代码质量（提交前必跑）

```bash
pnpm typecheck                              # 全包 TS 类型检查
pnpm lint                                   # 全包 Biome lint
pnpm format                                 # 全包 Biome 格式化写入

# 单个包：
pnpm --filter @iomtea/server typecheck
pnpm --filter @iomtea/web    typecheck
pnpm --filter @iomtea/miniapp typecheck
```

---

## 项目结构速览

```
apps/server/src/               apps/web/src/pages/           apps/miniapp/src/pages/
├── routes/      12 个 REST    ├── LoginPage                 ├── index/     首页
│   ├── auth.ts     认证       ├── DashboardPage             ├── login/     WeChat 登录
│   ├── patients.ts CRUD       ├── PatientWall               ├── profile/   我的
│   ├── alerts.ts   告警       ├── AlertBoard                ├── plan/      健康计划
│   ├── data.ts     管道       ├── DataDashboard             ├── credit/    积分
│   ├── plans.ts    计划       ├── DataExportPage            └── ...
│   ├── credits.ts  积分       ├── SimulationPage
│   └── ...                    └── ...
├── core/pipeline/  数据引擎
├── core/db/        Drizzle
├── modules/twin/   数字孪生
└── middleware/      JWT + RBAC
```

---

## Taro 小程序（@iomtea/miniapp）

```bash
pnpm --filter @iomtea/miniapp dev:weapp    # 开发 + watch → 微信开发者工具打开 dist/
pnpm --filter @iomtea/miniapp build:weapp  # 生产打包
```

小程序使用 `Taro.request()` 封装在 `utils/api.ts`，API 调用方式与 Web 端保持一致：`api.get<T>('/path')`、`api.post<T>('/path', body)`。

---

## 构建

```bash
pnpm build                                  # 全包 tsc + Vite
pnpm --filter @iomtea/server build          # 仅后端
pnpm --filter @iomtea/web build             # 仅前端
```

---

## biome 参考

```bash
biome check .                               # 检查（不修改）
biome check --write .                       # 自动修复（建议）
biome check --fix --unsafe .                # 含 unsafe 修复
biome format --write .                      # 仅格式化
biome lint --write .                        # 仅 lint
```

> 配置在根目录 `biome.json`：2 空格缩进、单引号、无分号。CSS Modules 已启用。

---

## 缓存 & 环境清理

```bash
pnpm store prune                            # pnpm 全局缓存
rm -rf node_modules && pnpm install         # 清理重装
rm -rf apps/*/dist apps/*/.turbo            # 清理构建产物 + turbo 缓存
```

---

## 部署

`git tag v1.0.0 && git push --tags` → GitHub Actions 自动触发 `deploy-server.yml` 或 `deploy-web.yml`。

---

## Git

```bash
git status && git diff                      # 检查改动
git add -A                                  # 暂存全部
git commit -m "feat: xxx"                   # 中文信息，feat/fix/refactor 前缀
git push origin master
```
