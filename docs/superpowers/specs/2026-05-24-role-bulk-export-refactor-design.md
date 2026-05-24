# 角色体系重构 + 批量管理 + 数据导出 设计文档

## 1. 角色体系重构

### 1.1 当前状态

`role` 枚举: `admin | doctor | nurse | caregiver | patient | family`

### 1.2 新角色体系

| 角色 | 权限范围 | 说明 |
|---|---|---|
| `super_admin` | 全部（含任免管理员、权限控制） | 初始凭据由 env 注入 |
| `admin` | 患者管理、批量操作、标签、数据导出、设备管理 | 不能改权限配置 |
| `user` | 仅查看自身/关联患者的数据 | 覆盖家属、患者、专家等 |

### 1.3 超级管理员初始化

- 新增 env 变量:
  - `SUPER_ADMIN_USERNAME` (必需)
  - `SUPER_ADMIN_PASSWORD` (必需)
  - `SUPER_ADMIN_DISPLAY_NAME` (可选，默认 "超级管理员")
- 启动时查询 `role = 'super_admin'` 的用户数量
- 数量为 0 时 → 用 env 凭据创建超管账号
- 数量 > 0 时 → 跳过

### 1.4 变更影响

- `apps/server/src/core/db/schema/enums.ts`: roleEnum 值改为 `['super_admin', 'admin', 'user']`
- `apps/server/src/env.ts`: 新增三个环境变量
- `apps/server/src/core/services/permission-seed.ts`: 仅初始化 super_admin / admin 权限
- 前端角色相关显示统一更新
- 需生成新的数据库 migration 更新 enum 值

---

## 2. 标签(Tag)系统

### 2.1 数据模型

新增两张表:

**`patient_tags`** — 标签定义

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid PK | — |
| `name` | varchar(50) unique NOT NULL | 标签名 |
| `color` | varchar(7) DEFAULT '#228be6' | 颜色 hex |
| `created_at` | timestamptz DEFAULT now() | — |

**`patient_tag_links`** — 患者-标签关联（多对多）

| 字段 | 类型 | 说明 |
|---|---|---|
| `patient_id` | uuid FK → patients.id | — |
| `tag_id` | uuid FK → patient_tags.id | — |

联合主键: `(patient_id, tag_id)`，级联删除

注: 不复用 patients.tags jsonb（该字段已存储 homeGraph 等孪生数据）

### 2.2 API (tRPC)

```
tag.list()        → Tag[]
tag.create(name, color?) → Tag
tag.update(id, name?, color?) → Tag
tag.delete(id)    → void
```

### 2.3 前端

- 患者列表页顶部：Tag 多选 Chips 筛选栏
- 侧边栏：标签动态列表项（按标签过滤患者视图）
- 批量操作：批量添加/移除标签
- CSV 导入：导入时可选择附加标签

---

## 3. CSV 批量导入

### 3.1 流程

1. **上传**: 拖拽或点击上传 `.csv` 文件
2. **解析预览**: 前端解析 CSV，以表格形式展示所有行
3. **字段映射**: 自动匹配表头，支持列表头名对应中/英文
4. **逐行校验**: 姓名必填、性别值合法、日期格式正确、手机号格式等
5. **颜色标记**: 绿色=有效行，红色=含错误行，显示错误原因
6. **导入配置**: 选择附加标签、设置默认密码
7. **执行导入**: 调用 `patient.bulkCreate` mutation（仅导入有效行）
8. **结果展示**: 成功数 / 跳过数 / 失败明细

### 3.2 账号关联

CSV 每行同时创建 user + patient:
- `username` 取 `phone` 字段值（手机号作为登录账号），若无 phone 则自动生成
- `password` 使用导入时设置的默认密码
- `role` 固定为 `user`
- 创建 user 后以 `patient.user_id` 关联

### 3.3 后端

```
patient.bulkCreate(input: {
  defaultPassword: string
  tagIds?: string[]
  patients: { name, gender?, birthDate?, phone?, heightCm?, weightKg?, bloodType?, address?, emergencyContact?, emergencyPhone? }[]
}) → { created: number, errors: { index: number, reason: string }[] }
```

