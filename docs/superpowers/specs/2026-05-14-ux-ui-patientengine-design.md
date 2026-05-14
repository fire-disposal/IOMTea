# UX/UI 重设计 + 后端 PatientEngine 合并 — 设计规格

> **日期**: 2026-05-14
> **状态**: 已确认，执行中
> **原则**: 零向后兼容，删除 simulator Context，统一为 PatientEngine

---

## 1. 后端：PatientEngine 统一架构

### 1.1 核心模型

```
Patient (1:1) → TwinMap (1:N) → TwinRooms → TwinEntities → TwinActorStates
Patient (1:1) → Engine (运行时，每患者一个实例)
```

Engine 统一 tick 循环：
```
tick(engine):
  ├── 生理生成 (physiology/) — 纯函数，生成体征 observation events
  ├── 传感器摄入 — 读取最近 IoT/CV location events → 更新 actor 位置
  ├── 行为调度 (scheduler) — 作息表 + 触发规则 → 指令队列
  ├── 寻路移动 — A* + 门感知 → actor 位置插值
  ├── 告警评估 — 阈值检查 → alert events
  ├── 持久化 — events + actor_states + activity_log 批量写 DB
  └── 广播 — broadcastManager.broadcastTwin (WS)
```

### 1.2 文件清单

**删除** (15+ 文件):
```
apps/server/src/simulator/   ← 全部删除
├── engine.ts, clock.ts, factory.ts, db-writer.ts, types.ts
├── profiles/, physiology/, scenarios/, devices/, trpc/
```

**twin/ 目录新结构**:
```
twin/
├── engine.ts              ← 重写：统一 tick 循环
├── physiology/            ← 来自 simulator/physiology/
│   ├── vitals.ts, blood-pressure.ts, glucose.ts, motion.ts
│   ├── posture.ts, ecg-waveform.ts, respiratory-waveform.ts, pressure-distribution.ts
├── profiles/              ← 来自 simulator/profiles/
│   ├── index.ts
│   ├── elderly-cardiac.ts, post-surgery.ts, diabetes.ts
│   ├── copd-respiratory.ts, maternity.ts
├── scenarios/             ← 来自 simulator/scenarios/
│   └── index.ts
├── pathfinding.ts         ← 保留
├── nav-mesh.ts            ← 保留
├── behavior.ts            ← 保留
├── instruction.ts         ← 保留
├── scheduler.ts           ← 扩展（融入仿真时钟+作息）
├── db-writer.ts           ← 扩展（合并批量写入）
├── activity-aggregator.ts ← 保留
└── trpc/twin.router.ts    ← 扩展（start/pause/resume/setSpeed/injectScenario）
```

**修改的引用文件**:
- `core/trpc/routers/_app.ts` — 删除 simulatorRouter 导入，保留 twinRouter
- `src/index.ts` — 删除 simulator import，bootstrap 改用 twin 引擎创建

---

## 2. Web 端：患者中心化 UX

### 2.1 信息架构

```
/login
└── /patients (首页 — 卡片墙)
    │
    └── /patients/:id (患者详情)
        ├── Tab: 概览 (体征趋势左 + 孪生3D右)
        ├── Tab: 告警 (时间线)
        ├── Tab: 用药 (列表 + 依从)
        ├── Tab: 预约 (记录)
        └── Tab: 档案 (基本信息/病史/设备)

/settings (仅 admin)
├── 地图编辑器
└── 全局设备管理
```

### 2.2 核心组件

**PatientCard**（患者卡片）:
```
- 头像 + 姓名 + 在线绿点
- 副标题: 年龄/性别/主要病史 tags
- 体征 mini: HR (红色 if 异常), SpO2 (颜色判断)
- 告警徽标: 未处理数量 red badge
```

**PatientDetailShell**（患者详情壳）:
```
- 顶部: 患者姓名 + 返回按钮 + 设备在线状态
- TabBar: 概览 | 告警 | 用药 | 预约 | 档案
- 内容区: Tab 对应内容
```

