# YOLO Vision System Rewrite — Design Spec

**Date**: 2026-05-20
**Status**: Approved
**Scope**: Flutter app (`apps/flutter/`) — replace Google ML Kit vision pipeline with `ultralytics_yolo`, refactor CV UI

---

## 1. Summary

Replace the Google ML Kit-based pose detection pipeline with the official `ultralytics_yolo` Flutter plugin. Introduce a plugin-based `VisionMode` architecture supporting hot-swappable CV modes (Pose/Fall Detection, Object Detection, and future modes). Refactor the CameraViewPage UI around dropdown mode switching, floating controls, and a compact log panel. IMU-based fall detection and wearable page remain untouched.

---

## 2. Current State

### 2.1 What exists (to be deleted)

| File | Role | Reason for removal |
|------|------|-------------------|
| `services/pose_estimator.dart` | ML Kit pose detection (17 landmarks, base model) | Replaced by `ultralytics_yolo` |
| `services/action_classifier.dart` | Heuristic geometric action classifier (stand/sit/lie/walk/fall) | Replaced by YOLO keypoint-based logic |
| `pages/camera_view_page.dart` | Camera + ML Kit skeleton overlay UI (382 lines) | Full rewrite |
| Dependencies: `google_mlkit_commons`, `google_mlkit_pose_detection` | ML Kit SDK | No longer needed |

### 2.2 What stays (untouched)

| File | Reason |
|------|--------|
| `services/fall_detector.dart` | IMU-based fall detection — independent mode |
| `services/imu_sensor_service.dart` | Accelerometer/gyroscope polling |
| `widgets/imu_waveform.dart` | IMU waveform visualization |
| `pages/wearable_page.dart` | Wearable device monitoring page |
| `pages/home_page.dart` | Home dashboard |
| `pages/settings_page.dart` | Settings |
| `pages/debug_simulator_page.dart` | Debug simulator |
| `theme.dart` | Matcha-green design system (preserved) |
| `widgets/terminal_log.dart` | Reused in new CameraViewPage |

### 2.3 New dependency

```yaml
# apps/flutter/pubspec.yaml — add:
dependencies:
  ultralytics_yolo: ^0.3.4

# remove:
# google_mlkit_commons: ^0.9.0
# google_mlkit_pose_detection: ^0.13.0
```

---

## 3. Architecture

### 3.1 File Structure

```
apps/flutter/lib/
├── services/
│   ├── vision/
│   │   ├── vision_mode.dart              # Abstract interface
│   │   ├── vision_mode_registry.dart      # Mode registration & discovery
│   │   ├── vision_mode_manager.dart       # Lifecycle: init, switch, dispose
│   │   ├── modes/
│   │   │   ├── pose_mode.dart             # Mode A: Pose + Fall Detection
│   │   │   └── detect_mode.dart           # Mode B: Object Detection
│   │   └── painters/
│   │       ├── pose_painter.dart          # Skeleton + bbox overlay painter
│   │       └── detect_painter.dart        # Object bbox overlay painter
│   ├── fall_detector.dart                 # KEEP — IMU fall detection
│   ├── imu_sensor_service.dart            # KEEP
│   │   ... (other existing services)
├── pages/
│   ├── camera_view_page.dart              # REWRITE
│   ├── camera_settings_page.dart          # NEW — CV sub-settings (ground calibration, etc.)
│   │   ... (other existing pages)
├── widgets/
│   ├── vision_log_panel.dart              # NEW — log panel widget
│   ├── terminal_log.dart                  # KEEP
│   │   ...
```

### 3.2 Core Abstraction: `VisionMode`

```dart
abstract class VisionMode {
  String get id;                    // unique mode identifier
  String get label;                 // display name in dropdown
  String get modelId;               // YOLO model ID (e.g. 'yolo26n-pose')
  YOLOTask get task;                // YOLO task type (detect / pose)

  Future<void> onActivate(YOLOViewController controller);
  void onFrame(YOLOResult result);  // process single result frame
  CustomPainter get painter;        // overlay painter for this mode
  Stream<VisionLogEntry> get logStream;
  VisionStatus get currentStatus;   // status line data

  Future<void> onDeactivate();      // cleanup resources
}
```