### 3.4 CSV 支持字段

`name`(必填), `phone`(用作登录账号), `gender`, `birth_date`, `height_cm`, `weight_kg`, `blood_type`, `address`, `emergency_contact`, `emergency_phone`

---

## 4. 批量操作与激活追踪

### 4.1 批量操作

患者列表支持多选（复选框），批量操作按钮：

- **批量停用** — 调用 `patient.bulkUpdateStatus(ids, 'archived')`
- **批量添加标签** — Tag 选择器弹窗，批量追加
- **批量移除标签** — Tag 选择器弹窗，批量移除

### 4.2 激活追踪

- 判定标准: 通过 `patients.user_id` 关联 `users` 表，`users.last_login_at IS NOT NULL` ↔ 已激活
- 患者列表新增"激活状态"列：绿色圆点=已激活，灰色=未激活
- 后端 list 接口 JOIN users 表返回 `isActivated` 字段
- 激活状态筛选器：全部 / 已激活 / 未激活
- 患者详情页显示关联用户首次登录时间

---

## 5. 数据导出

### 5.1 页面

独立页面路由 `/data-export`

### 5.2 功能

**表单配置区:**
- 实体选择: 患者 / 事件 / 用药 / 设备 (单选)
- 字段选择: 勾选式多选框（根据所选实体动态展示字段列表）
- 过滤器: 时间范围 (date range picker) + 标签筛选 (tag chips) + 患者筛选 (searchable select)
- 格式选择: CSV / Excel(.xlsx)

**预览区:**
- 展示前 20 行数据预览（调用后端 `export.preview` 接口）
- 显示总行数统计

**执行导出:**
- 调用 `export.download` 返回文件流
- 浏览器触发下载

### 5.3 后端 API

```
export.preview(entity, fields, filters) → { columns, rows, total }
export.download(entity, fields, filters, format) → file blob
```

---

## 6. UI 修复

### 6.1 侧边栏重建

| 分组 | 菜单项 | 图标 | 路径 | 权限 |
|---|---|---|---|---|
| **监控** | 数据大屏 | IconScreenShare | `/data-dashboard` | all |
| | 工作台 | IconDashboard | `/` | all |
| | 告警看板 | IconAlertTriangle | `/alerts` | admin+ |
| **管理** | 患者管理 | IconUsers | `/patients` | admin+ |
| | 用药监督 | IconPill | `/medications` | admin+ |
| | 数据导出 | IconFileExport | `/data-export` | admin+ |
| | 模拟工厂 | IconFlask | `/simulation` | admin+ |
| **设备与接入** | 设备列表 | IconDevices | `/settings` | admin+ |
| | PIN 管理 | IconKey | `/iot/pins` | admin+ |
| **系统** | 用户管理 | IconUsersGroup | `/settings/users` | super_admin |

### 6.2 骨架屏修复

问题: 部分页面骨架屏持续播放不停止

根因排查:
- `QueryGate` 组件的 `isLoading` 永不为 `false`（useQuery 未返回结果）
- 组件 useEffect 中的 loading state 未在数据到达后更新

修复方案:
- 逐页审查 `useQuery` / `api.useQuery()` 调用，确保 loading/error/data 三态正确处理
- 统一使用 `QueryGate` 或 `StateSkeleton` + 条件渲染模式
- 添加 error boundary，避免接口 500 时只显示骨架屏而非错误提示

### 6.3 页面完善

- 设备管理 (`/settings`) — 当前为占位文案，改为实际设备列表 CRUD + 状态监控
- 用户管理 (`/settings/users`) — 现有页面保留
- 全局告警看板 (`/alerts`) — 补充路由，侧边栏显示
- 移除路由: `/node-graph`, `/avatar-editor`, `/trends`, `/settings/virtual-pins`
- 新增路由: `/data-export`, `/alerts`, `/simulation`

---

## 7. 模拟数据工厂

### 7.1 定位

**展示用数据生成器**，服务端常驻运行。Web 仅作控制面板，启动后关闭页面仍持续产数。核心特征：各指标独立间隔、随机延时、不要求 tick 对齐——模拟真实设备上报的不规则性。

