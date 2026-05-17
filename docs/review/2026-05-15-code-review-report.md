# IOMTea 代码审查报告

> 日期：2026-05-15
> 站位：统筹/审核/设计/项目经理
> 最后更新：2026-05-16 — 多项问题已解决（见第 7 节 ✅ 标记）
> 审阅范围：apps/server（后端）、apps/web（Web前端）、packages/shared-types（共享类型）
> 总代码量：约 8,600 行（后端）+ 3,200 行（前端）+ 1,300 行（共享类型）

---

## 目录

1. [审查结论](#1-审查结论)
2. [架构级问题（P0）](#2-架构级问题p0)
3. [后端问题清单](#3-后端问题清单)
4. [Web 前端问题清单](#4-web-前端问题清单)
5. [居家场景适配性诊断](#5-居家场景适配性诊断)
6. [共享类型包问题](#6-共享类型包问题)
7. [改进计划](#7-改进计划)
8. [建议立即执行项（48小时）](#8-建议立即执行项48小时)

---

## 1. 审查结论

### 1.1 总体评价

当前系统属于**功能型原型/早期 MVP**，核心技术栈选型合理（Hono + tRPC + Drizzle + React + Mantine + Three.js），但实现层面存在严重的架构债务和安全漏洞：

- **安全**：认证体系有框架无执行，RBAC 基础设施完整但从未被调用，WebSocket 无认证，任何登录用户可访问全部数据
- **类型安全**：约 156 处 `as any` 类型绕过，tRPC 端到端类型安全的核心价值被完全消解
- **可靠性**：静默错误吞没遍布代码，无 Error Boundary，6/11 页面无错误状态
- **场景适配**：系统为临床护士站设计，与居家健康监控的目标场景存在根本性偏差

### 1.2 代码健康度

| 维度 | 评级 | 说明 |
|------|------|------|
| 类型安全 | 4/10 | 156 处 `as any`，Drizzle 枚举类型系统被系统性绕过 |
| 安全 | 3/10 | RBAC 未启用，WebSocket 无认证，数据无所有权隔离 |
| 错误处理 | 3/10 | Silent catch 蔓延，无 Error Boundary，6/11 页面无错误 UI |
| 测试覆盖 | 1/10 | 仅 5 个测试文件，无 E2E |
| 代码组织 | 7/10 | Monorepo 结构清晰，DDD-Lite 边界定义合理但执行不到位 |
| 前端架构 | 4/10 | StoreProvider 反模式，N+1 查询泛滥，实时通道 key 不匹配 |
| 居家场景适配 | 2/10 | HIS/护士站设计，与居家监控目标严重偏差 |

---

## 2. 架构级问题（P0）

### 2.1 RBAC 基础设施存在但未接入任何路由

**严重度：P0 — 安全**

RBAC 完整基础设施已存在：
- `permissions` 表（16 个权限 code）
- `rolePermissions` 表（6 种角色→权限映射）
- `core/trpc/middleware/rbac.ts` 定义了 `requirePermission(...codes)` 和 `adminProcedure`
- `core/services/permission-seed.ts` 种子了 6 种角色的权限集

但**没有任何一个 tRPC 路由实际调用 `requirePermission`**。`adminProcedure` 已定义但从未被 import。所有路由仅使用 `protectedProcedure`（仅验证有 token）。

后果：一个 `patient` 角色的用户可：
- 删除任何患者（`patient.delete`）
- 修改任何设备（`device.update`）
- 查看所有告警（`alert.list`）
- 写入任意患者数据（`data.ingest`）

**代码位置**：
- `core/trpc/middleware/rbac.ts` 定义了中间件但未被消费
- `core/trpc/routers/patient.ts` — 所有 procedure 无 `requirePermission`
- `core/trpc/routers/device.ts` — 同上
- `core/trpc/routers/alert.ts` — 同上
- `core/trpc/routers/data.ts` — 同上
- `core/trpc/routers/_app.ts` — 注册了 11 个 router 但无权限检查

### 2.2 数据所有权检查完全缺失

**严重度：P0 — 安全**

所有 CRUD 操作的 patientId/deviceId 参数由客户端传入，服务端不验证请求用户是否有权访问该资源。

受影响路由：
- `patient.list` / `patient.byId` / `patient.delete` — 无所有权过滤
- `data.timeseries` / `data.latest` / `data.ingest` — 任意 patientId 均可查询
- `device.list` / `device.update` / `device.delete` — 无设备归属检查
- `alert.list` / `alert.acknowledge` / `alert.resolve` — 无患者范围限制

`patients` 表虽然有 `userId` 字段可关联患者到用户，但从未用于访问控制。

### 2.3 WebSocket 无认证

**严重度：P0 — 安全**

`index.ts:111-124` — WebSocket 连接 `/ws?wardId=xxx` 不验证任何 token。任何知道 wardId 的人可订阅所有实时体征数据、实体状态、位置信息。

同时，`useRealtime.ts:97` 通过 `queryClient.setQueryData` 写入 React Query 缓存时使用 `['data', 'latest', { patientId }]` 作为 key。此 key 可能与 tRPC `trpc.data.latest.useQuery` 自动生成的 key 不匹配，导致**实时更新到达前端但 UI 不刷新**。

### 2.4 静默错误吞没

**严重度：P0 — 可靠性**

代码中大量使用 `.catch(() => {})` 模式，错误被完全吞噬：

```
twin/engine.ts:319,323      — 事件数据库写入失败静默跳过
twin/engine.ts:441,457      — 场景注入失败静默跳过
core/services/medication.ts:142,173 — 依从性记录失败静默跳过
ingest/mqtt/mattress/index.ts:58   — MQTT 消息处理失败静默跳过
index.ts:137                — 非法 WebSocket 消息静默丢弃
```

后果：引擎 tick 持续进行但数据不落地，操作者无感知。监控系统自身健康无法被监控。

### 2.5 类型安全被系统性绕过

**严重度：P1 — 可维护性**

后端约 98 处、前端约 58 处 `as any`，总计约 156 处。根因是 Drizzle ORM 的枚举字段类型与 TypeScript 字面量类型不兼容，代码选择了 `as any` 绕过而非通过类型转换函数修复。

后端高密度文件：
- `twin/trpc/twin.router.ts` — ~30 处
- `core/services/medication.ts` — ~20 处
- `twin/engine.ts` — ~10 处
- `twin/db-writer.ts` — ~10 处

前端高密度文件：
- 所有 pages 的 mutation/query 调用 — `as any` 传递参数
- `PatientMedications.tsx` — 数组索引关联渲染

### 2.6 模块级可变全局状态

**严重度：P1 — 可扩展性**

`twin/trpc/twin.router.ts:28` 和 `twin/engine.ts:45` 分别维护了模块级的 `Map<string, PatientEngine>` 全局变量：
- 多实例部署时引擎状态不共享
- 无服务器关闭清理（`process.on('SIGTERM')` 未处理）
- 无引擎数量上限（恶意用户可创建无限引擎）
- `setInterval` 在 tick 中创建，引擎停止后可能泄漏

---

## 3. 后端问题清单

### 3.1 认证与安全

| 编号 | 问题 | 严重度 | 位置 |
|------|------|--------|------|
| B-01 | RBAC 未接入任何路由 | P0 | `rbac.ts` vs 所有 router |
| B-02 | 数据所有权检查缺失 | P0 | 所有 CRUD router |
| B-03 | WebSocket 无认证 | P0 | `index.ts:111-124` |
| B-04 | 静默错误吞没 | P0 | 6 处 `.catch(() => {})` |
| B-05 | 认证端点无速率限制 | P1 | `core/trpc/routers/auth.ts` |
| B-06 | 注册竞态条件 | P1 | `auth.ts:19-26` |
| B-07 | Refresh token 无吊销机制 | P1 | `auth.ts` |
| B-08 | RBAC 角色缓存永不失效 | P1 | `rbac.ts:7` |
| B-09 | `requirePermission` 使用 `some()` 而非 `every()` | P1 | `rbac.ts:39` |
| B-10 | JWT payload 中 role 无运行时验证 | P1 | `middleware/auth.ts` |

### 3.2 数据模型

| 编号 | 问题 | 严重度 | 位置 |
|------|------|--------|------|
| B-11 | 缺少家庭/监护关系模型 | P1 | 整个 schema |
| B-12 | 患者读写 schema 字段不匹配 | P1 | `shared-types/schemas/patient.ts` |
| B-13 | `patientSnapshots` 缺少唯一约束 | P2 | `core/db/schema.ts` |
| B-14 | `devices.roomId` FK 在 migration 而非 schema | P2 | `schema.ts:87` |
| B-15 | 患者删除不级联清理 | P1 | `routers/patient.ts` |
| B-16 | 设备模型缺少 IoT 字段（battery/信号等） | P2 | `schema.ts` devices 表 |
| B-17 | `user.list` 从 DB 查询了 `passwordHash` | P2 | `routers/user.ts:14` |

### 3.3 代码质量

| 编号 | 问题 | 严重度 | 位置 |
|------|------|--------|------|
| B-18 | ~98 处 `as any` | P1 | 20+ 文件 |
| B-19 | ingest 层使用 console.log 而非 pino | P1 | `ingest/tcp/`, `ingest/mqtt/` |
| B-20 | 多表操作无事务包装 | P2 | `twin/db-writer.ts`, `medication.ts` |
| B-21 | 无服务器关闭优雅清理 | P2 | `index.ts` |
| B-22 | 引擎无数量上限 | P2 | `twin/engine.ts` |
| B-23 | WebSocket 无 backpressure 处理 | P2 | `broadcast.ts:101` |
| B-24 | `data.ingest` 无批量大小限制 | P2 | `routers/data.ts` |
| B-25 | `updateMedication` 使用 `Record<string, any>` | P2 | `services/medication.ts:49` |

---

## 4. Web 前端问题清单

### 4.1 架构与安全

| 编号 | 问题 | 严重度 | 位置 |
|------|------|--------|------|
| W-01 | 无 Error Boundary | P0 | 全应用 |
| W-02 | `PatientDetailShell` 加载时 `return null` | P0 | `PatientDetailShell.tsx:34-35` |
| W-03 | 实时更新 may not reach UI（key 不匹配） | P0 | `useRealtime.ts:97` |
| W-04 | `StoreProvider` 副作用组件反模式 | P0 | `StoreProvider.tsx` |
| W-05 | `isAdmin` 硬编码 `true` | P0 | `App.tsx:40` |
| W-06 | Token 存 localStorage—XSS 风险 | P1 | `store/auth.ts` |
| W-07 | 多 401 并发触发多次 refresh | P1 | `trpc.ts` |
| W-08 | Zustand Map 每次 tick 新引用→全局重渲染 | P1 | `store/entityState.ts` |

### 4.2 用户体验

| 编号 | 问题 | 严重度 | 位置 |
|------|------|--------|------|
| W-09 | 6/11 页面无错误状态 | P1 | 多处 |
| W-10 | 无分页，所有列表 `pageSize: 100` | P1 | 多处 |
| W-11 | N+1 查询：PatientCard 每卡独立查询 | P1 | `PatientCard.tsx` |
| W-12 | N+1 查询：GlobalMedications/Appointments 每行独立查 | P1 | `GlobalMedications.tsx` |
| W-13 | 16 个 `setInterval` 轮询替代推送 | P1 | `StoreProvider.tsx`, `PatientOverview.tsx` |
| W-14 | "XX医院"占位符遗留 | P2 | `PatientAppointments.tsx:230` |
| W-15 | emoji ✏️🗑 替代 tabler-icons | P2 | `DeviceListPage.tsx`, `PatientMedications.tsx` |
| W-16 | 59 处内联 `style={{}}`，无 CSS 分层 | P2 | 全应用 |
| W-17 | 无暗色模式 | P3 | `theme.ts` |
| W-18 | 无懒加载/代码分割 | P3 | `App.tsx` |
| W-19 | Token 无过期预检 | P2 | `trpc.ts` |
| W-20 | 地图编辑器与数字孪生 3D 渲染代码重复 | P2 | `TwinRenderer3D.tsx` vs `MapRenderer3D.tsx` |

### 4.3 导航与信息架构

| 编号 | 问题 | 严重度 | 位置 |
|------|------|--------|------|
| W-21 | 主导航为 HIS 护士站设计 | P1 | `App.tsx` |
| W-22 | 设备列表页被用作设置页（路由/页面不匹配） | P2 | `App.tsx:83` |
| W-23 | 无角色视图区分 | P1 | `App.tsx` |
| W-24 | 无家庭视图入口 | P1 | 缺失 |
| W-25 | 无健康日报/摘要页面 | P1 | 缺失 |

---

## 5. 居家场景适配性诊断

### 5.1 核心矛盾

**系统为临床护士站设计，但目标用户是居家健康监控。**

### 5.2 差距矩阵

| 维度 | 当前状态 | 应然状态 |
|------|---------|---------|
| **主导航** | 患者监护、告警中心、用药管理、预约管理 | 家庭视图、我的设备、异常提醒、远程干预、健康日报 |
| **患者模型** | `room`/`bedNumber` 字段，医院床位视角 | `homeId`、楼层、单元、家庭关系 |
| **角色体系** | admin/doctor/nurse/caregiver（临床角色） | 家庭成员、签约医生、机构管理员、设备运维 |
| **设备模型** | 缺 batteryLevel/signalStrength/安装位置 | IoT 设备端到端管理（注册→安装→运行→维护→退役） |
| **告警处置** | 仅有 acknowledge/resolve 状态切换 | 指派→确认→处置→追踪→复盘 闭环 |
| **数据展示** | 护士站式实时仪表盘 | 家庭成员友好型摘要、趋势解读、AI 健康建议 |
| **数字孪生** | 地图编辑器 + 3D 渲染，孤岛功能 | 与告警/用药/设备联动的综合态势 |
| **用药管理** | 已有数据结构，缺家庭执行侧 UI | 家庭成员可确认/报告服药，漏服告警联动 |
| **健康记录** | 仅有仿真数据生成的时序指标 | 血糖、体重、血压、用药完整记录，人工录入+设备采集双通道 |
| **小程序** | Taro 简单九宫格 | 家庭端主要操作入口 |

### 5.3 居家场景的 5 个关键角色

| 角色 | 核心诉求 | 使用端 |
|------|---------|--------|
| **长者/患者** | 简单易用的健康记录，自动采集数据，异常时家人知晓 | 小程序（主要）、Flutter 传感器 |
| **家庭成员/看护人** | 远程查看状态，接收异常告警，确认用药，安排预约 | 小程序（主要）、Web |
| **签约医生/健康管理师** | 多人健康趋势，异常干预，随访记录，用药调整 | Web（社区管理端） |
| **机构管理员** | 设备管理，数据总览，报表统计 | Web（社区管理端） |
| **设备运维** | 设备状态，告警处理，安装维护 | Web + Flutter 工具 |

---

## 6. 共享类型包问题

### 6.1 Schema 问题

| 编号 | 问题 | 严重度 | 位置 |
|------|------|--------|------|
| S-01 | 患者 create/read schema 字段不一致 | P1 | `schemas/patient.ts` |
| S-02 | `z.any()` 过度使用（grid/params/actions/triggerCondition） | P1 | `schemas/twin.ts` |
| S-03 | 常量碎片化：8+ 枚举值内联在 schema 中而非 `constants.ts` | P2 | `schemas/appointment.ts`, `medication.ts`, `twin.ts` |
| S-04 | 路径查找用排序替代 BinaryHeap | P2 | `map/pathfinding.ts` |
| S-05 | `mergeZones` 贪心算法可丢弃小块碎片 | P2 | `map/validation.ts` |
| S-06 | 行为引擎无多角色协调/碰撞避免 | P2 | `map/behavior.ts` |
| S-07 | 默认工厂当 patientIds 不足时空字符串 | P2 | `map/factory.ts:73` |

### 6.2 缺少的居家场景类型

| 类别 | 缺失内容 |
|------|---------|
| **临床** | Barthel/Morse/Braden 量表、护理计划、结构化生命体征 |
| **用药** | 药物交互检查、处方续方、NDC/ATC 编码、MAR |
| **安全** | 跌倒风险评估、离床协议、走失检测 |
| **通信** | 医患消息、远程问诊、家人通知偏好 |
| **地图** | 多楼层、室外区域、无障碍设施（坡道/扶手）、危险区域 |
| **行为** | ADL 全集（洗澡/如厕/穿衣/修饰/转移）、IADL 全集（烹饪/清洁/购物） |
| **注册表** | 轮椅/助行器/便盆椅/扶手/移位机 ~20+ 缺失实体 |
| **排程** | 周期性预约、访问模式、看护人排班 |

---

## 7. 改进计划

### 阶段 A：安全底座（第 1-2 周）

```
A-01 [P0] requirePermission 接入所有路由 ✅
      场景：16 个 permission code 全覆盖
      文件：所有 routers/*.ts + rbac.ts
      状态：已接入 device.ts 和 patient.ts 路由

A-02 [P0] WebSocket JWT 认证
     场景：连接时校验 token，订阅范围受 role 限制
     文件：index.ts, broadcast.ts, useRealtime.ts

A-03 [P0] 修复实时通道 key 不匹配
     场景：验证/统一 tRPC query key 格式
     文件：useRealtime.ts

A-04 [P0] Error Boundary 层级
     场景：全局 ErrorBoundary + 页面级 fallback
     文件：main.tsx, App.tsx, 新增 ErrorBoundary.tsx

A-05 [P1] 修复所有 silent catch
     场景：6 处 .catch(() => {}) → 结构化日志 + 可观测
     文件：engine.ts, medication.ts, mattress/index.ts, index.ts
```

### 阶段 B：领域模型强化（第 3-5 周）

```
B-01 [P0] 家庭/监护关系模型
     场景：households + household_members + caregiver_assignments 表
     文件：schema 新增 3 表 + migration + shared-types schemas

B-02 [P1] 患者模型居家适配
     场景：home_id、building、floor、unit；补全残缺字段
     文件：schema.ts, schemas/patient.ts

B-03 [P1] 设备模型 IoT 适配
     场景：batteryLevel、signalStrength、firmwareVersion、installLocation
     文件：schema.ts, schemas/device.ts

B-04 [P1] 告警闭环状态机
     场景：new→assigned→acknowledged→resolved→reviewed
     文件：schemas/events.ts, routers/alert.ts, services/alert.ts

B-05 [P2] 常量提取与去碎片化
     场景：8+ 内联枚举移至 constants.ts
     文件：constants.ts, 所有 schema 文件
```

### 阶段 C：前端信息架构重构（第 5-8 周）

```
C-01 [P1] 重构主导航 ✅
      场景：家庭概览→异常提醒→设备管理→健康日报→任务中心
      文件：App.tsx, 新增 pages
      状态：导航已重构为侧边栏模式，包含工作台/居民管理/健康趋势/异常处置/随访管理/用药监督/IoT配置

C-02 [P1] 分角色视图
     场景：家庭成员视图 / 医生视图 / 管理员视图
     文件：新增 role-based layout

C-03 [P2] 移除 ~58 处前端 as any
     场景：类型安全恢复
     文件：所有 pages + components

C-04 [P2] 移除 N+1 查询
     场景：batch 查询替代逐卡/逐行查询
     文件：PatientCard.tsx, GlobalMedications.tsx, GlobalAppointments.tsx

C-05 [P2] setInterval 轮询→推送
     场景：tRPC subscription 或 WebSocket 替代
     文件：StoreProvider.tsx, PatientOverview.tsx
```

### 阶段 D：居家健康记录闭环（第 6-10 周）

```
D-01 [P1] 血糖记录完整功能
     场景：手动录入 + 设备同步 + 趋势图表 + 目标范围 + 异常标记
     文件：新增 pages + schemas + routers

D-02 [P1] 体重记录完整功能
     场景：手动录入 + 蓝牙秤同步 + 趋势图表 + 目标设定
     文件：新增 pages + schemas + routers

D-03 [P1] 用药记录家庭端
     场景：家庭成员确认服药 / 漏服告警 / 依从性报表
     文件：新增小程序页面 + API 扩展

D-04 [P1] 健康日报
     场景：每日摘要、异常汇总、趋势解读（家庭成员友好）
     文件：新增聚合接口 + 日报页面

D-05 [P2] 数字孪生抽象重设计 ✅
      场景：图论抽象房间为节点，路径查找算法独立
      文件：shared-types/src/map/ 重构
      状态：旧 map/ 模块已移除，替换为 home-map/；寻路/行为/导航网格已移至 twin/
```

### 阶段 E：Taro 小程序重构 + Flutter 传感器（第 8-12 周）

```
E-01 [P1] Taro 小程序重构为家庭端主要入口
     场景：重新设计信息架构，覆盖完整居家健康场景
     文件：apps/miniapp/ 整体重建

E-02 [P2] Flutter 传感器节点终端
     场景：统一 MQTT 管理，IMU/视觉/蓝牙协议适配
     文件：apps/flutter/ 整体设计

E-03 [P2] 数字孪生算法模块化 ✅
      场景：抽离图论引擎、房间接口、寻路器为独立模块
      文件：shared-types/src/map/ 重构
      状态：同 D-05，已完成
```

---

## 8. 建议立即执行项（48 小时）

以下 5 项改动共约 50 行，可显著降低安全风险和数据丢失风险：

| 操作 | 位置 | 改动量 | 效果 |
|------|------|--------|------|
| WebSocket 加 JWT 验证 | `index.ts:111-124` | ~10 行 | 阻止未授权实时数据访问 |
| 修复 PatientDetailShell 空白屏 | `PatientDetailShell.tsx:34-35` | ~5 行 | 显示 loading skeleton |
| patient.delete 加 requirePermission ✅ | `routers/patient.ts:93` | ~3 行 | 阻止非授权删除 |
| 验证/修复 useRealtime query key | `useRealtime.ts:97` | ~5 行 | 确保实时数据到达 UI |
| silent catch 加日志 | `engine.ts:319,323` | ~10 行 | engine 错误可观测 |
