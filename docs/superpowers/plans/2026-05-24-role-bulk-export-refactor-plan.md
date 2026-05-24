# 角色体系重构 + 批量管理 + 数据导出 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构角色体系为三层 (super_admin/admin/user)，新增标签系统、CSV 批量导入、批量操作与激活追踪、数据导出、模拟数据工厂，同时重建侧边栏、修复骨架屏、补全空白页面。

**Architecture:** 后端 tRPC 路由新增 tag/export/sim 模块；前端 TanStack Router 路由重建侧边栏结构；新增 `/data-export`、`/simulation`、`/alerts` 页面；新模拟引擎 `apps/server/src/sim/` 从 Twin Engine 移植生理模型，改用独立 Timer 编排。

**Tech Stack:** TypeScript, Drizzle ORM, tRPC, React, Mantine UI, TanStack Router, TanStack Query, Zustand

---

## Phase A: 角色体系 + 标签系统

### Task 1: 更新 role 枚举 + env schema

**Files:**
- Modify: `apps/server/src/core/db/schema/enums.ts:4-11`
- Modify: `apps/server/src/env.ts:1-22`
- Modify: `.env.example:1-5`
- Modify: `docker-compose.yml:47`

- [ ] **Step 1: 更新 roleEnum 枚举值**

```typescript
// apps/server/src/core/db/schema/enums.ts:4-11
export const roleEnum = pgEnum('role', ['super_admin', 'admin', 'user'])
```

同步更新下方 TypeScript 类型导出部分:
```typescript
export type Role = 'super_admin' | 'admin' | 'user'
```

- [ ] **Step 2: 添加 super_admin 环境变量到 env.ts**

```typescript
// apps/server/src/env.ts 在 MQTT_ENABLED 之后插入:
SUPER_ADMIN_USERNAME: z.string().optional(),
SUPER_ADMIN_PASSWORD: z.string().min(8, 'SUPER_ADMIN_PASSWORD must be at least 8 characters').optional(),
SUPER_ADMIN_DISPLAY_NAME: z.string().default('超级管理员'),
```

- [ ] **Step 3: 更新 .env.example**

```diff
-# DEMO_MODE=false
+# SUPER_ADMIN_USERNAME=admin
+# SUPER_ADMIN_PASSWORD=admin123
```

- [ ] **Step 4: 更新 docker-compose.yml**

```
SUPER_ADMIN_USERNAME: "${SUPER_ADMIN_USERNAME:-admin}"
SUPER_ADMIN_PASSWORD: "${SUPER_ADMIN_PASSWORD:-admin123}"
```

- [ ] **Step 5: 运行 typecheck**

```powershell
pnpm --filter @iomtea/server typecheck
```

- [ ] **Step 6: 提交**

```powershell
git add -A
git commit -m "feat: role enum to super_admin/admin/user, add SUPER_ADMIN env vars"
```

---

### Task 2: 超级管理员初始化逻辑

**Files:**
- Modify: `apps/server/src/index.ts:89-114`

- [ ] **Step 1: 在 bootstrap() 中替换 demo 账号逻辑为超管初始化**

```typescript
// apps/server/src/index.ts 替换第 89-114 行:
// ---- 超级管理员初始化 ----
if (env.SUPER_ADMIN_USERNAME && env.SUPER_ADMIN_PASSWORD) {
  const superAdmins = await db.select().from(users).where(eq(users.role, 'super_admin')).limit(1)
  if (superAdmins.length === 0) {
    await db.insert(users).values({
      username: env.SUPER_ADMIN_USERNAME,
      passwordHash: await hashPassword(env.SUPER_ADMIN_PASSWORD),
      displayName: env.SUPER_ADMIN_DISPLAY_NAME || '超级管理员',
      role: 'super_admin',
    })
    logger.info(`√ 超管账号已创建 (${env.SUPER_ADMIN_USERNAME})`)
  }
} else {
  logger.warn('未配置 SUPER_ADMIN_USERNAME/PASSWORD，跳过超管初始化')
}

// ---- 初始数据 ----
```

移除 `import { seedDemoData } from './core/services/demo-seed'` 对应的调用（保留 import 供后续标签种子使用或删除）。

- [ ] **Step 2: 运行 typecheck 确认无类型错误**

```powershell
pnpm --filter @iomtea/server typecheck
```

- [ ] **Step 3: 提交**

```powershell
git add -A
git commit -m "feat: super admin init from env vars on bootstrap"
```

---

### Task 3: 标签系统 DB schema

**Files:**
- Create: `apps/server/src/core/db/schema/tag.ts`

- [ ] **Step 1: 创建标签表定义**

```typescript
// apps/server/src/core/db/schema/tag.ts
import { pgTable, timestamp, uuid, varchar, primaryKey } from 'drizzle-orm/pg-core'
import { patients } from '../schema.js'

export const patientTags = pgTable('patient_tags', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 50 }).unique().notNull(),
  color: varchar('color', { length: 7 }).default('#228be6'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const patientTagLinks = pgTable(
  'patient_tag_links',
  {
    patientId: uuid('patient_id')
      .references(() => patients.id, { onDelete: 'cascade' })
      .notNull(),
    tagId: uuid('tag_id')
      .references(() => patientTags.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.patientId, t.tagId] }),
  }),
)
```

- [ ] **Step 2: 导出到 index**

```typescript
// apps/server/src/core/db/schema/index.ts 追加:
export * from './tag'
```

- [ ] **Step 3: 生成 migration**

```powershell
pnpm --filter @iomtea/server db:generate
```

- [ ] **Step 4: 运行 migration**

```powershell
pnpm --filter @iomtea/server db:migrate
```

- [ ] **Step 5: typecheck**

```powershell
pnpm --filter @iomtea/server typecheck
```

- [ ] **Step 6: 提交**

```powershell
git add -A
git commit -m "feat: patient_tags and patient_tag_links schema"
```

---

### Task 4: 标签 tRPC 路由

**Files:**
- Create: `apps/server/src/core/trpc/routers/tag.ts`

- [ ] **Step 1: 创建 tag router**

```typescript
// apps/server/src/core/trpc/routers/tag.ts
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { router, adminProcedure } from '../trpc'
import { patientTags, patientTagLinks } from '../../db/schema/tag'
import { db } from '../../db'

export const tagRouter = router({
  list: adminProcedure.query(async () => {
    return db.select().from(patientTags).orderBy(patientTags.name)
  }),

  create: adminProcedure
    .input(z.object({ name: z.string().min(1).max(50), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() }))
    .mutation(async ({ input }) => {
      const [tag] = await db.insert(patientTags).values({
        name: input.name,
        color: input.color ?? '#228be6',
      }).returning()
      return tag
    }),

  update: adminProcedure
    .input(z.object({ id: z.string().uuid(), name: z.string().min(1).max(50).optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input
      const [tag] = await db.update(patientTags).set(data).where(eq(patientTags.id, id)).returning()
      return tag
    }),

  delete: adminProcedure
    .input(z.string().uuid())
    .mutation(async ({ input: id }) => {
      await db.delete(patientTags).where(eq(patientTags.id, id))
    }),
})
```