Each mode encapsulates: **model**, **processing logic**, **painter**, **log output**, and **status data**.

### 3.3 VisionModeRegistry

Singleton that holds all registered modes. The CameraViewPage dropdown reads from this to populate options dynamically.

```dart
class VisionModeRegistry {
  static final List<VisionMode> _modes = [];

  static void register(VisionMode mode) {
    _modes.add(mode);
  }

  static List<VisionMode> get modes => List.unmodifiable(_modes);

  static VisionMode? byId(String id) => ...;
}
```

Registration happens at app startup (before CameraViewPage is shown). Adding a new mode is a single `register()` call — no UI changes needed.

### 3.4 VisionModeManager

Manages mode lifecycle during switching:

```
switchTo(newMode):
  1. currentMode.onDeactivate()       # unload model, clean up
  2. newMode.onActivate(controller)   # load model, start processing
  3. Emit new painter + log stream
```

On dispose: deactivate active mode, dispose controller, release camera.

---

## 4. Mode A: Pose + Fall Detection

### 4.1 Configuration

| Parameter | Value |
|-----------|-------|
| Model | `yolo26n-pose` |
| Task | `YOLOTask.pose` |
| API | `YOLOView` (real-time camera stream) |

### 4.2 Processing Pipeline

```
YOLOView.onResult(results)
  └→ PersonTracker.update(results)
       ├→ Assign IDs via IoU matching (hungarian algorithm, threshold 0.3)
       ├→ Fire enter/leave events → logStream
       └→ For each tracked person:
            ├→ PoseClassifier.classify(keypoints, groundDirection)
            │    └→ Returns: standing | sitting | lying | walking
            └→ FallDetectorVision.check(keypoints, groundDirection)
                 └→ Returns: bool (fallen), triggered on lying for >2s
```

### 4.3 Pose Classification (Keypoint Geometry)

Uses keypoint spatial relationships with **manual ground direction** (set via calibration):

- **standing**: hip→shoulder vector nearly parallel to ground normal (angle <20°), hips above knees
- **sitting**: hip→knee distance short, hip→shoulder still upright but lower height
- **lying**: shoulder→hip vector near perpendicular to ground normal (angle >60°)
- **walking**: ankle displacement between frames exceeds threshold
- **fallen**: `lying` state sustained for >2 seconds → triggers alert

Ground direction defaults to **y-down = ground** (upright portrait). No calibration is required for normal use. Optional adjustment available via sub-settings page (see Section 6.2).

### 4.4 Painter (PosePainter)

| Element | Style |
|---------|-------|
| Skeleton bones | Color gradient: cyan→blue→green→yellow→orange by body region |
| Person bbox | Green rounded rect + "Person 0.92" label |
| Fallen state | Red stroked rect (2px), "FALLEN!" banner |
| Keypoints | Small circles (r=5), opacity = confidence |

### 4.5 Log Output

```
[HH:MM:SS] Person #1 entered frame
[HH:MM:SS] Person #1 — standing (0.87)
[HH:MM:SS] Person #1 — walking (0.78)
[HH:MM:SS] Person #1 — sitting (0.91)
[HH:MM:SS] Person #1 — lying (0.83)
[HH:MM:SS] !! Person #1 — FALLEN! (0.95)
[HH:MM:SS] Person #1 left frame
```

### 4.6 Status Line

```
2P | standing 0.92 | FPS 28 | ⚠️ 1
```

---

## 5. Mode B: Object Detection

### 5.1 Configuration

| Parameter | Value |
|-----------|-------|
| Model | `yolo26n` |
| Task | `YOLOTask.detect` |
| API | `YOLOView` (real-time camera stream) |

### 5.2 Processing Pipeline

