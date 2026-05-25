# 前端路由简化：TanStack Router 文件路由 → Code API

> 日期：2026-05-25
> 目标：消除 21 个透传路由文件 + routeTree.gen.ts，收敛为单文件路由定义

## 背景

当前使用 TanStack Router file-based routing：
- 21 个路由文件，76%（16 个）为 5 行透传
- `routeTree.gen.ts` 489 行自动生成
- 文件命名约定（dots/$id）不够直观

保留：tRPC 端到端类型安全、所有 page 组件、TanStack Router 类型安全导航。

## 方案

迁移至 TanStack Router code-based API（同库，不同 API 风格）：

### 核心变化

| 变化 | 说明 |
|------|------|
| 删除 | `routes/*.tsx` (21 文件) + `routeTree.gen.ts` |
| 新增 | `routes.tsx` (单文件 ~80 行路由定义) |
| 修改 | `main.tsx` — 改用显式 createRouter |
| 不变 | `pages/` 全部组件、`trpc.ts`、`theme.ts`、`StoreProvider.tsx` |

### 路由树结构

```
rootRoute
  ├── loginRoute (/login) → LoginPage
  └── authRoute (_auth)
      ├── / → DashboardPage
      ├── /patients → PatientWall
      ├── /patients/$id → PatientDetailShell
      │   ├── / → PatientOverview
      │   ├── /alerts → PatientAlerts
      │   ├── /alert-rules → PatientAlertRules
      │   ├── /medications → PatientMedications
      │   ├── /profile → PatientProfile
      │   ├── /health-timeline → HealthTimeline
      │   └── /map-editor → MapEditor
      ├── /alerts → AlertBoard
      ├── /medications → GlobalMedications
      ├── /data-dashboard → DataDashboard
      ├── /data-export → DataExport
      ├── /simulation → SimPage
      ├── /iot/pins → PinManagement
      └── /settings
          └── /users → UserManagement
```

### 导航类型安全保持

```typescript
// navigate 保持编译期类型检查
navigate({ to: '/patients/$id/medications', params: { id } })

// useParams 保持类型推导
const { id } = useParams({ from: '/_auth/patients/$id' })
```

## 迁移步骤

1. 创建 `routes.tsx`，定义完整路由树
2. 修改 `main.tsx`，替换 createRouter 创建方式
3. 删除 `routes/` 目录下所有文件
4. 删除 `routeTree.gen.ts`
5. 验证所有页面正常渲染
6. 运行 typecheck + lint