- [ ] **Step 2: 注册到 _app router**

在 `apps/server/src/core/trpc/routers/_app.ts` 中导入并注册 `tag: tagRouter`。

- [ ] **Step 3: typecheck**

```powershell
pnpm --filter @iomtea/server typecheck
```

- [ ] **Step 4: 提交**

```powershell
git add -A
git commit -m "feat: tag tRPC router (CRUD)"
```

---

## Phase B: 前端基础设施

### Task 5: 侧边栏重建

**Files:**
- Modify: `apps/server/src/routes/_auth.tsx:15-33`

- [ ] **Step 1: 重写侧边栏导航配置**

在 `_auth.tsx` 中将旧的三个数组替换为分组结构:

```typescript
import {
  IconScreenShare, IconDashboard, IconAlertTriangle,
  IconUsers, IconPill, IconFileExport, IconFlask,
  IconDevices, IconKey, IconUsersGroup,
} from '@tabler/icons-react'

interface NavGroup {
  label: string
  items: { label: string; icon: React.ElementType; path: string }[]
  roles?: string[]
}

const navGroups: NavGroup[] = [
  {
    label: '监控',
    items: [
      { label: '数据大屏', icon: IconScreenShare, path: '/data-dashboard' },
      { label: '工作台',   icon: IconDashboard,  path: '/' },
      { label: '告警看板', icon: IconAlertTriangle, path: '/alerts' },
    ],
    roles: ['super_admin', 'admin', 'user'],
  },
  {
    label: '管理',
    items: [
      { label: '患者管理', icon: IconUsers,      path: '/patients' },
      { label: '用药监督', icon: IconPill,       path: '/medications' },
      { label: '数据导出', icon: IconFileExport,  path: '/data-export' },
      { label: '模拟工厂', icon: IconFlask,      path: '/simulation' },
    ],
    roles: ['super_admin', 'admin'],
  },
  {
    label: '设备与接入',
    items: [
      { label: '设备列表', icon: IconDevices, path: '/settings' },
      { label: 'PIN 管理', icon: IconKey,     path: '/iot/pins' },
    ],
    roles: ['super_admin', 'admin'],
  },
  {
    label: '系统',
    items: [
      { label: '用户管理', icon: IconUsersGroup, path: '/settings/users' },
    ],
    roles: ['super_admin'],
  },
]
```

渲染逻辑改为遍历 `navGroups`，内层遍历 `items`，按角色过滤。

- [ ] **Step 2: typecheck 前端**

```powershell
pnpm --filter @iomtea/web typecheck
```

- [ ] **Step 3: 提交**

```powershell
git add -A
git commit -m "feat: sidebar restructured with 4 groups"
```

---

### Task 6: 路由清理与新增

**Files:**
- Delete: `apps/web/src/routes/_auth.node-graph.tsx`
- Delete: `apps/web/src/routes/_auth.avatar-editor.tsx`
- Delete: `apps/web/src/routes/_auth.trends.tsx`
- Delete: `apps/web/src/routes/_auth.settings.virtual-pins.tsx`
- Delete: `apps/web/src/routes/_auth.patients.$id.map-editor.tsx`
- Create: `apps/web/src/routes/_auth.alerts.tsx`
- Create: `apps/web/src/routes/_auth.data-export.tsx`
- Create: `apps/web/src/routes/_auth.simulation.tsx`

- [ ] **Step 1: 删除废弃路由文件**

```powershell
Remove-Item -LiteralPath "apps/web/src/routes/_auth.node-graph.tsx"
Remove-Item -LiteralPath "apps/web/src/routes/_auth.avatar-editor.tsx"
Remove-Item -LiteralPath "apps/web/src/routes/_auth.trends.tsx"
Remove-Item -LiteralPath "apps/web/src/routes/_auth.settings.virtual-pins.tsx"
Remove-Item -LiteralPath "apps/web/src/routes/_auth.patients.$id.map-editor.tsx"
```

- [ ] **Step 2: 创建告警看板路由**

```typescript
// apps/web/src/routes/_auth.alerts.tsx
import { createFileRoute } from '@tanstack/react-router'
import { AlertBoard } from '../pages/AlertBoard'

export const Route = createFileRoute('/_auth/alerts')({
  component: AlertBoard,
})
```

- [ ] **Step 3: 创建数据导出路由**

```typescript
// apps/web/src/routes/_auth.data-export.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/data-export')({
  component: DataExportPage,
})

function DataExportPage() {
  return <div>数据导出 - 待实现</div>
}
```

- [ ] **Step 4: 创建模拟工厂路由**

```typescript
// apps/web/src/routes/_auth.simulation.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/simulation')({
  component: SimulationPage,
})

function SimulationPage() {
  return <div>模拟工厂 - 待实现</div>
}
```

- [ ] **Step 5: 重新生成 routeTree**

```powershell
pnpm --filter @iomtea/web dev
```
Ctrl+C 后确认无编译错误，`routeTree.gen.ts` 已更新。

- [ ] **Step 6: 提交**

```powershell
git add -A
git commit -m "refactor: clean up unused routes, add alerts/data-export/simulation routes"
```

---

### Task 7: 骨架屏修复

**Files:**
- Modify: `apps/web/src/components/shared/QueryGate.tsx`

- [ ] **Step 1: 审查 DashboardPage.tsx 的 loading 状态**

检查 `apps/web/src/pages/DashboardPage.tsx` 和 `apps/web/src/pages/PatientWall.tsx` 中的 `useQuery` 调用。确保 `isLoading`、`isError`、`data` 三态都有对应的 UI 分支。

- [ ] **Step 2: 修复 QueryGate — 添加 isError 状态处理**

```typescript
// apps/web/src/components/shared/QueryGate.tsx
if (isError || (error && !isLoading)) {
  return <StateError message={errorMessage} onRetry={onRetry} />
}
```

确保 `isError` 未被 `isLoading` 覆盖（常见 bug：`isLoading && !isError` 导致仅渲染骨架屏）。

- [ ] **Step 3: 逐页排查使用 Skeleton 但没有 error 处理的页面**

检查页面列表：`HealthTimeline.tsx`, `PatientAlertRules.tsx`, `NodeGraphPage.tsx`, `GraphEditorPage.tsx` — 将为简单 `<Text>加载中...</Text>` 替换为 `StateSkeleton` 组件并添加 error 分支。

- [ ] **Step 4: typecheck + visual test**

```powershell
pnpm --filter @iomtea/web typecheck
```

- [ ] **Step 5: 提交**

```powershell
git add -A
git commit -m "fix: skeleton loading states with proper error handling"
```

---

## Phase C: CSV 批量导入 + 批量操作

### Task 8: patient.bulkCreate 后端

**Files:**
- Modify: `apps/server/src/core/trpc/routers/patient.ts` (或新建方法)

