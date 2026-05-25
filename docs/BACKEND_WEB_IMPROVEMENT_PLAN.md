# 后端 + Web 改进方案（基于代码现状）

> 日期：2026-05-15
> 最后更新：2026-05-25 — 多项已落地（见各阶段标记）
> 目标场景：居家健康监控（非临床护士站）

## 1. 现状结论（从代码出发）
- 权限体系"有种子、无执行"：权限种子已存在，但未在路由层做授权校验。→ 已部分落地，9 个核心路由已接入 RBAC。
- 数据域缺少"家庭/监护关系"建模：→ `user_patient_links` 桥接表已替代患者上的 userId 字段。
- 业务闭环缺失：告警、用药、随访、设备运维 → 告警/用药闭环已建，随访待重构。
- Web 实时订阅无鉴权 → 已修复，WebSocket 支持 JWT。
- 代码与文档不一致 → 已修复。

## 2. 关键问题清单（含代码依据）
### P0 级
1) **实时订阅无鉴权/无权限过滤** ✅ (2026-05-25)
   - WebSocket `/ws` 已增加 JWT token 验证，无效 token 连接被拒。
   - 支持 ward/map/patient 三级订阅范围。

2) **权限与角色未落地** 🔶 部分落地 (2026-05-25)
   - `requirePermission` 已接入 alert, alertRule, dashboard, data, export, medication, patient, node-graph, home-graph 路由。
   - 尚有 user, pin, tag, checklist, credit, streak, plan, thresholds, health-records, virtual-pin ~9 个路由未接入 RBAC 中间件。

### P1 级
3) **领域模型缺失（家庭/监护关系）** 🔶 基础模型已建 (2026-05-25)
   - `user_patient_links` 桥接表已落地 (userId + patientId + relation)，替代了原 patients.userId/primaryDoctorId 字段。
   - 仍缺少 households 组表、家庭成员授权规则、看护人排班等高级模型。

4) **闭环流程缺失（告警/用药/随访）** 🔶 部分完成 (2026-05-25)
   - 告警状态已扩展为 new/assigned/acknowledged/handled/resolved/closed。
   - 用药管理 (medication CRUD + adherence tracking) 已落地。
   - 预约/随访模块已移除，后续需作为 plan/checklist 子模块重新设计。

5) **文档与代码不一致** ✅ 已修复 (2026-05-25)
   - 文档已更新以反映当前代码状态。

## 3. 改进方案（按阶段）

### 阶段 A：安全与闭环底座（1-2 周） — ✅ 核心已完成 (2026-05-25)
- **WebSocket 鉴权与授权** ✅
  - `/ws` 连接必须携带 token，服务端校验并限制 ward/map/patient 订阅范围。
- **引入最小授权检查** 🔶
  - 在 9 个核心 tRPC 路由层引入 `requirePermission` 校验。
  - 尚余 ~9 个辅助路由待接入。
- **补齐告警处置轨迹** ✅
  - 告警状态机已扩展为 new→assigned→acknowledged→handled→resolved→closed。

### 阶段 B：居家场景模型落地（2-4 周） — 🔶 基础完成 (2026-05-25)
- **家庭/监护关系建模** 🔶
  - `user_patient_links` 桥接表已落地 (userId + patientId + relation)。
  - 仍缺 Household 组表、家庭成员授权规则、看护人排班等高级模型。
- **患者-设备-家庭统一入口** 🔶
  - `user_patient_links` + PIN 管理 (`users_pin` 表, 含 pin_type 枚举) 可承载基础绑定需求。
  - 仍缺"家庭视图"统一页面。

### 阶段 C：业务闭环完善（2-4 周） — 🔶 部分完成 (2026-05-25)
- **告警闭环** ✅：状态机已扩展为 new→assigned→acknowledged→handled→resolved→closed。
- **用药闭环** ✅：medication CRUD + adherence 记录已落地。
- **随访闭环** 🔶：appointment 模块已移除，后续需作为 plan/checklist 子模块重新设计。

### 阶段 D：Web 信息架构重构（2-3 周） — 🔶 部分完成 (2026-05-25)
- **角色视图拆分** ❌：尚未落地。
- **统一任务入口** 🔶：导航已重构为侧边栏 (TanStack Router file-based routing)。
- **建立可演示路径** 🔶：基础链路 (注册→绑定→PIN→采集→告警) 可行，缺完整远程干预闭环。

## 4. 建议的验收标准（简版）
- 角色最小权限控制生效（无法越权订阅或查看不属于家庭的数据）。🔶 部分达成
- 具备 1 条完整的"居家健康闭环演示路径"。❌ 未达成
- 告警处置链路可追溯（责任人/时间/结果）。✅ 已达成

---

> 说明：本文件仅用于记录改进方向与优先级，后续可拆分为任务清单与里程碑。