**VitalChart**（体征趋势，概览 Tab 左半屏）:
```
- Recharts 多线同屏 (HR/BP/SpO2/Temp)
- 时间范围: 1h | 6h | 24h | 7d
- 告警参考线: 红色虚线标出阈值
```

**TwinViewer**（孪生视图，概览 Tab 右半屏）:
```
- R3F Canvas 3D 地图
- 工具栏: ▶⏸ | ⏩倍速 | 💉场景注入 | ⛶全屏
- 全屏模式: 3D 独占全屏 + 浮动工具栏
```

**状态组件**（全局公用）:
```
- <StateSkeleton>: 卡片骨架屏 (loading)
- <StateEmpty>: 图标 + 文案 + 操作按钮
- <StateError>: 红色提示 + 重试按钮
```

### 2.3 页面路由

**新增依赖**: `react-router-dom` (当前项目无路由，全部客户端状态切换)

```
<BrowserRouter>
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
      <Route index element={<PatientWall />} />
      <Route path="patients/:id" element={<PatientDetail />}>
        <Route index element={<PatientOverview />} />
        <Route path="alerts" element={<PatientAlerts />} />
        <Route path="medications" element={<PatientMedications />} />
        <Route path="appointments" element={<PatientAppointments />} />
        <Route path="profile" element={<PatientProfile />} />
      </Route>
      <Route path="settings" element={<SettingsLayout />}>
        <Route path="map-editor" element={<MapEditorPage />} />
        <Route path="devices" element={<DeviceListPage />} />
      </Route>
    </Route>
  </Routes>
</BrowserRouter>
```

### 2.4 删除的旧页面

- `DashboardOverview.tsx` — 功能融入 PatientWall
- `TrendsPage.tsx` — 功能融入 PatientOverview
- `DigitalTwinPage.tsx` — 功能融入 TwinViewer
- `WardManagementPage.tsx` — PatientWall 内嵌
- `AlertRulesPage.tsx` — PatientProfile tab 内
- `AssetManagerPage.tsx` — 融入地图编辑器

---

## 3. Flutter 端：感知端点

### 3.1 页面结构

```
/app
├── 绑定页 (首次或未绑定)
│   ├── PIN 码输入 (6位)
│   ├── QR 扫码按钮
│   └── 绑定成功 → 跳转采集面板
│
└── 采集面板 (已绑定)
    ├── AppBar: 患者名 + MQTT 状态点 + 设置齿轮
    ├── 相机预览 (YOLO 跌倒检测)
    │   └── 检测触发: 红色闪烁 + 发送报警
    ├── 底部可展开面板
    │   ├── MQTT 控制台
    │   ├── IMU 传感器
    │   └── 事件日志
    └── 设置页 (齿轮)
        ├── 解绑
        ├── 更换患者
        └── MQTT 配置
```

### 3.2 组件

- `BindingPage` — PIN 输入 + 扫码
- `CollectionPanel` — 主界面（相机 + 展开区）
- `StatusBar` — 顶部患者名/MQTT状态
- `ExpandableToolbox` — 底部可展开工具面板

---

## 4. 实施计划

### Phase 1: 后端 PatientEngine 合并 (2-3h)
1. 移动 physiology/profiles/scenarios 到 twin/
2. 重写 engine.ts 统一 tick
3. 合并 router
4. 删除 simulator/ + 更新引用
5. Typecheck 验证

### Phase 2: Web UX 重构 (3-4h)
1. 安装 react-router-dom
2. 路由 + PatientWall + PatientCard
3. PatientDetail + PatientOverview (体征+孪生)
4. PatientAlerts/PatientMedications/PatientAppointments/PatientProfile
5. SettingsLayout
6. 状态组件 (Skeleton/Empty/Error)
7. 删除旧页面

### Phase 3: Flutter 绑定 + 面板 (1-2h)
1. BindingPage
2. CollectionPanel 重构
3. ExpandableToolbox
4. 主题确认

---

> **执行**: 使用 subagent-driven-development 按 Phase 顺序实施
