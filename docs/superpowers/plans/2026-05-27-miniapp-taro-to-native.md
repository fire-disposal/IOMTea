# 小程序 Taro → 原生 WeChat 迁移计划

**目标**: 消除 Taro prebundle 编译层，28 页全部功能无损迁移至原生小程序框架

---

## 架构映射

| Taro | 原生 |
|------|------|
| `apps/miniapp/` | `apps/miniapp-native/` |
| `src/pages/*/index.tsx` + `.scss` | `pages/*/index.js` + `.wxml` + `.wxss` |
| `src/components/X/index.tsx` + `.scss` | `components/X/X.js` + `.wxml` + `.wxss` |
| `src/utils/*.ts` | `utils/*.js` |
| `src/constants/*.ts` | `constants/*.js` |
| React `useState` | `this.setData()` |
| React `useEffect` | `lifetimes.attached()` |
| React `onClick` | WXML `bind:tap` |
| `className` + BEM | `class` |
| SCSS `@use` + nesting | Flat WXSS (manual flatten) |
| `Taro.request` | `wx.request` |
| `Taro.getStorageSync` | `wx.getStorageSync` |
| `Taro.navigateTo / switchTab` | `wx.navigateTo / wx.switchTab` |

## 文件清单

### Utils (3 文件)
- `utils/api.js` — wx.request 封装 (token/refresh/baseURL)
- `utils/storage.js` — 本地记录 CRUD
- `utils/sync.js` — 自动同步 + 立即同步

### Constants (2 文件)
- `constants/modules.js` — HEALTH_MODULE_KEYS/META/LABELS
- `constants/storage-keys.js` — 存储键名常量

### Components (11 组件)
- `tab-bar/` — 4 Tab 底部导航
- `top-bar/` — 首页头像+名称+积分
- `calendar/` — 月历+活动点
- `checklist-card/` — 首页计划清单卡片
- `form-shell/` — 记录表单框架
- `mini-trend/` — 7天趋势 Canvas 折线图
- `number-input/` — 自定义数字键盘
- `segment-picker/` — 分段选择器
- `submit-button/` — 提交按钮
- `credit-icon/` — 积分图标
- `credit-animation/` — 积分浮动动画

### Pages (28 页面)
- `index/` — 首页 (Tab)
- `health/` — 健康 (Tab)
- `messages/` — 告警中心 (Tab)
- `profile/` — 我的 (Tab)
- `login/` — 微信登录
- `alerts/` — 告警列表
- `data/` — 健康数据查看
- `settings/` — 系统设置
- `settings/goals/` — 健康目标
- `settings/tracking/` — 记录项目设置
- `export/` — 导出数据
- `pin-overview/` — 设备连接
- `plan/` — 健康计划
- `plan/detail/` — 提醒设置
- `credit/` — 积分明细
- `records/` — 记录历史
- `record/glucose/` — 血糖记录
- `record/pressure/` — 血压记录
- `record/weight/` — 体重记录
- `record/heart-rate/` — 心率记录
- `record/temperature/` — 体温记录
- `record/spo2/` — 血氧记录
- `record/medication/` — 用药记录
- `record/period/` — 生理期记录
- `form/` — 量表填写
- `form-list/` — 量表列表
- `patient-select/` — 患者选择
- `devices/` — 设备管理

---

## 执行阶段

### Phase 1: 基础层 (utils + constants)
- api.js, storage.js, sync.js
- modules.js, storage-keys.js
- app.js, app.json, app.wxss

### Phase 2: 组件层 (11 components)
- 全部组件转为原生 format

### Phase 3: 页面层 (28 pages)
- Tab 页优先 (4 pages)
- 记录页 (8 pages)
- 其余页 (16 pages)

### Phase 4: 验证
- 全功能回归测试
- 与原 Taro 版对比确认无功能损失

---

## 关键转换规则

### SCSS → WXSS
```
SCSS nesting:         &__item { color: red; }       →  .block__item { color: red; }
SCSS @use:            @use './theme'                 →  REMOVE (变量直接用字面量或 @import)
SCSS variables:       var(--brand-500)               →  保留 (WXSS 支持 CSS 变量)
SCSS &:active:        &:active { ... }               →  .class:active { ... }
```

### React Hooks → Page 生命周期
```
useState(init)         →  data: { v: init }  +  this.setData({ v: newVal })
useEffect(fn, [])      →  onLoad() { fn() }
useEffect(fn, [dep])   →  observers: { 'dep'(val) { fn() } }
useMemo(fn, deps)      →  直接在 data 中计算
```

### Taro API → wx API
```
Taro.request({url,method,data,header})  →  wx.request({url,method,data,header})
Taro.getStorageSync(k)                  →  wx.getStorageSync(k)
Taro.setStorageSync(k, v)              →  wx.setStorageSync(k, v)
Taro.removeStorageSync(k)             →  wx.removeStorageSync(k)
Taro.navigateTo({ url })              →  wx.navigateTo({ url })
Taro.switchTab({ url })              →  wx.switchTab({ url })
Taro.redirectTo({ url })            →  wx.redirectTo({ url })
Taro.reLaunch({ url })              →  wx.reLaunch({ url })
Taro.navigateBack()                →  wx.navigateBack()
Taro.showToast({ title, icon })   →  wx.showToast({ title, icon })
Taro.showModal({ title, content } )  →  wx.showModal({ title, content })
Taro.vibrateShort()                 →  wx.vibrateShort()
Taro.login()                        →  wx.login()
Taro.setClipboardData({ data })    →  wx.setClipboardData({ data })
Taro.getSystemInfoSync()           →  wx.getSystemInfoSync()
Taro.createSelectorQuery()          →  wx.createSelectorQuery()
```

### 全局数据共享
```
React Context / props drilling        →  app.globalData 或 getApp().globalData
Example:                                getApp().globalData.token
```