- [ ] **Step 1: 添加 bulkCreate mutation**

```typescript
const patientRowSchema = z.object({
  name: z.string().min(1),
  gender: z.enum(['male', 'female', 'other']).optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  phone: z.string().max(20).optional(),
  heightCm: z.number().optional(),
  weightKg: z.number().optional(),
  bloodType: z.enum(['A', 'B', 'AB', 'O']).optional(),
  address: z.string().optional(),
  emergencyContact: z.string().max(100).optional(),
  emergencyPhone: z.string().max(20).optional(),
})

bulkCreate: adminProcedure
  .input(z.object({
    defaultPassword: z.string().min(6),
    tagIds: z.array(z.string().uuid()).optional(),
    patients: z.array(patientRowSchema),
  }))
  .mutation(async ({ input, ctx }) => {
    const results: { created: number; errors: { index: number; reason: string }[] } = { created: 0, errors: [] }

    for (let i = 0; i < input.patients.length; i++) {
      const p = input.patients[i]
      try {
        const username = p.phone || `user-${crypto.randomUUID().slice(0, 8)}`
        const passwordHash = await hashPassword(input.defaultPassword)

        const [user] = await ctx.db.insert(users).values({
          username,
          passwordHash,
          displayName: p.name,
          phone: p.phone,
          role: 'user',
        }).returning()

        const [patient] = await ctx.db.insert(patients).values({
          name: p.name,
          userId: user.id,
          gender: p.gender,
          birthDate: p.birthDate,
          phone: p.phone,
          heightCm: p.heightCm,
          weightKg: p.weightKg,
          bloodType: p.bloodType,
          address: p.address,
          emergencyContact: p.emergencyContact,
          emergencyPhone: p.emergencyPhone,
        }).returning()

        if (input.tagIds?.length) {
          await ctx.db.insert(patientTagLinks).values(
            input.tagIds.map(tagId => ({ patientId: patient.id, tagId }))
          )
        }

        results.created++
      } catch (err: any) {
        results.errors.push({ index: i, reason: err?.message ?? 'Unknown error' })
      }
    }

    return results
  }),
```

- [ ] **Step 2: typecheck**

```powershell
pnpm --filter @iomtea/server typecheck
```

- [ ] **Step 3: 提交**

```powershell
git add -A
git commit -m "feat: patient.bulkCreate with user+patient creation"
```

---

### Task 9: CSV 导入前端页面

**Files:**
- Create: `apps/web/src/pages/PatientImport.tsx`
- Modify: `apps/web/src/routes/_auth.patients.tsx` (添加导入按钮)

- [ ] **Step 1: 创建 CSV 导入组件**

```typescript
// apps/web/src/pages/PatientImport.tsx
import { useState, useCallback } from 'react'
import { Button, Modal, Table, Text, Group, Paper, PasswordInput, Badge, Stepper, MultiSelect } from '@mantine/core'
import { useDropzone } from 'react-dropzone'
import { IconUpload, IconFileSpreadsheet } from '@tabler/icons-react'
import { api } from '../trpc'

interface CsvRow {
  name: string; phone?: string; gender?: string; birth_date?: string
  height_cm?: string; weight_kg?: string; blood_type?: string
  address?: string; emergency_contact?: string; emergency_phone?: string
  _errors: string[]
}

const FIELD_LABELS: Record<string, string> = {
  name: '姓名', phone: '手机号', gender: '性别', birth_date: '出生日期',
  height_cm: '身高(cm)', weight_kg: '体重(kg)', blood_type: '血型',
  address: '地址', emergency_contact: '紧急联系人', emergency_phone: '紧急电话',
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim())
  return lines.slice(1).map((line, idx) => {
    const values = line.split(',').map(v => v.trim())
    const row: any = { _errors: [] }
    headers.forEach((h, i) => {
      const key = FIELD_LABELS[h] ? Object.keys(FIELD_LABELS).find(k => FIELD_LABELS[k] === h) || h : h
      row[key] = values[i] ?? ''
    })
    if (!row.name) row._errors.push('姓名必填')
    if (row.gender && !['male', 'female', 'other'].includes(row.gender)) row._errors.push('性别无效')
    if (row.birth_date && !/^\d{4}-\d{2}-\d{2}$/.test(row.birth_date)) row._errors.push('日期格式错误')
    return row
  })
}

export function PatientImport({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<CsvRow[]>([])
  const [defaultPassword, setDefaultPassword] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [step, setStep] = useState(0)
  const [result, setResult] = useState<{ created: number; errors: any[] } | null>(null)
  const { data: tags } = api.tag.list.useQuery()
  const bulkCreate = api.patient.bulkCreate.useMutation()

  const onDrop = useCallback((files: File[]) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      setRows(parseCsv(text))
      setStep(1)
    }
    reader.readAsText(files[0])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'text/csv': ['.csv'] }, maxFiles: 1 })

  const validRows = rows.filter(r => r._errors.length === 0)
  const invalidRows = rows.filter(r => r._errors.length > 0)

  const handleImport = async () => {
    if (!defaultPassword || validRows.length === 0) return
    const res = await bulkCreate.mutateAsync({
      defaultPassword,
      tagIds: selectedTags,
      patients: validRows.map(r => ({
        name: r.name,
        phone: r.phone || undefined,
        gender: r.gender as any,
        birthDate: r.birth_date || undefined,
        heightCm: r.height_cm ? Number(r.height_cm) : undefined,
        weightKg: r.weight_kg ? Number(r.weight_kg) : undefined,
        bloodType: r.blood_type as any,
        address: r.address || undefined,
        emergencyContact: r.emergency_contact || undefined,
        emergencyPhone: r.emergency_phone || undefined,
      })),
    })
    setResult(res)
    setStep(2)
  }

  return (
    <Modal opened={opened} onClose={onClose} title="批量导入患者" size="xl">
      <Stepper active={step} onStepClick={setStep}>
        <Stepper.Step label="上传文件" description="CSV 格式">
          <Paper {...getRootProps()} p="xl" withBorder style={{ borderStyle: 'dashed', cursor: 'pointer', textAlign: 'center' }}>
            <input {...getInputProps()} />
            <IconUpload size={32} />
            <Text mt="sm">{isDragActive ? '释放文件以上传' : '拖拽 CSV 文件到此处，或点击选择'}</Text>
          </Paper>
        </Stepper.Step>

        <Stepper.Step label="预览校验" description={`${validRows.length}有效 / ${invalidRows.length}无效`}>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>行</Table.Th>
                <Table.Th>姓名</Table.Th>
                <Table.Th>手机号</Table.Th>
                <Table.Th>性别</Table.Th>
                <Table.Th>错误</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row, i) => (
                <Table.Tr key={i} bg={row._errors.length > 0 ? 'red.0' : undefined}>
                  <Table.Td>{i + 1}</Table.Td>
                  <Table.Td>{row.name}</Table.Td>
                  <Table.Td>{row.phone}</Table.Td>
                  <Table.Td>{row.gender}</Table.Td>
                  <Table.Td c="red">{row._errors.join(', ')}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          <Group mt="md">
            <PasswordInput
              label="默认密码"
              value={defaultPassword}
              onChange={(e) => setDefaultPassword(e.currentTarget.value)}
              required
            />
            <MultiSelect
              label="附加标签"
              data={tags?.map(t => ({ value: t.id, label: t.name })) ?? []}
              value={selectedTags}
              onChange={setSelectedTags}
            />
          </Group>

          <Button mt="md" onClick={handleImport} loading={bulkCreate.isLoading} disabled={!defaultPassword || validRows.length === 0}>
            导入 {validRows.length} 条记录
          </Button>
        </Stepper.Step>

        <Stepper.Step label="完成" description={result ? `成功 ${result.created} 条` : ''}>
          {result && (
            <>
              <Text c="green">成功导入: {result.created} 条</Text>
              {result.errors.length > 0 && (
                <Text c="red">失败: {result.errors.length} 条</Text>
              )}
              <Button mt="md" onClick={onClose}>关闭</Button>
            </>
          )}
        </Stepper.Step>
      </Stepper>
    </Modal>
  )
}
```

