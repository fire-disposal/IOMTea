# Flutter UX Refactor: Dashboard-First + MQTT Decoupling

## Summary

Refactor the Flutter app to decouple PIN verification from the dashboard gate and MQTT data transmission. Add `flutter_animate` for polished animation. Review and optimize all page UIs.

## 1. Architecture Changes

### 1.1 MQTT Decoupled from PIN

- MQTT connection is controlled solely by broker config in SettingsPage (broker, port, credentials)
- PIN is only a server-side verification credential, not a prerequisite for MQTT publishing
- EventEmitter always publishes when MQTT is connected
- When PIN is set: MQTT topic uses PIN for device identification
- When PIN is not set: MQTT topic uses a device UUID (generated on first launch, persisted)

### 1.2 Dashboard-First Navigation

- `/home` always renders the dashboard (3 mode cards) — no PIN gate
- PIN setup is a separate route `/pin-setup`
- Users can access all pages without PIN
- Features that require PIN (event simulation) show inline guidance instead of blocking

### 1.3 Dependency Addition

- Add `flutter_animate: ^4.5.2` for declarative animations

## 2. Route Changes

| Route | Page | Change |
|---|---|---|
| `/home` | HomePage | Removed PIN gate; added PIN setup banner |
| `/pin-setup` | PinSetupPage | **New** — extracted PIN input/verify flow |
| `/wearable` | WearablePage | Unchanged route; UI optimization |
| `/fixed-device` | CameraViewPage | Unchanged route; UI optimization |
| `/settings` | SettingsPage | Reorganized layout |
| `/debug` | DebugSimulatorPage | PIN-aware guard; fix `/mqtt` route reference |

## 3. Page-by-Page Changes

### 3.1 HomePage

- Remove `_PinScreenState` state machine entirely
- Always render dashboard: AppBar + GridView of 3 mode cards
- Conditional PIN setup banner:
  - Shown when PIN is not set
  - Dismissible per session (reappears on next launch)
  - Links to `/pin-setup`
  - Auto-hides once PIN is set
- Event Simulator card: enabled only when PIN is set (greyed out otherwise)
- Card entry animations: staggered fade-in + scale using `flutter_animate`

### 3.2 PinSetupPage (New)

- Extracted from HomePage's `_buildPinScreen()` and `_buildKeypad()` and `_buildSuccessScreen()`
- Same visual: lock icon, "设备验证" title, 6-dot indicator, numeric keypad, verify button
- Same success animation: check icon + "验证成功" text
- On successful verification: `context.pop()` returns to home
- Retains the "测试" skip for development

### 3.3 SettingsPage

- Reorder sections:
  1. PIN status card (top, gradient, prominent)
  2. Server URL
  3. MQTT broker config
  4. MQTT test buttons
- PIN card shows current state: "已设置" (green) or "未设置" (orange with "去设置" link)
- Add save confirmation for MQTT config changes
- Input fields with real-time validation feedback

### 3.4 DebugSimulatorPage

- Top banner when PIN is not set: "未设置PIN码，事件将匿名上报" with link to `/pin-setup`
- Fix `/mqtt` navigation reference — change to `/settings` or add proper MQTT route
- Health metric cards: staggered entry animation
- Streaming indicator: pulse animation with `flutter_animate`

### 3.5 WearablePage

- IMU data display: value-jump animations for numbers
- Fall detection: full-screen red pulse overlay on detection
- Waveform: keep CustomPaint, optimize repaint bounds
- Dashboard area: staggered entry animation for stat cards

### 3.6 CameraViewPage

- Mode switching: replace dropdown with bottom sheet or horizontal chip selector
- VisionLogPanel: slide-up entry animation
- Mode change: crossfade transition between modes

### 3.7 CameraSettingsPage

- Ground direction indicator: rotation animation
- Model download: progress indicator instead of plain button text
- Model status: animated checkmark on successful download

## 4. Global Improvements

- Page transitions: slide animation via `go_router` + `flutter_animate`
- Error handling: unified SnackBar for errors
- Empty/offline states: clear status text instead of blank areas
- Consistent spacing and typography across pages

## 5. Implementation Order

1. Add `flutter_animate` dependency
2. Create `PinSetupPage`, refactor `HomePage`
3. Decouple MQTT from PIN (EventEmitter)
4. Refactor `SettingsPage` layout
5. Optimize `DebugSimulatorPage`
6. Optimize `WearablePage`
7. Optimize `CameraViewPage` and `CameraSettingsPage`
8. Global polish: transitions, error handling, empty states

## 6. Risks

- Low risk: changes are scoped to UI layer, no backend dependencies
- PIN setup page extraction is a pure refactor with no behavior change
- MQTT decoupling is additive (adds UUID fallback, doesn't remove existing PIN behavior)
