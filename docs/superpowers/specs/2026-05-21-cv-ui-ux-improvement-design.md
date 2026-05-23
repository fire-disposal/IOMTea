# CV Page UI/UX Improvement — Design Spec

**Date**: 2026-05-21
**Status**: Approved
**Scope**: Flutter app (`apps/flutter/`) — fix camera stretching, add model management, simplify ground direction, align layout

---

## 1. Summary

Five improvements to the fixed-device camera view page (CameraViewPage) and its settings:

1. Fix camera image stretching by removing redundant CameraController/CameraPreview, letting YOLOView render exclusively
2. Add YOLO model management section to CameraSettingsPage
3. Replace custom angle slider with 4-direction arrow selector
4. Add ground direction indicator to camera view
5. Align and polish camera view layout (top bar, log panel spacing)

---

## 2. Camera Stretch Fix

### Problem
`CameraViewPage` creates a `CameraController` + `CameraPreview` AND renders `YOLOView` in the same Stack. YOLOView manages its own camera internally, so CameraPreview is always hidden. YOLOView's internal loading state shows a black background that can cause layout compression.

### Solution
- Remove `CameraController`, `_cam`, `availableCameras()` init, and `CameraPreview` widget
- YOLOView becomes the sole camera renderer
- Call `controller.setShowOverlays(false)` and `controller.setShowUIControls(false)` post-mount
- Painters use model input size 640x640 for coordinate transforms instead of camera previewSize
- Keep CustomPaint overlay on top of YOLOView

### Files changed
- `lib/pages/camera_view_page.dart` — major refactor
- `lib/services/vision/painters/detect_painter.dart` — update transform
- `lib/services/vision/painters/pose_painter.dart` — update transform

---

## 3. Model Management in Settings

### New section in CameraSettingsPage
For each registered `VisionMode`, display:
- Mode label, model ID, task type
- Cache status: check via `YOLO.checkModelExists(modelId)`
- Metadata: model input size, classes (via `YOLO.inspectModel(modelId)`)
- Download button if not cached (creates temp `YOLO` instance, calls `loadModel()`, disposes)

### Files changed
- `lib/pages/camera_settings_page.dart` — add section

---

## 4. Ground Direction Arrow Selector

### Settings page
- Replace `Slider(-180, 180)` for custom angle with 4-direction arrow component
- ↑ = 0°, ↓ = 180°, ← = 270°(-90°), → = 90°
- Tap direction to select; visual feedback on active direction
- Keep 4 preset RadioListTile items (Upright, Ceiling, Tabletop x2)
- Keep IMU auto-calibrate button

### CV page indicator
- Small semi-transparent arrow widget in bottom-right of camera view
- Reflects current ground direction from SharedPreferences
- Tap to navigate to CameraSettingsPage
- Sync on return from settings via Future/pop result

### Files changed
- `lib/pages/camera_settings_page.dart` — replace slider with arrow selector
- `lib/pages/camera_view_page.dart` — add indicator widget
- New widget: `lib/widgets/ground_direction_indicator.dart`

---

## 5. Camera View Layout Alignment

### Changes
- Top bar: replace ad-hoc GestureDetector + Container combos with uniform Chips
- Back, dropdown, toggle, settings — all same height, padding, border-radius
- Log panel: split into fixed status bar + scrollable log list with maxHeight 200, adaptive shrink
- Consistent spacing: 8dp gaps throughout

### Layout
```
┌─ CV page ──────────────────────────┐
│  ←  [ Pose/Fall ▾ ]   ▶/■   ⚙️   │  top bar (chips)
│                                     │
│         YOLOView + CustomPaint       │
│                                     │
│                              ↗      │  ground direction indicator
│ ┌─────────────────────────────┐     │
│ │ ● status bar (fixed)         │     │
│ │ ─────────────────────────── │     │
│ │  log entries (scrollable)    │     │
│ └─────────────────────────────┘     │
└─────────────────────────────────────┘
```

### Files changed
- `lib/pages/camera_view_page.dart` — layout refactor
- `lib/widgets/vision_log_panel.dart` — split status + log, adaptive height