- [ ] **Step 2: 在患者列表页添加导入按钮**

在 `apps/web/src/pages/PatientWall.tsx` 顶部工具条中添加 `<Button leftSection={<IconUpload size={18} />} onClick={() => setImportOpen(true)}>导入</Button>`。

- [ ] **Step 3: typecheck**

```powershell
pnpm --filter @iomtea/web typecheck
```

- [ ] **Step 4: 提交**

```powershell
git add -A
git commit -m "feat: CSV bulk import with preview validation"
```

---

### Task 10: 批量操作 + 激活追踪

**Files:**
- Modify: `apps/server/src/core/trpc/routers/patient.ts` (bulkUpdateStatus + query 加 isActivated)
- Modify: `apps/web/src/pages/PatientWall.tsx` (复选框 + 批量操作栏 + 激活状态列)

- [ ] **Step 1: 后端添加 bulkUpdateStatus mutation**

```typescript
bulkUpdateStatus: adminProcedure
  .input(z.object({ ids: z.array(z.string().uuid()), status: z.enum(['active', 'discharged', 'archived']) }))
  .mutation(async ({ input, ctx }) => {
    await ctx.db.update(patients)
      .set({ status: input.status })
      .where(inArray(patients.id, input.ids))
    return { updated: input.ids.length }
  }),
```

- [ ] **Step 2: 后端添加 bulkAddTags / bulkRemoveTags**

```typescript
bulkAddTags: adminProcedure
  .input(z.object({ patientIds: z.array(z.string().uuid()), tagIds: z.array(z.string().uuid()) }))
  .mutation(async ({ input, ctx }) => {
    const rows = input.patientIds.flatMap(pid =>
      input.tagIds.map(tid => ({ patientId: pid, tagId: tid }))
    )
    await ctx.db.insert(patientTagLinks).values(rows).onConflictDoNothing()
    return { linked: rows.length }
  }),

bulkRemoveTags: adminProcedure
  .input(z.object({ patientIds: z.array(z.string().uuid()), tagIds: z.array(z.string().uuid()) }))
  .mutation(async ({ input, ctx }) => {
    await ctx.db.delete(patientTagLinks).where(
      and(
        inArray(patientTagLinks.patientId, input.patientIds),
        inArray(patientTagLinks.tagId, input.tagIds),
      )
    )
  }),
```

- [ ] **Step 3: 修改 patient list query 返回 isActivated**

在 patient router 的 list 查询中 LEFT JOIN users 表：
```typescript
const rows = await ctx.db
  .select({
    id: patients.id,
    name: patients.name,
    gender: patients.gender,
    status: patients.status,
    createdAt: patients.createdAt,
    isActivated: sql<boolean>`CASE WHEN ${users.lastLoginAt} IS NOT NULL THEN true ELSE false END`,
  })
  .from(patients)
  .leftJoin(users, eq(patients.userId, users.id))
```

- [ ] **Step 4: 前端添加多选复选框和批量操作工具栏**

在 `PatientWall.tsx` 中：
- 添加 `selectedIds` state
- 表格/网格每行添加 Checkbox
- 顶部显示批量操作栏（选中 N 项时出现）：批量停用、添加标签、移除标签按钮

- [ ] **Step 5: 激活状态列**

患者卡片/行中添加激活状态指示器：
```tsx
<Badge color={row.isActivated ? 'green' : 'gray'} variant="dot">
  {row.isActivated ? '已激活' : '未激活'}
</Badge>
```

- [ ] **Step 6: 患者列表顶部标签筛选栏**

```tsx
<Chip.Group multiple value={filterTagIds} onChange={setFilterTagIds}>
  {tags?.map(tag => (
    <Chip key={tag.id} value={tag.id} color={tag.color} variant="light">
      {tag.name}
    </Chip>
  ))}
</Chip.Group>
```

- [ ] **Step 7: typecheck both**

```powershell
pnpm typecheck
```

- [ ] **Step 8: 提交**

```powershell
git add -A
git commit -m "feat: batch operations, activation tracking, tag filter bar"
```

---

## Phase D: 数据导出

### Task 11: 导出后端

**Files:**
- Create: `apps/server/src/core/trpc/routers/export.ts`

- [ ] **Step 1: 创建 export router**

```typescript
// apps/server/src/core/trpc/routers/export.ts
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { router, adminProcedure } from '../trpc'
import { patients, events, devices, medications } from '../../db/schema'
import { db } from '../../db'

const entityEnum = z.enum(['patients', 'events', 'medications', 'devices'])
const formatEnum = z.enum(['csv', 'xlsx'])

const entityFields: Record<string, string[]> = {
  patients: ['id', 'name', 'gender', 'birth_date', 'phone', 'height_cm', 'weight_kg', 'blood_type', 'address', 'status', 'created_at'],
  events: ['id', 'patient_id', 'kind', 'metric', 'value', 'unit', 'source', 'severity', 'status', 'recorded_at', 'created_at'],
  medications: ['id', 'patient_id', 'drug_name', 'dosage', 'dosage_unit', 'frequency', 'route', 'start_date', 'end_date', 'status', 'created_at'],
  devices: ['id', 'serial_number', 'device_type', 'model', 'manufacturer', 'status', 'room_id', 'last_seen', 'created_at'],
}

export const exportRouter = router({
  preview: adminProcedure
    .input(z.object({
      entity: entityEnum,
      fields: z.array(z.string()),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      patientId: z.string().uuid().optional(),
    }))
    .query(async ({ input }) => {
      // sanitize fields
      const safeFields = input.fields.filter(f => entityFields[input.entity]?.includes(f))
      if (safeFields.length === 0) safeFields.push('*')

      const table = { patients, events, medications, devices }[input.entity]
      let query = db.select().from(table as any)

      if (input.dateFrom) {
        const dateCol = input.entity === 'patients' ? (table as typeof patients).createdAt :
          input.entity === 'events' ? (table as typeof events).recordedAt : undefined
        // simplified: apply date filter
      }

      const rows = await query.limit(20)
      return { columns: safeFields, rows: rows.slice(0, 20), total: rows.length }
    }),

  download: adminProcedure
    .input(z.object({
      entity: entityEnum,
      fields: z.array(z.string()),
      format: formatEnum,
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      patientId: z.string().uuid().optional(),
    }))
    .mutation(async ({ input }) => {
      const safeFields = input.fields.filter(f => entityFields[input.entity]?.includes(f))
      if (safeFields.length === 0) safeFields.push('id', 'created_at')

      const table = { patients, events, medications, devices }[input.entity]
      const rows = await db.select().from(table as any)

      if (input.format === 'csv') {
        const header = safeFields.join(',')
        const body = rows.map((r: any) => safeFields.map(f => `"${String(r[f] ?? '')}"`).join(',')).join('\n')
        const csv = header + '\n' + body
        return { data: Buffer.from(csv).toString('base64'), filename: `${input.entity}.csv`, mime: 'text/csv' }
      }
      // xlsx: use a JSON-to-XLSX approach or return CSV for now
      return { data: '', filename: `${input.entity}.csv`, mime: 'text/csv' }
    }),
})
```