### 7.2 运行模型

- **服务端常驻**：`factory.ts` 维护 `Map<patientId, SimInstance>` 内存表
- **每个 SimInstance 内部有 N 个独立 Timer**（一个指标一个），各自按配置的间隔 + 随机抖动触发
- **Web 面板控制**：前端通过 tRPC 发送 `start/stop/setSpeed`，不需保持连接
- **进程重启即停**：无需持久化

### 7.3 指标编排模型

每个患者画像定义一组指标，每项指标有独立的产生策略：

```typescript
{
  metric: 'heart_rate',
  interval: { min: 3000, max: 5000 },  // 每 3~5s 随机一次
  jitter: 0.2,                          // ±20% 额外随机偏差
  generator: 'heartRateBaseline',       // 指向 physiology 中的生成函数
  unit: 'bpm',
}
```

不同指标不同的自然间隔：

| 指标 | 典型间隔 | 原因 |
|---|---|---|
| heart_rate, spo2, resp_rate | 3~5s | 高频体征 |
| systolic_bp, diastolic_bp | 30~60s | 血压变化慢 |
| temperature | 60~120s | 体温缓慢波动 |
| glucose | 5~10min | 血糖变化周期长 |
| posture, bed_status | 5~30s | 状态切换 |
| motion_index | 10~30s | 活动量变化 |

每个 Timer 到期时：
1. 取当前模拟时间 + 随机 jitter
2. 调用对应 physiology 生成函数（传入 profile baseline、模拟时间、上一值）
3. 写入 events 表
4. 重置 Timer 为 `interval.min + random * (interval.max - interval.min)`

### 7.4 新模块架构

```
apps/server/src/sim/
├── factory.ts          # 引擎主控：启动/停止/调速/状态
├── scheduler.ts        # 编排引擎：管理 N 个独立 Timer，随机间隔 + 抖动
├── physiology.ts       # 整合 physiology/*.ts（14项指标+昼夜节律+高斯噪声+马尔可夫姿态）
├── profiles.ts         # 5 种患者画像 + 每画像的指标编排配置
└── router.ts           # tRPC 路由
```

| 从 Twin Engine 移植 | 说明 |
|---|---|
| physiology/*.ts 全部指标 | 每指标独立生成函数 |
| 昼夜节律 + 高斯噪声 + 马尔可夫姿势 | 生理合理性 |
| 5 种患者画像 | 不同基线、不同指标编排 |

| 不移植 | 原因 |
|---|---|
| A* 路径寻路、Nav mesh、Room graph、Actor 行为状态机 | 不需要空间模拟 |
| 统一 tick 循环 | 改为独立 Timer 编排 |

| 从 Virtual PIN 继承思路 | 改进 |
|---|---|
| setInterval 驱动 | 改为 scheduler 管理多 Timer |
| generatorConfig metrics 配置 | 扩展为带 interval/jitter 的编排配置 |

### 7.5 数据写入

- `source = 'simulator'`，`kind = 'observation'`
- `tags: { sim: true, profile: 'elderly-cardiac' }`

### 7.6 前端页面 `/simulation`

**上部控制栏：**
- 患者搜索+多选
- 画像下拉（5 种预置）
- 启动 / 停止 / 调速（全局速度倍率）

**中部指标编排面板：**
- 选中画像后展开指标表，每行：指标名、最小间隔(ms)、最大间隔(ms)、当前分配的患者数
- 允许覆盖默认间隔配置（per-session 调节）
- "重置为默认" 按钮

**下部实时监控：**
- 选中患者的指标卡片网格（实时刷新最近值）
- 事件滚动日志

### 7.7 tRPC API

```
sim.factory.start(patientIds[], profile, overrides?) → { ok, count }
sim.factory.stop(patientIds[])                        → { ok, count }
sim.factory.setSpeed(speed)                           → { ok }
sim.factory.status()                                  → { patients: SimStatus[] }
sim.factory.profileConfig(profile)                    → { metrics: MetricConfig[] }
```
