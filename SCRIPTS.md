# IOMTea Developer Cheatsheet

所有命令在 monorepo 根目录运行。`p`=根, `s`=server, `w`=web, `m`=miniapp。

## 质量控制

```bash
pnpm typecheck            # p  全包 TS 类型检查
pnpm lint                 # p  全包 Biome lint
pnpm format               # p  全包 Biome 格式化

# 单独检查
pnpm --filter @iomtea/server typecheck  # s  TS 检查
pnpm --filter @iomtea/web    typecheck  # w  TS 检查
pnpm --filter @iomtea/miniapp typecheck # m  TS 检查

pnpm --filter @iomtea/server lint       # s  Biome lint
pnpm --filter @iomtea/web    lint       # w  Biome lint
```

## 开发运行

```bash
pnpm dev                  # p  全包启动（turbo）
pnpm --filter @iomtea/server dev   # s  后端 tsx watch 热重载
pnpm --filter @iomtea/web    dev   # w  Vite dev server (5173)
pnpm --filter @iomtea/miniapp dev:weapp  # m  Taro 微信小程序 watch
```

## 数据库（s）

```bash
cd apps/server
pnpm db:generate   # 改 schema 后生成 SQL migration
pnpm db:migrate    # 应用未执行 migration（需要 DATABASE_URL）
pnpm db:push       # 直接推送 schema 到 DB（开发用，跳过 migration）
```

> **流程**：改 `src/core/db/schema/*.ts` → `db:generate` → `db:migrate`（或 `db:push` 快速开发）。

## OpenAPI & 类型生成

```bash
# 1. 先生成 OpenAPI spec（需要后端 DB 可连）
cd apps/server
npx tsx scripts/gen-openapi.ts          # 离线生成 openapi.json

# 2. 从 spec 生成 TypeScript 类型
cd apps/web && pnpm generate-api        # w  生成 src/api/types.ts
cd apps/miniapp && pnpm generate-api    # m  生成 src/api/types.ts
```

> 类型文件 `src/api/types.ts` 已 gitignore，由 `openapi-typescript` 从本地 `openapi.json` 生成。

## Taro 小程序（m）

```bash
pnpm --filter @iomtea/miniapp dev:weapp    # 开发 + watch
pnpm --filter @iomtea/miniapp build:weapp  # 生产打包
```

## 构建 & 部署

```bash
pnpm build               # p  全包 tsc + Vite 构建
pnpm --filter @iomtea/server build  # s  仅后端 tsc
pnpm --filter @iomtea/web    build  # w  tsc + Vite build
pnpm preview              # w  Vite 预览构建结果
```

## 缓存清理

```bash
pnpm store prune          # 清理 pnpm 全局缓存
rm -rf node_modules && pnpm install   # 清理重装依赖
rm -rf apps/*/dist        # 清理构建产物
rm -rf apps/*/.turbo      # 清理 turbo 缓存
```

## Biome 常用

```bash
biome check .             # 全项目检查（不修改）
biome check --write .     # 自动修复
biome check --fix --unsafe .  # 含 unsafe 修复
biome check --apply .     # 同 --write（旧语法）
biome format --write .    # 仅格式化
biome lint --write .      # 仅 lint 修复
```

## 数据库迁移脚本（手动）

```bash
cd apps/server
npx tsx scripts/migrate-plans.ts   # 手动建 plans/credits 表
npx tsx scripts/gen-openapi.ts     # 生成 OpenAPI spec
```

## Git 约定

- 提交信息：中文，feat/fix/refactor 前缀
- 当前分支：`master`
- 推送：`git push origin master`