- [ ] **Step 2: 注册 router**

- [ ] **Step 3: typecheck + commit**

---

### Task 12: 导出前端页面

**Files:**
- Modify: `apps/web/src/routes/_auth.data-export.tsx` (替换占位实现)

- [ ] **Step 1: 实现 DataExportPage**

```typescript
// apps/web/src/routes/_auth.data-export.tsx
function DataExportPage() {
  const [entity, setEntity] = useState<string>('patients')
  const [selectedFields, setSelectedFields] = useState<string[]>([])
  const [format, setFormat] = useState<'csv' | 'xlsx'>('csv')
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null])

  const { data: preview } = api.export.preview.useQuery({
    entity,
    fields: selectedFields,
    dateFrom: dateRange[0]?.toISOString(),
    dateTo: dateRange[1]?.toISOString(),
  }, { enabled: selectedFields.length > 0 })

  return (
    <Container size="lg" py="md">
      <Title order={2} mb="md">数据导出</Title>

      <Paper p="md" withBorder mb="md">
        <Group>
          <Select label="导出实体" data={[
            { value: 'patients', label: '患者' },
            { value: 'events', label: '事件' },
            { value: 'medications', label: '用药' },
            { value: 'devices', label: '设备' },
          ]} value={entity} onChange={(v) => { setEntity(v!); setSelectedFields([]) }} />
          <SegmentedControl data={[
            { value: 'csv', label: 'CSV' },
            { value: 'xlsx', label: 'Excel' },
          ]} value={format} onChange={(v) => setFormat(v as any)} />
        </Group>

        <Checkbox.Group label="选择字段" value={selectedFields} onChange={setSelectedFields} mt="md">
          <Group>
            {entityFields[entity]?.map(f => (
              <Checkbox key={f} value={f} label={f} />
            ))}
          </Group>
        </Checkbox.Group>
      </Paper>

      {preview && (
        <Paper p="md" withBorder mb="md">
          <Text size="sm" c="dimmed" mb="sm">预览 (共 {preview.total} 条)</Text>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                {preview.columns.map(c => <Table.Th key={c}>{c}</Table.Th>)}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {preview.rows.map((row: any, i: number) => (
                <Table.Tr key={i}>
                  {preview.columns.map(c => <Table.Td key={c}>{String(row[c] ?? '-')}</Table.Td>)}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      <Button>导出 {format.toUpperCase()}</Button>
    </Container>
  )
}
```

- [ ] **Step 2: typecheck + commit**

---

## Phase E: 页面补全

### Task 13: 设备列表页实现

**Files:**
- Modify: `apps/web/src/pages/DeviceListPage.tsx`

- [ ] **Step 1: 替换占位内容为实际设备列表**

```typescript
// apps/web/src/pages/DeviceListPage.tsx
import { Container, Title, Table, Badge, Text } from '@mantine/core'
import { api } from '../trpc'
import { StateSkeleton, StateEmpty } from '../components/shared/StateComponents'

export function DeviceListPage() {
  const { data: devices, isLoading, isError } = api.device.list.useQuery({})

  if (isLoading) return <StateSkeleton variant="table" count={5} />
  if (isError) return <Text c="red">加载失败</Text>
  if (!devices || devices.length === 0) return <StateEmpty message="暂无设备" />

  return (
    <Container size="lg" py="md">
      <Title order={2} mb="md">设备列表</Title>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>序列号</Table.Th>
            <Table.Th>类型</Table.Th>
            <Table.Th>型号</Table.Th>
            <Table.Th>制造商</Table.Th>
            <Table.Th>状态</Table.Th>
            <Table.Th>最后在线</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {devices.map((d: any) => (
            <Table.Tr key={d.id}>
              <Table.Td>{d.serialNumber}</Table.Td>
              <Table.Td>{d.deviceType}</Table.Td>
              <Table.Td>{d.model ?? '-'}</Table.Td>
              <Table.Td>{d.manufacturer ?? '-'}</Table.Td>
              <Table.Td>
                <Badge color={d.status === 'active' ? 'green' : d.status === 'error' ? 'red' : 'gray'}>
                  {d.status}
                </Badge>
              </Table.Td>
              <Table.Td>{d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : '-'}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Container>
  )
}
```

- [ ] **Step 2: typecheck + commit**

---

## Phase F: 模拟数据工厂

### Task 14: sim 模块 — types + profiles 移植

**Files:**
- Create: `apps/server/src/sim/types.ts`
- Create: `apps/server/src/sim/profiles.ts`
- Create: `apps/server/src/sim/physiology.ts`

- [ ] **Step 1: 创建 types.ts**

```typescript
// apps/server/src/sim/types.ts
export interface MetricConfig {
  metric: string
  unit: string
  interval: { min: number; max: number }
  jitter: number
  generator: string
}

export interface Profile {
  name: string
  label: string
  baselines: Record<string, { mean: number; std: number }>
  metrics: MetricConfig[]
  conditions: string[]
}

export interface SimStatus {
  patientId: string
  patientName: string
  profile: string
  running: boolean
  lastValues: Record<string, number>
  tickCount: number
}
```

- [ ] **Step 2: 创建 profiles.ts（5 种画像 + 指标编排配置）**

从 `apps/server/src/twin/profiles/` 移植基线数据，为每画像定义 metrics 编排：