```
YOLOView.onResult(results)
  └→ ObjectTracker.update(results)
       ├→ Assign IDs via IoU matching
       ├→ Fire appear/disappear events → logStream
       └→ Maintain tracked objects list for painter
```

Note: `yolo26n` detects all COCO classes. Person detections from this model are shown alongside objects (chair, bed, table, couch, etc.). The mode does NOT do pose — that's Mode A's job.

### 5.3 Painter (DetectPainter)

| Element | Style |
|---------|-------|
| Bbox | Per-class color: person=green, chair=blue, bed=purple, table=orange, couch=yellow, others=gray |
| Label | `[class] [conf]` at top-left of bbox |
| Tracked ID | Consistent color mapping via hash of tracked ID |

### 5.4 Log Output

```
[HH:MM:SS] person appeared (0.95)
[HH:MM:SS] chair appeared (0.88)
[HH:MM:SS] bed appeared (0.91)
[HH:MM:SS] chair disappeared
[HH:MM:SS] table appeared (0.83)
```

### 5.5 Status Line

```
5 objects | person,chair,bed | FPS 30
```

---

## 6. Camera Handling

### 6.1 Video Stream Stretch Prevention

Camera frames must maintain aspect ratio without distortion:

```dart
LayoutBuilder(
  builder: (ctx, constraints) {
    final previewSize = controller!.value.previewSize;
    final ar = previewSize!.height / previewSize.width;
    return ClipRect(
      child: FittedBox(
        fit: BoxFit.cover,
        child: SizedBox(
          width: previewSize.width,
          height: previewSize.height,
          child: CameraPreview(controller!),
        ),
      ),
    );
  },
);
```

**Critical**: The overlay `CustomPainter` must receive the same transform parameters as `FittedBox` so skeleton/bbox coordinates map correctly. Pass `scale` and `offset` derived from `FittedBox`'s layout to the painter via `VisionOverlay` widget.

### 6.2 Camera Orientation Calibration

**Default**: upright portrait, y-down = ground. No calibration required — works out of the box.

**Sub-settings page** (opened via ⚙️ in top bar):

| Option | Description |
|--------|-------------|
| Upright wall mount (default) | y-down = ground |
| Ceiling mount | y-up = ground |
| Tabletop/desk | z-axis = ground |
| Custom angle | Manual 0°–360° slider |
| **Auto (IMU)** | One-tap: reads IMU gravity vector via `ImuSensorService`, computes ground direction, saves to `SharedPreferences` |

Calibration data is stored to `SharedPreferences` and applied to `groundDirection` vector in pose classification. The auto-calibrate button performs a one-shot IMU read (not continuous polling) to avoid draining the sensor.

YOLOView receives standard `rotation` from camera sensor + device orientation (via `CameraController`) — this is independent of the manual ground direction.

### 6.3 Frame Processing

Camera stream is YUV on Android, BGRA on iOS. The `camera` package handles conversion to `CameraImage`. `YOLOView` internally handles the platform-specific format conversion.

Frame skipping (every Nth frame) to be configurable via mode settings — default every frame for Pose mode.

---

## 7. UI Design: CameraViewPage

### 7.1 Layout

```
┌─ Fullscreen Camera ────────────┐
│ ← [Pose/Fall ▾]   ■  ⚙️     │  ← Floating top bar (semi-transparent)
│                                │     ■ = stop/start inference toggle
│        VisionOverlay           │  ← CustomPaint, delegates to mode.painter
│        (skeleton / bboxes)     │
│                                │
│ ┌────────────────────────────┐ │
│ │ 2P standing 0.92 | FPS 28 │ │  ← Status line (fixed, high density)
│ │────────────────────────────│ │
│ │ [14:32] Person #1 entered │ │  ← Scrollable log (downward scroll)
│ │ [14:32] Person #1 stand.. │ │
│ │ [14:32] Person #1 walk..  │ │
└─┴────────────────────────────┴─┘
```

