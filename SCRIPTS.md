# Scripts

`p` = Root，`s` = `@iomtea/server`。均通过 `pnpm <script>` 运行。

## 质量控制（本地必跑）

```
pnpm typecheck          p   所有包类型检查
pnpm lint               p   Biome lint（代码质量）
pnpm format             p   Biome 格式化写入
pnpm --filter @iomtea/server check     s   typecheck + import 检查
pnpm --filter @iomtea/server typecheck s  仅 TS 类型
pnpm --filter @iomtea/server check:imports  s  检查 schema import 是否有 .js 后缀
```

## 数据库（@iomtea/server，本地运行）

```
db:generate    生成 SQL migration（改 schema 后跑）
db:migrate     应用未执行的 migration（需要 DATABASE_URL）
db:push        直接推送 schema 到 DB（开发用，无需 migration）
```

> **流程**：改 `src/core/db/schema/*.ts` → `db:generate` → 提交生成的 `drizzle/*.sql`。

## 开发运行

```
pnpm dev               p   所有包启动
pnpm --filter @iomtea/server dev  s  仅后端（tsx watch 热重载）
```

## 构建

```
pnpm build             p   所有包构建（tsc）
pnpm --filter @iomtea/server build  s  仅后端
```

## 测试

```
pnpm test              p   所有包测试
pnpm --filter @iomtea/server test  s  仅后端
pnpm --filter @iomtea/server test:watch  s  后端 watch 模式
```

## 部署

云端 CD 由 `.github/workflows/deploy-server.yml` 处理，tag 推送自动触发：

- `v*` → 完整 build+smoke+deploy+migrate
- `server@*` → build+smoke+deploy（不含 migration）