```typescript
// apps/server/src/sim/profiles.ts
import type { Profile } from './types'

const defaultMetrics: MetricConfig[] = [
  { metric: 'heart_rate',     unit: 'bpm',  interval: { min: 3000, max: 5000 },  jitter: 0.2, generator: 'heartRate' },
  { metric: 'resp_rate',       unit: 'rpm',  interval: { min: 3000, max: 5000 },  jitter: 0.2, generator: 'respiratoryRate' },
  { metric: 'spo2',            unit: '%',    interval: { min: 3000, max: 5000 },  jitter: 0.15, generator: 'spo2' },
  { metric: 'temperature',     unit: '°C',   interval: { min: 60000, max: 120000 }, jitter: 0.1, generator: 'temperature' },
  { metric: 'systolic_bp',     unit: 'mmHg', interval: { min: 30000, max: 60000 }, jitter: 0.15, generator: 'systolicBp' },
  { metric: 'diastolic_bp',    unit: 'mmHg', interval: { min: 30000, max: 60000 }, jitter: 0.15, generator: 'diastolicBp' },
  { metric: 'glucose',         unit: 'mmol/L',interval: { min: 300000, max: 600000 }, jitter: 0.2, generator: 'glucose' },
  { metric: 'posture',         unit: '',     interval: { min: 5000, max: 30000 }, jitter: 0.5, generator: 'posture' },
  { metric: 'bed_status',      unit: '',     interval: { min: 5000, max: 30000 }, jitter: 0.3, generator: 'bedStatus' },
  { metric: 'motion_index',    unit: '',     interval: { min: 10000, max: 30000 }, jitter: 0.3, generator: 'motionIndex' },
]

export const profiles: Record<string, Profile> = {
  'elderly-cardiac': {
    name: 'elderly-cardiac', label: '老年心脏',
    baselines: {
      heart_rate: { mean: 78, std: 8 },
      spo2: { mean: 96, std: 2 },
      temperature: { mean: 36.5, std: 0.3 },
      systolic_bp: { mean: 135, std: 10 },
      diastolic_bp: { mean: 85, std: 6 },
      glucose: { mean: 5.8, std: 1.2 },
      resp_rate: { mean: 16, std: 3 },
    },
    metrics: defaultMetrics,
    conditions: ['hypertension', 'fall_risk'],
  },
  'diabetes': {
    name: 'diabetes', label: '糖尿病',
    baselines: {
      heart_rate: { mean: 72, std: 6 },
      spo2: { mean: 97, std: 1.5 },
      temperature: { mean: 36.6, std: 0.2 },
      systolic_bp: { mean: 130, std: 8 },
      diastolic_bp: { mean: 82, std: 5 },
      glucose: { mean: 7.5, std: 2.5 },
      resp_rate: { mean: 15, std: 2 },
    },
    metrics: defaultMetrics,
    conditions: ['diabetes_type2', 'neuropathy_risk'],
  },
  'post-surgery': {
    name: 'post-surgery', label: '术后恢复',
    baselines: {
      heart_rate: { mean: 85, std: 10 },
      spo2: { mean: 95, std: 2 },
      temperature: { mean: 37.2, std: 0.5 },
      systolic_bp: { mean: 125, std: 10 },
      diastolic_bp: { mean: 80, std: 7 },
      glucose: { mean: 6.0, std: 1.0 },
      resp_rate: { mean: 18, std: 3 },
    },
    metrics: defaultMetrics,
    conditions: ['post_op', 'infection_risk'],
  },
  'copd-respiratory': {
    name: 'copd-respiratory', label: 'COPD呼吸',
    baselines: {
      heart_rate: { mean: 95, std: 12 },
      spo2: { mean: 92, std: 3 },
      temperature: { mean: 36.8, std: 0.3 },
      systolic_bp: { mean: 140, std: 12 },
      diastolic_bp: { mean: 88, std: 8 },
      glucose: { mean: 5.5, std: 1.0 },
      resp_rate: { mean: 25, std: 5 },
    },
    metrics: defaultMetrics,
    conditions: ['copd', 'hypoxemia_risk'],
  },
  'maternity': {
    name: 'maternity', label: '产科',
    baselines: {
      heart_rate: { mean: 90, std: 10 },
      spo2: { mean: 97, std: 1.5 },
      temperature: { mean: 36.8, std: 0.3 },
      systolic_bp: { mean: 120, std: 8 },
      diastolic_bp: { mean: 70, std: 6 },
      glucose: { mean: 5.2, std: 1.5 },
      resp_rate: { mean: 18, std: 3 },
    },
    metrics: defaultMetrics,
    conditions: ['gestational_hypertension_risk'],
  },
}
```

- [ ] **Step 3: 创建 physiology.ts — 从 twin/physiology/ 移植生成函数**

```typescript
// apps/server/src/sim/physiology.ts
// 从 apps/server/src/twin/physiology/ 移植所有生成函数
// 关键函数签名: generateHeartRate(baseline: {mean, std}, hour: number, prevValue?: number): number
// 昼夜节律: sin(hour * 2PI / 24) 调制
// 高斯噪声: box-muller transform

function gaussian(mean: number, std: number): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

function circadianFactor(hour: number, min: number, max: number): number {
  const rad = (hour * Math.PI * 2) / 24
  return min + (max - min) * (1 - Math.cos(rad)) / 2
}

export function generateHeartRate(baseline: { mean: number; std: number }, hour: number, _prevValue?: number): number {
  const circFactor = circadianFactor(hour, -3, 5)
  return Math.round(gaussian(baseline.mean + circFactor, baseline.std))
}

export function generateSpO2(baseline: { mean: number; std: number }, hour: number, _prevValue?: number): number {
  const dip = hour >= 2 && hour <= 5 ? -1.5 : 0
  return Math.round(gaussian(baseline.mean + dip, baseline.std) * 10) / 10
}

export function generateTemperature(baseline: { mean: number; std: number }, hour: number, _prevValue?: number): number {
  const circFactor = circadianFactor(hour, -0.5, 0.3)
  return Math.round(gaussian(baseline.mean + circFactor, baseline.std) * 10) / 10
}

export function generateSystolicBp(baseline: { mean: number; std: number }, hour: number, _prevValue?: number): number {
  const circFactor = circadianFactor(hour, -5, 8)
  return Math.round(gaussian(baseline.mean + circFactor, baseline.std))
}

export function generateDiastolicBp(baseline: { mean: number; std: number }, hour: number, _prevValue?: number): number {
  const circFactor = circadianFactor(hour, -3, 5)
  return Math.round(gaussian(baseline.mean + circFactor, baseline.std))
}

export function generateGlucose(baseline: { mean: number; std: number }, hour: number, _prevValue?: number): number {
  const mealSpike = [8, 12, 18].some(h => Math.abs(hour - h) <= 1) ? 2.0 : 0
  return Math.round(gaussian(baseline.mean + mealSpike, baseline.std) * 10) / 10
}

export function generateRespiratoryRate(baseline: { mean: number; std: number }, _hour: number, _prevValue?: number): number {
  return Math.round(gaussian(baseline.mean, baseline.std))
}

export function generatePosture(): string {
  const postures = ['lying', 'lying', 'sitting', 'sitting', 'standing', 'walking']
  return postures[Math.floor(Math.random() * postures.length)]
}

export function generateBedStatus(): string {
  return Math.random() > 0.3 ? 'in_bed' : 'out_of_bed'
}

export function generateMotionIndex(): number {
  return Math.round(gaussian(0.3, 0.2) * 10) / 10
}

export function generateEcgWaveform(_hr: number): number[] {
  return Array.from({ length: 50 }, (_, i) => {
    const t = i / 50
    const p = 0.1 * Math.exp(-((t - 0.1) ** 2) / 0.001)
    const qrs = 1.0 * Math.exp(-((t - 0.3) ** 2) / 0.0005)
    const tWave = 0.3 * Math.exp(-((t - 0.7) ** 2) / 0.002)
    return Math.round((p + qrs + tWave) * 100) / 100
  })
}

export function generateRespiratoryWaveform(_rr: number): number[] {
  return Array.from({ length: 50 }, (_, i) =>
    Math.round(Math.sin(i * 2 * Math.PI / 25) * 100) / 100
  )
}

export function generatePressureDistribution(_posture: string): number[][] {
  return Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () => Math.round(Math.random() * 100) / 100)
  )
}
```