> **UI principle**: No explanatory text or tooltips. UI elements themselves convey their function (e.g., ■▶ toggle for inference state, dropdown label shows current mode).

### 7.2 Components

| Component | Description |
|-----------|-------------|
| **Top bar** | Semi-transparent black background. 4 elements: back ←, mode dropdown (from registry), inference toggle ■▶, settings ⚙️ |
| **Inference toggle** | ■ (stop) / ▶ (start). Pauses/resumes YOLO inference without destroying model. Placed between dropdown and settings |
| **Settings ⚙️** | Opens `CameraSettingsPage` (sub-page): ground direction calibration (manual + auto via IMU), other CV options |
| **Mode dropdown** | `DropdownButton<VisionMode>`, items from `VisionModeRegistry.modes`. Triggers `VisionModeManager.switchTo()` |
| **VisionOverlay** | `CustomPaint(painter: mode.painter)`. Painter receives correct scale/offset from `FittedBox` |
| **Status line** | `mode.currentStatus` — single line, monospace font, updated reactively |
| **Log panel** | `VisionLogPanel` widget — `StreamBuilder` on `mode.logStream`, capped at 200 entries, auto-scroll to bottom |

### 7.3 State Flow

```
CameraViewPage
  ├── CameraController (init → startImageStream)
  ├── YOLOViewController (from YOLOView)
  ├── VisionModeManager
  │     └── activeMode: VisionMode
  ├── isInferenceActive: bool (toggled by ■▶ button)
  └── setState on:
        - mode switch (new painter, new log stream)
        - inference toggle (pause/resume processing)
        - status line change (throttled, 200ms)
        - log entry (appended)
```

### 7.4 Mode Switching UX

- Dropdown opens → select mode → spinner shown while new model loads (via `onActivate`)
- Previous mode's `onDeactivate()` called first to release resources
- If model load fails, show error snackbar, remain on previous mode

### 7.5 Inference Toggle

- ■ button pauses YOLO inference (stops processing frames, model stays loaded)
- ▶ button resumes inference
- Camera preview continues regardless (toggle only affects YOLO processing)
- Useful for: debugging, saving battery, freezing a frame for inspection

---

## 8. Extensibility

### Adding a future mode (example: FaceMode)

```dart
// 1. Create mode class
class FaceMode extends VisionMode {
  @override String get id => 'face';
  @override String get label => 'Face Detection';
  @override String get modelId => 'yolo26n-face';
  @override YOLOTask get task => YOLOTask.detect;
  // ... implement onActivate, onFrame, painter, logStream, onDeactivate
}

// 2. Register at app startup
VisionModeRegistry.register(FaceMode());

// 3. Done — automatically appears in dropdown, zero UI changes
```

---

## 9. Dependencies

### pubspec.yaml changes

```diff
 dependencies:
+  ultralytics_yolo: ^0.3.4
-  google_mlkit_commons: ^0.9.0
-  google_mlkit_pose_detection: ^0.13.0
   # camera, mqtt_client, sensors_plus, go_router, etc. — unchanged
```

### AndroidManifest.xml

No changes needed. `CAMERA` permission already declared. `ultralytics_yolo` handles its own native dependencies.

### iOS Info.plist

`NSCameraUsageDescription` already exists. No changes needed.

---

## 10. Risk Assessment

| Risk | Mitigation |
|------|-----------|
| `ultralytics_yolo` may not support concurrent model instances | Use single `YOLOView` + `switchModel()`; design mode manager to handle this |
| YOLO Pose keypoint layout differs from ML Kit (COCO 17 vs ML Kit 33) | Rewrite pose classifier around COCO 17; note fewer keypoints but still sufficient for fall detection |
| Camera orientation + ground direction miscalibration causes false falls | Default to upright wall mount; make calibration accessible from settings ⚙️; log calibration state |
| `FittedBox` + `CustomPainter` coordinate mismatch | Verify with test: draw grid overlay in debug mode to confirm alignment |
