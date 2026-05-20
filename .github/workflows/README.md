# CI/CD Workflows

## 触发规则

| 工作流 | 手动触发 | Push 触发 | PR 触发 | Tag 触发 |
|--------|----------|-----------|---------|----------|
| `ci.yml` | - | `master`/`main` | `master`/`main` | - |
| `deploy-web.yml` | `workflow_dispatch` | - | - | `v*` · `web@*` |
| `deploy-server.yml` | `workflow_dispatch` | - | - | `v*` · `server@*` |
| `deploy-miniapp.yml` | `workflow_dispatch` | - | - | `v*` · `weapp@*` |
| `flutter-ci.yml` | - | `master`/`main` (flutter paths) | `master`/`main` | - |
| `flutter-release.yml` | - | - | - | `flutter@*` |

### Tag 命名规范

| 模式 | 用途 | 示例 |
|------|------|------|
| `v1.2.3` | 全量版本发布（同时部署 web + server + miniapp 构建） | `git tag v1.0.0 && git push --tags` |
| `web@1.2.3` | 仅部署前端 | `git tag web@1.0.0 && git push --tags` |
| `server@1.2.3` | 仅部署后端（含数据库迁移） | `git tag server@1.0.0 && git push --tags` |
| `weapp@1.2.3` | 仅构建小程序制品 | `git tag weapp@1.0.0 && git push --tags` |
| `flutter@1.2.3` | 仅 Flutter 发布（构建 APK + Web） | `git tag flutter@1.0.0 && git push --tags` |

### Docker 镜像标签

- Tag 推送时：同时生成 `{tag-name}` 和 `{short-sha}` 标签
- 手动触发时：仅生成 `{short-sha}` 标签
- 镜像存储在 `ghcr.io/{owner}/{repo}/web` 和 `ghcr.io/{owner}/{repo}/server`

---

## 必需的 Repository Secrets

在 GitHub 仓库 `Settings → Secrets and variables → Actions` 中配置：

| Secret | 说明 | 用于哪些工作流 |
|--------|------|----------------|
| `SSH_HOST` | 部署服务器 IP 或域名 | `deploy-web`, `deploy-server` |
| `SSH_USER` | SSH 登录用户名 | `deploy-web`, `deploy-server` |
| `SSH_PRIVATE_KEY` | SSH 私钥（无密码） | `deploy-web`, `deploy-server` |
| `DEPLOY_PATH` | 服务器上 `docker-compose.yml` 所在目录 | `deploy-web`, `deploy-server` |

### SSH 配置步骤

```bash
# 在服务器上生成密钥对
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github-actions

# 将公钥加入 authorized_keys
cat ~/.ssh/github-actions.pub >> ~/.ssh/authorized_keys

# 将私钥内容添加到 GitHub Secrets → SSH_PRIVATE_KEY
cat ~/.ssh/github-actions
```

---

## 工作流说明

### `ci.yml` — 持续集成

每次 push / PR 到主分支时自动运行：

- **TypeCheck** — 对所有 5 个包并行运行 `tsc --noEmit`
- **Lint & Format** — `biome check` + `biome format --check`
- **Test** — 运行 `vitest`（shared-types, shared-mii, server）

### `deploy-web.yml` — 前端部署

1. Verify: TypeCheck 前端 + shared-types
2. Docker build: `apps/web/Dockerfile` → `nginx:alpine`
3. Push 镜像到 `ghcr.io`
4. SSH 到服务器 → `docker compose pull web && docker compose up -d web`
5. Health check: `curl http://{host}:80`（30 次重试）

### `deploy-server.yml` — 后端部署

1. Verify: TypeCheck 后端 + shared-types
2. Docker build: `apps/server/Dockerfile` → `node:22-alpine`
3. Push 镜像到 `ghcr.io`
4. SSH 到服务器 → `docker compose pull server && docker compose up -d server`
5. Health check: `curl http://{host}:3000/health`
6. **Tag 发布时**：自动执行 `docker compose run --rm server pnpm db:migrate`

### `deploy-miniapp.yml` — 小程序构建

1. Install deps（仅 miniapp 依赖链）
2. `taro build --type weapp`（微信小程序编译）
3. 上传 `apps/miniapp/dist/` 为构建制品（30 天保留）

> **关于微信小程序流水线化发布**：微信小程序不像 Docker 容器可完全自动化部署。发布流程需要人工在微信开发者工具中操作。推荐流程：
>
> 1. CI 构建制品 (`apps/miniapp/dist/`) 下载到本地
> 2. 在[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/devtools.html)中导入项目
> 3. 点击「上传」提交代码审核
> 4. 在 [微信公众平台](https://mp.weixin.qq.com) 提交审核并发布
>
> **半自动化方案**（可选）：使用 `miniprogram-ci`（微信官方 CI 工具）可在 CI 中直接上传代码到微信后台。需要配置 `project.config.json` 中的 `appid` 和上传密钥。参考：[miniprogram-ci 文档](https://developers.weixin.qq.com/miniprogram/dev/devtools/ci.html)

### `flutter-ci.yml` — Flutter 持续集成

每次 push/PR（仅 `apps/flutter/**` 变动时）：
- `flutter analyze`（静态分析）
- `flutter test`（单元测试）

### `flutter-release.yml` — Flutter 发布

Tag 触发 `flutter@*` 时：
- `flutter test`
- `flutter build apk --release` → 上传 APK 制品（90 天）
- `flutter build web --release` → 上传 Web 制品（90 天）

---

## 本地开发

```bash
# 完整 CI 模拟
pnpm install --frozen-lockfile
pnpm typecheck          # 所有包类型检查
pnpm exec biome check . # lint
pnpm test               # 运行测试

# 单独构建
pnpm --filter @iomtea/web build
pnpm --filter @iomtea/server build
pnpm --filter @iomtea/miniapp build:weapp
```