- [ ] **Step 4: typecheck + commit**

---

### Task 15: sim 模块 — scheduler + factory + router

**Files:**
- Create: `apps/server/src/sim/scheduler.ts`
- Create: `apps/server/src/sim/factory.ts`
- Create: `apps/server/src/sim/router.ts`

- [ ] **Step 1: 创建 scheduler.ts**

```typescript
// apps/server/src/sim/scheduler.ts
import type { MetricConfig } from './types'

export class MetricScheduler {
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map()
  private speed: number = 1

  setSpeed(speed: number) { this.speed = speed }

  schedule(
    patientId: string,
    metric: MetricConfig,
    callback: (metric: string) => Promise<void>,
  ) {
    const key = `${patientId}:${metric.metric}`
    const run = () => {
      const baseInterval = metric.interval.min + Math.random() * (metric.interval.max - metric.interval.min)
      const jitteredInterval = baseInterval * (1 + (Math.random() - 0.5) * 2 * metric.jitter)
      const interval = jitteredInterval / this.speed

      this.timers.set(key, setTimeout(async () => {
        await callback(metric.metric)
        if (this.timers.has(key)) run()
      }, interval))
    }
    run()
  }

  cancel(patientId: string, metric?: string) {
    const prefix = `${patientId}:`
    for (const [key, timer] of this.timers) {
      if (key.startsWith(prefix) && (!metric || key === `${patientId}:${metric}`)) {
        clearTimeout(timer)
        this.timers.delete(key)
      }
    }
  }

  cancelAll(patientId: string) {
    this.cancel(patientId)
  }

  destroy() {
    for (const timer of this.timers.values()) clearTimeout(timer)
    this.timers.clear()
  }
}
```

- [ ] **Step 2: 创建 factory.ts**

```typescript
// apps/server/src/sim/factory.ts
import type { DrizzleClient } from '../core/db'
import { events } from '../core/db/schema'
import { profiles } from './profiles'
import * as phys from './physiology'
import { MetricScheduler } from './scheduler'
import type { Profile, SimStatus } from './types'

interface SimInstance {
  patientId: string
  patientName: string
  profile: Profile
  scheduler: MetricScheduler
  lastValues: Record<string, number>
  tickCount: number
}

const instances = new Map<string, SimInstance>()
let globalSpeed = 1

function getGenerator(name: string): ((baseline: any, hour: number, prev?: number) => any) | null {
  const map: Record<string, Function> = {
    heartRate: phys.generateHeartRate,
    spo2: phys.generateSpO2,
    temperature: phys.generateTemperature,
    systolicBp: phys.generateSystolicBp,
    diastolicBp: phys.generateDiastolicBp,
    glucose: phys.generateGlucose,
    respiratoryRate: phys.generateRespiratoryRate,
    posture: () => phys.generatePosture(),
    bedStatus: () => phys.generateBedStatus(),
    motionIndex: () => phys.generateMotionIndex(),
  }
  return map[name] as any ?? null
}

export function startSim(
  db: DrizzleClient,
  patientIds: string[],
  patientNames: Map<string, string>,
  profileName: string,
) {
  const profile = profiles[profileName]
  if (!profile) return

  for (const pid of patientIds) {
    if (instances.has(pid)) continue

    const scheduler = new MetricScheduler()
    scheduler.setSpeed(globalSpeed)

    const instance: SimInstance = {
      patientId: pid,
      patientName: patientNames.get(pid) ?? pid,
      profile,
      scheduler,
      lastValues: {},
      tickCount: 0,
    }
    instances.set(pid, instance)

    for (const metricCfg of profile.metrics) {
      const generator = getGenerator(metricCfg.generator)
      if (!generator) continue

      scheduler.schedule(pid, metricCfg, async (metric) => {
        const inst = instances.get(pid)
        if (!inst) return

        const baseline = profile.baselines[metric]
        if (!baseline) return

        const hour = new Date().getHours()
        const prevValue = inst.lastValues[metric]
        const value = generator(baseline, hour, prevValue)
        inst.lastValues[metric] = value
        inst.tickCount++

        await db.insert(events).values({
          patientId: pid,
          kind: 'observation',
          metric,
          value: typeof value === 'number' ? value : null,
          unit: metricCfg.unit || null,
          source: 'simulator',
          recordedAt: new Date(),
          tags: { sim: true, profile: profileName },
        } as any)
      })
    }
  }
}

export function stopSim(patientIds: string[]) {
  for (const pid of patientIds) {
    const inst = instances.get(pid)
    if (inst) {
      inst.scheduler.destroy()
      instances.delete(pid)
    }
  }
}

export function setGlobalSpeed(speed: number) {
  globalSpeed = speed
  for (const inst of instances.values()) {
    inst.scheduler.setSpeed(speed)
  }
}

export function getStatus(): SimStatus[] {
  return Array.from(instances.values()).map(i => ({
    patientId: i.patientId,
    patientName: i.patientName,
    profile: i.profile.name,
    running: true,
    lastValues: i.lastValues,
    tickCount: i.tickCount,
  }))
}

export function getProfileConfig(profileName: string): Profile['metrics'] | undefined {
  return profiles[profileName]?.metrics
}
```

- [ ] **Step 3: 创建 router.ts**

```typescript
// apps/server/src/sim/router.ts
import { z } from 'zod'
import { router, adminProcedure } from '../core/trpc/trpc'
import { db } from '../core/db'
import { patients } from '../core/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { startSim, stopSim, setGlobalSpeed, getStatus, getProfileConfig } from './factory'

export const simRouter = router({
  start: adminProcedure
    .input(z.object({ patientIds: z.array(z.string().uuid()), profile: z.string() }))
    .mutation(async ({ input }) => {
      const rows = await db.select({ id: patients.id, name: patients.name })
        .from(patients)
        .where(inArray(patients.id, input.patientIds))
      const nameMap = new Map(rows.map(r => [r.id, r.name]))
      startSim(db, input.patientIds, nameMap, input.profile)
      return { ok: true, count: input.patientIds.length }
    }),

  stop: adminProcedure
    .input(z.object({ patientIds: z.array(z.string().uuid()) }))
    .mutation(({ input }) => {
      stopSim(input.patientIds)
      return { ok: true, count: input.patientIds.length }
    }),

  setSpeed: adminProcedure
    .input(z.object({ speed: z.number().min(0.1).max(10) }))
    .mutation(({ input }) => {
      setGlobalSpeed(input.speed)
      return { ok: true }
    }),

  status: adminProcedure.query(() => {
    return getStatus()
  }),

  profileConfig: adminProcedure
    .input(z.string())
    .query(({ input }) => {
      return getProfileConfig(input) ?? []
    }),
})
```

- [ ] **Step 4: 注册 simRouter 到 _app.ts**

在 `apps/server/src/core/trpc/routers/_app.ts` 中导入并注册 `sim: simRouter`。

- [ ] **Step 5: typecheck + commit**

---

### Task 16: 模拟工厂前端页面

**Files:**
- Modify: `apps/web/src/routes/_auth.simulation.tsx` (替换占位实现)

- [ ] **Step 1: 实现 SimulationPage**

```typescript
// apps/web/src/routes/_auth.simulation.tsx
import { useState } from 'react'
import { Container, Title, Paper, Group, Button, Select, MultiSelect, Badge, Table, Text, Grid, Card, Stack, Switch, NumberInput } from '@mantine/core'
import { IconPlayerPlay, IconPlayerStop, IconSettings } from '@tabler/icons-react'
import { api } from '../trpc'
import { useRealtime } from '../hooks/useRealtime'

const PROFILES = [
  { value: 'elderly-cardiac', label: '老年心脏' },
  { value: 'diabetes', label: '糖尿病' },
  { value: 'post-surgery', label: '术后恢复' },
  { value: 'copd-respiratory', label: 'COPD呼吸' },
  { value: 'maternity', label: '产科' },
]

export default function SimulationPage() {
  const [selectedPatients, setSelectedPatients] = useState<string[]>([])
  const [profile, setProfile] = useState<string>('elderly-cardiac')
  const [speed, setSpeed] = useState(1)
  const [showConfig, setShowConfig] = useState(false)

  const { data: patientList } = api.patient.list.useQuery({})
  const { data: simStatus, refetch: refreshStatus } = api.sim.status.useQuery()
  const { data: profileConfig } = api.sim.profileConfig.useQuery(profile)

  const start = api.sim.start.useMutation({ onSuccess: () => refreshStatus() })
  const stop = api.sim.stop.useMutation({ onSuccess: () => refreshStatus() })
  const setSpeedMutation = api.sim.setSpeed.useMutation()

  const patientOptions = patientList?.map(p => ({
    value: p.id,
    label: `${p.name}${simStatus?.find(s => s.patientId === p.id) ? ' (运行中)' : ''}`,
  })) ?? []

  const running = simStatus?.filter(s => s.running) ?? []

  return (
    <Container size="lg" py="md">
      <Title order={2} mb="md">模拟数据工厂</Title>

      <Paper p="md" withBorder mb="md">
        <Group>
          <MultiSelect
            data={patientOptions}
            value={selectedPatients}
            onChange={setSelectedPatients}
            placeholder="选择患者"
            searchable
            style={{ minWidth: 300 }}
          />
          <Select data={PROFILES} value={profile} onChange={(v) => setProfile(v!)} />
          <Button leftSection={<IconPlayerPlay size={18} />} color="green"
            onClick={() => start.mutate({ patientIds: selectedPatients, profile })}
            loading={start.isLoading} disabled={selectedPatients.length === 0}>
            启动
          </Button>
          <Button leftSection={<IconPlayerStop size={18} />} color="red"
            onClick={() => stop.mutate({ patientIds: running.map(r => r.patientId) })}
            loading={stop.isLoading} disabled={running.length === 0}>
            停止全部
          </Button>
        </Group>

        <Group mt="sm">
          <Switch label="显示编排配置" checked={showConfig} onChange={(e) => setShowConfig(e.currentTarget.checked)} />
          <Badge size="lg" variant="light">运行中: {running.length}</Badge>
        </Group>

        {showConfig && profileConfig && (
          <Paper p="sm" withBorder mt="sm">
            <Text fw={700} mb="sm">{profile} 指标编排</Text>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>指标</Table.Th>
                  <Table.Th>最小间隔(ms)</Table.Th>
                  <Table.Th>最大间隔(ms)</Table.Th>
                  <Table.Th>抖动</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {profileConfig.map((m: any) => (
                  <Table.Tr key={m.metric}>
                    <Table.Td>{m.metric}</Table.Td>
                    <Table.Td>{m.interval.min}</Table.Td>
                    <Table.Td>{m.interval.max}</Table.Td>
                    <Table.Td>{m.jitter}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        )}
      </Paper>

      {running.length > 0 && (
        <Paper p="md" withBorder>
          <Text fw={700} mb="sm">实时监控</Text>
          <Grid>
            {running.map(s => (
              <Grid.Col key={s.patientId} span={{ base: 12, sm: 6, md: 4 }}>
                <Card shadow="sm" padding="md" radius="md" withBorder>
                  <Group justify="space-between" mb="xs">
                    <Text fw={600}>{s.patientName}</Text>
                    <Badge size="sm">{s.profile}</Badge>
                  </Group>
                  <Stack gap={4}>
                    {Object.entries(s.lastValues).slice(0, 6).map(([k, v]) => (
                      <Group key={k} justify="space-between">
                        <Text size="sm" c="dimmed">{k}</Text>
                        <Text size="sm" fw={500}>{typeof v === 'number' ? v.toFixed(1) : String(v)}</Text>
                      </Group>
                    ))}
                  </Stack>
                  <Text size="xs" c="dimmed" mt="xs">tick: {s.tickCount}</Text>
                </Card>
              </Grid.Col>
            ))}
          </Grid>
        </Paper>
      )}
    </Container>
  )
}
```

- [ ] **Step 2: typecheck + commit**

```powershell
pnpm --filter @iomtea/web typecheck
git add -A
git commit -m "feat: simulation data factory page"
```

---

## Phase G: 收尾与验证

### Task 17: 全局 typecheck + lint + 验证

- [ ] **Step 1: 全工程 typecheck**

```powershell
pnpm typecheck
```

- [ ] **Step 2: lint**

```powershell
pnpm lint
```

- [ ] **Step 3: 启动 dev 验证**

```powershell
pnpm dev
```

检查:
- 侧边栏分组正确显示
- `/data-export`、`/simulation`、`/alerts` 路由可访问
- 患者列表标签筛选、批量操作正常
- 模拟工厂启动后数据持续产生
- 骨架屏不再卡住

- [ ] **Step 4: 最终提交**

```powershell
git add -A
git commit -m "chore: final typecheck and lint fixes across project"
```
