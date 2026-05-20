# YOLO Vision System Rewrite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Google ML Kit CV pipeline with `ultralytics_yolo` plugin-based VisionMode architecture (Pose+Fall / Object Detection modes), rewrite CameraViewPage UI.

**Architecture:** Abstract `VisionMode` interface with `PoseMode`/`DetectMode` implementations, `VisionModeRegistry` for dynamic mode discovery, `VisionModeManager` for lifecycle. CameraViewPage uses dropdown mode switching, floating overlay controls, status line + scrollable log panel.

**Tech Stack:** Flutter 3.27, ultralytics_yolo ^0.3.4, camera ^0.12.0, sensors_plus ^6.1.0, shared_preferences ^2.3.0, go_router ^14.0.0

**Spec:** `docs/superpowers/specs/2026-05-20-yolo-vision-rewrite-design.md`

---

### Task 1: Cleanup — Delete old CV code and update dependencies

**Files:**
- Delete: `apps/flutter/lib/services/pose_estimator.dart`
- Delete: `apps/flutter/lib/services/action_classifier.dart`
- Delete: `apps/flutter/lib/pages/camera_view_page.dart`
- Modify: `apps/flutter/pubspec.yaml`

- [ ] **Step 1: Delete old CV source files**

```bash
rm apps/flutter/lib/services/pose_estimator.dart
rm apps/flutter/lib/services/action_classifier.dart
rm apps/flutter/lib/pages/camera_view_page.dart
```

- [ ] **Step 2: Update pubspec.yaml — remove ML Kit deps, add ultralytics_yolo**

Replace the existing dependencies block (lines 28-30) so the file becomes:

```yaml
name: iomtea_tools
description: IOMTea Flutter 实验工具 — MQTT/YOLO/IMU/BLE 调试面板
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: ^3.6.0
  flutter: '>=3.27.0'

dependencies:
  flutter:
    sdk: flutter

  # MQTT
  mqtt_client: ^10.0.0

  # 传感器
  sensors_plus: ^6.1.0

  # 路由
  go_router: ^14.0.0

  # HTTP
  http: ^1.2.0

  # 存储
  shared_preferences: ^2.3.0

  # YOLO
  ultralytics_yolo: ^0.3.4

  # 相机
  camera: ^0.12.0+1

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^5.0.0

flutter:
  uses-material-design: true
```

- [ ] **Step 3: Run flutter pub get and verify dependencies resolve**

```bash
cd apps/flutter && flutter pub get
```
Expected: exits 0, no errors about missing packages.

- [ ] **Step 4: Commit cleanup**

```bash
git add apps/flutter/lib/services/pose_estimator.dart apps/flutter/lib/services/action_classifier.dart apps/flutter/lib/pages/camera_view_page.dart apps/flutter/pubspec.yaml
git commit -m "chore: remove old ML Kit CV code, add ultralytics_yolo dependency"
```

---

### Task 2: Create VisionMode core infrastructure

**Files:**
- Create: `apps/flutter/lib/services/vision/vision_mode.dart`
- Create: `apps/flutter/lib/services/vision/vision_mode_registry.dart`
- Create: `apps/flutter/lib/services/vision/vision_mode_manager.dart`

- [ ] **Step 1: Create services/vision directory**

```bash
mkdir -p apps/flutter/lib/services/vision/modes apps/flutter/lib/services/vision/painters
```

- [ ] **Step 2: Write vision_mode.dart — abstract interface**

```dart
import 'package:flutter/material.dart';
import 'package:ultralytics_yolo/ultralytics_yolo.dart';

class VisionLogEntry {
  final DateTime time;
  final String message;
  final bool isAlert;

  const VisionLogEntry({
    required this.time,
    required this.message,
    this.isAlert = false,
  });

  String get formattedTime {
    final h = time.hour.toString().padLeft(2, '0');
    final m = time.minute.toString().padLeft(2, '0');
    final s = time.second.toString().padLeft(2, '0');
    return '$h:$m:$s';
  }
}

class VisionStatus {
  final String text;

  const VisionStatus(this.text);

  static const empty = VisionStatus('');
}

abstract class VisionMode {
  String get id;
  String get label;
  String get modelId;
  YOLOTask get task;

  Future<void> onActivate(YOLOViewController controller);
  void onFrame(YOLOResult result);
  CustomPainter get painter;
  Stream<VisionLogEntry> get logStream;
  VisionStatus get currentStatus;
  Future<void> onDeactivate();
}
```

- [ ] **Step 3: Write vision_mode_registry.dart**

```dart
import 'vision_mode.dart';

class VisionModeRegistry {
  static final List<VisionMode> _modes = [];

  static void register(VisionMode mode) {
    _modes.add(mode);
  }

  static List<VisionMode> get modes => List.unmodifiable(_modes);

  static VisionMode? byId(String id) {
    try {
      return _modes.firstWhere((m) => m.id == id);
    } catch (_) {
      return null;
    }
  }
}
```

- [ ] **Step 4: Write vision_mode_manager.dart**

```dart
import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:ultralytics_yolo/ultralytics_yolo.dart';
import 'vision_mode.dart';

class VisionModeManager extends ChangeNotifier {
  VisionMode? _active;
  YOLOViewController? _controller;
  StreamSubscription<VisionLogEntry>? _logSub;
  bool _inferenceActive = true;

  final StreamController<List<VisionLogEntry>> _logController =
      StreamController<List<VisionLogEntry>>.broadcast();
  final List<VisionLogEntry> _logEntries = [];
  static const _maxLogEntries = 200;

  VisionMode? get active => _active;
  bool get inferenceActive => _inferenceActive;
  CustomPainter get painter => _active?.painter ?? _EmptyPainter();
  VisionStatus get status => _active?.currentStatus ?? VisionStatus.empty;
  Stream<List<VisionLogEntry>> get logEntries => _logController.stream;

  void setController(YOLOViewController controller) {
    _controller = controller;
  }

  Future<void> switchTo(VisionMode mode) async {
    if (_active?.id == mode.id) return;
    await _active?.onDeactivate();
    _logSub?.cancel();
    _active = mode;
    _logEntries.clear();
    _logController.add(List.unmodifiable(_logEntries));
    if (_controller != null) {
      await _controller!.switchModel(mode.modelId, mode.task);
      await mode.onActivate(_controller!);
    }
    _logSub = mode.logStream.listen(_onLogEntry);
    notifyListeners();
  }

  void toggleInference() {
    _inferenceActive = !_inferenceActive;
    notifyListeners();
  }

  void processResult(YOLOResult result) {
    if (!_inferenceActive || _active == null) return;
    _active!.onFrame(result);
    notifyListeners();
  }

  void _onLogEntry(VisionLogEntry entry) {
    _logEntries.add(entry);
    if (_logEntries.length > _maxLogEntries) {
      _logEntries.removeAt(0);
    }
    _logController.add(List.unmodifiable(_logEntries));
  }

  void clearLogs() {
    _logEntries.clear();
    _logController.add([]);
  }

  @override
  void dispose() {
    _active?.onDeactivate();
    _logSub?.cancel();
    _logController.close();
    super.dispose();
  }
}

class _EmptyPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {}

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
```

- [ ] **Step 5: Commit core infrastructure**

```bash
git add apps/flutter/lib/services/vision/
git commit -m "feat: add VisionMode core infrastructure (interface, registry, manager)"
```

---

### Task 3: Create Mode A — PoseMode + PersonTracker + PoseClassifier + PosePainter

**Files:**
- Create: `apps/flutter/lib/services/vision/modes/pose_mode.dart`
- Create: `apps/flutter/lib/services/vision/painters/pose_painter.dart`

- [ ] **Step 1: Write pose_mode.dart**

```dart
import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:ultralytics_yolo/ultralytics_yolo.dart';
import '../vision_mode.dart';
import '../painters/pose_painter.dart';

class _Person {
  final int id;
  YOLOResult lastResult;
  String state;
  int fallenFrames;
  int leftFrames;

  _Person({
    required this.id,
    required this.lastResult,
    this.state = 'unknown',
    this.fallenFrames = 0,
    this.leftFrames = 0,
  });

  PosePaintData toPaintData() => PosePaintData(
    keypoints: lastResult.keypoints ?? [],
    bbox: lastResult.bbox,
    confidence: lastResult.confidence,
    state: state,
    isFallen: state == 'fallen',
  );
}

class PoseMode extends VisionMode {
  @override
  String get id => 'pose';

  @override
  String get label => 'Pose/Fall';

  @override
  String get modelId => 'yolo26n-pose';

  @override
  YOLOTask get task => YOLOTask.pose;

  final _painter = PosePainter();
  final _logController = StreamController<VisionLogEntry>.broadcast();
  final _statusController = StreamController<VisionStatus>.broadcast();

  final List<_Person> _tracked = [];
  int _nextId = 1;
  static const _iouThreshold = 0.3;
  static const _maxLeftFrames = 10;
  static const _fallenConfirmFrames = 6;

  @override
  CustomPainter get painter => _painter;

  @override
  Stream<VisionLogEntry> get logStream => _logController.stream;

  @override
  VisionStatus get currentStatus {
    if (_tracked.isEmpty) return const VisionStatus('0P | FPS --');
    final parts = <String>[];
    parts.add('${_tracked.length}P');
    for (final p in _tracked) {
      parts.add('${p.state} ${p.lastResult.confidence.toStringAsFixed(2)}');
    }
    final fallen = _tracked.where((p) => p.state == 'fallen').length;
    if (fallen > 0) parts.add('\u26A0 $fallen');
    return VisionStatus(parts.join(' | '));
  }

  @override
  Future<void> onActivate(YOLOViewController controller) async {}

  @override
  void onFrame(YOLOResult result) {
    _matchOrCreate(result);
    _updateStates();
    _painter.update(_tracked.map((p) => p.toPaintData()).toList());
  }

  void _matchOrCreate(YOLOResult result) {
    if (result.className != 'person') return;

    double bestIoU = 0;
    _Person? best;

    for (final t in _tracked) {
      final iou = _computeIoU(result, t.lastResult);
      if (iou > bestIoU && iou > _iouThreshold) {
        bestIoU = iou;
        best = t;
      }
    }

    if (best != null) {
      best.lastResult = result;
      best.leftFrames = 0;
    } else {
      final person = _Person(id: _nextId++, lastResult: result);
      _tracked.add(person);
      _logController.add(VisionLogEntry(
        time: DateTime.now(),
        message: 'Person #${person.id} entered frame',
      ));
    }
  }

  void _updateStates() {
    final toRemove = <_Person>[];

    for (final person in _tracked) {
      final newState = _classifyPose(person.lastResult);

      if (newState != person.state) {
        person.state = newState;
        final isAlert = newState == 'fallen';
        _logController.add(VisionLogEntry(
          time: DateTime.now(),
          message: 'Person #${person.id} — $newState (${person.lastResult.confidence.toStringAsFixed(2)})',
          isAlert: isAlert,
        ));
      }

      if (!_isPersonVisible(person.lastResult)) {
        person.leftFrames++;
        if (person.leftFrames >= _maxLeftFrames) {
          toRemove.add(person);
        }
      } else {
        person.leftFrames = 0;
      }

      if (newState == 'lying') {
        person.fallenFrames++;
      } else {
        person.fallenFrames = 0;
      }
    }

    for (final p in toRemove) {
      _tracked.remove(p);
      _logController.add(VisionLogEntry(
        time: DateTime.now(),
        message: 'Person #${p.id} left frame',
      ));
    }
  }

  String _classifyPose(YOLOResult result) {
    final kp = result.keypoints;
    if (kp == null || kp.length < 11) return 'unknown';

    final lShoulder = kp[5];
    final rShoulder = kp[6];
    final lHip = kp[11];
    final rHip = kp[12];

    if (lShoulder.confidence < 0.3 || rShoulder.confidence < 0.3 ||
        lHip.confidence < 0.3 || rHip.confidence < 0.3) {
      return 'unknown';
    }

    final shoulderY = (lShoulder.y + rShoulder.y) / 2;
    final hipY = (lHip.y + rHip.y) / 2;
    final torsoDy = (hipY - shoulderY).abs();
    final torsoDx = ((lHip.x + rHip.x) / 2 - (lShoulder.x + rShoulder.x) / 2).abs();

    if (torsoDy < 0.01) return 'unknown';

    final torsoAngle = (torsoDx / torsoDy).clamp(0.0, 1.0);

    if (torsoAngle > 0.7) return 'lying';
    if (torsoDy < 0.08) return 'sitting';
    if (shoulderY < hipY) return 'standing';

    return 'walking';
  }

  bool _isPersonVisible(YOLOResult result) {
    final kp = result.keypoints;
    if (kp == null) return false;
    return kp.where((k) => k.confidence > 0.3).length >= 4;
  }

  double _computeIoU(YOLOResult a, YOLOResult b) {
    final ax1 = a.bbox.left, ay1 = a.bbox.top;
    final ax2 = a.bbox.right, ay2 = a.bbox.bottom;
    final bx1 = b.bbox.left, by1 = b.bbox.top;
    final bx2 = b.bbox.right, by2 = b.bbox.bottom;

    final ix1 = math.max(ax1, bx1), iy1 = math.max(ay1, by1);
    final ix2 = math.min(ax2, bx2), iy2 = math.min(ay2, by2);
    if (ix2 <= ix1 || iy2 <= iy1) return 0;

    final iArea = (ix2 - ix1) * (iy2 - iy1);
    final aArea = (ax2 - ax1) * (ay2 - ay1);
    final bArea = (bx2 - bx1) * (by2 - by1);
    final uArea = aArea + bArea - iArea;
    return uArea > 0 ? iArea / uArea : 0;
  }

  @override
  Future<void> onDeactivate() async {
    _tracked.clear();
    _nextId = 1;
    _painter.clear();
  }
}
```

- [ ] **Step 2: Write pose_painter.dart**

```dart
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:ultralytics_yolo/ultralytics_yolo.dart';

class PosePaintData {
  final List<YOLOKeypoint> keypoints;
  final Rect bbox;
  final double confidence;
  final String state;
  final bool isFallen;

  const PosePaintData({
    required this.keypoints,
    required this.bbox,
    required this.confidence,
    required this.state,
    this.isFallen = false,
  });
}

class PosePainter extends CustomPainter {
  List<PosePaintData> _persons = [];
  double _scaleX = 1, _scaleY = 1, _offsetX = 0, _offsetY = 0;

  void update(List<PosePaintData> persons) {
    _persons = persons;
  }

  void setTransform(double scaleX, double scaleY, double offsetX, double offsetY) {
    _scaleX = scaleX;
    _scaleY = scaleY;
    _offsetX = offsetX;
    _offsetY = offsetY;
  }

  void clear() {
    _persons = [];
  }

  Offset _toScreen(double x, double y) {
    return Offset(x * _scaleX + _offsetX, y * _scaleY + _offsetY);
  }

  @override
  void paint(Canvas canvas, Size size) {
    for (final person in _persons) {
      final kp = person.keypoints;
      if (kp.isEmpty) continue;

      final pts = <int, Offset>{};
      double x1 = double.infinity, y1 = double.infinity, x2 = 0, y2 = 0;
      int vc = 0;

      for (int i = 0; i < kp.length && i < 17; i++) {
        if (kp[i].confidence < 0.3) continue;
        final dx = kp[i].x, dy = kp[i].y;
        final pt = _toScreen(dx, dy);
        pts[i] = pt;
        if (pt.dx < x1) x1 = pt.dx;
        if (pt.dy < y1) y1 = pt.dy;
        if (pt.dx > x2) x2 = pt.dx;
        if (pt.dy > y2) y2 = pt.dy;
        vc++;
      }

      _drawSkeleton(canvas, pts);

      final dp = Paint()..style = PaintingStyle.fill..color = const Color(0xFF00E676);
      final db = Paint()..style = PaintingStyle.stroke..strokeWidth = 1..color = Colors.white70;
      for (final p in pts.values) {
        canvas.drawCircle(p, 3.5, db);
        canvas.drawCircle(p, 2.5, dp);
      }

      if (vc >= 4) {
        _drawBBox(canvas, size, x1, y1, x2, y2, person.isFallen, person.confidence);
      }
    }
  }

  static const _bones = [
    [5, 7], [7, 9], [6, 8], [8, 10], [5, 6],
    [5, 11], [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  ];

  static const _boneColors = [
    Colors.cyan, Colors.blue, Colors.cyan, Colors.blue,
    Colors.green, Colors.yellow, Colors.yellow, Colors.green,
    Colors.yellow, Colors.orange, Colors.yellow, Colors.orange,
  ];

  void _drawSkeleton(Canvas canvas, Map<int, Offset> pts) {
    for (int i = 0; i < _bones.length; i++) {
      final a = pts[_bones[i][0]], b = pts[_bones[i][1]];
      if (a == null || b == null) continue;
      final color = _boneColors[i];
      final glow = Paint()..style = PaintingStyle.stroke..strokeWidth = 5..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3)..color = color.withValues(alpha: 0.3);
      final line = Paint()..style = PaintingStyle.stroke..strokeWidth = 2..color = color.withValues(alpha: 0.8);
      canvas.drawLine(a, b, glow);
      canvas.drawLine(a, b, line);
    }
  }

  void _drawBBox(Canvas canvas, Size size, double x1, double y1, double x2, double y2, bool fallen, double confidence) {
    final px = (x2 - x1) * 0.06;
    final py = (y2 - y1) * 0.06;
    x1 = (x1 - px).clamp(0, size.width);
    y1 = (y1 - py).clamp(0, size.height);
    x2 = (x2 + px).clamp(0, size.width);
    y2 = (y2 + py).clamp(0, size.height);
    final arm = math.min(math.min((x2 - x1) * 0.35, (y2 - y1) * 0.35), 50.0);

    final color = fallen ? Colors.red : const Color(0xFF00E676);

    final gl = Paint()..color = color.withValues(alpha: 0.5)..strokeWidth = fallen ? 4 : 3..style = PaintingStyle.stroke..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6);
    final ln = Paint()..color = color..strokeWidth = fallen ? 3 : 2..style = PaintingStyle.stroke;

    canvas.drawLine(Offset(x1, y1), Offset(x1 + arm, y1), gl);
    canvas.drawLine(Offset(x1, y1), Offset(x1 + arm, y1), ln);
    canvas.drawLine(Offset(x1, y1), Offset(x1, y1 + arm), gl);
    canvas.drawLine(Offset(x1, y1), Offset(x1, y1 + arm), ln);

    final label = fallen ? 'FALLEN!' : 'Person ${confidence.toStringAsFixed(2)}';
    final tp = TextPainter(
      text: TextSpan(text: label, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700)),
      textDirection: TextDirection.ltr,
    )..layout();
    final bg = Paint()..color = Colors.black54;
    canvas.drawRect(Rect.fromLTWH(x1 + arm + 2, y1, tp.width + 6, tp.height + 2), bg);
    tp.paint(canvas, Offset(x1 + arm + 4, y1));
  }

  @override
  bool shouldRepaint(covariant PosePainter oldDelegate) => true;
}
```

- [ ] **Step 3: Commit Mode A**

```bash
git add apps/flutter/lib/services/vision/modes/pose_mode.dart apps/flutter/lib/services/vision/painters/pose_painter.dart
git commit -m "feat: add PoseMode with person tracking, pose classification, and skeleton painter"
```

---

### Task 4: Create Mode B — DetectMode + DetectPainter

**Files:**
- Create: `apps/flutter/lib/services/vision/modes/detect_mode.dart`
- Create: `apps/flutter/lib/services/vision/painters/detect_painter.dart`

- [ ] **Step 1: Write detect_mode.dart**

```dart
import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:ultralytics_yolo/ultralytics_yolo.dart';
import '../vision_mode.dart';
import '../painters/detect_painter.dart';

class _Obj {
  final int id;
  final String className;
  YOLOResult lastResult;
  int leftFrames;

  _Obj({
    required this.id,
    required this.className,
    required this.lastResult,
    this.leftFrames = 0,
  });

  DetectPaintData toPaintData() => DetectPaintData(
    bbox: lastResult.bbox,
    className: className,
    confidence: lastResult.confidence,
  );
}

class DetectMode extends VisionMode {
  @override
  String get id => 'detect';

  @override
  String get label => 'Detection';

  @override
  String get modelId => 'yolo26n';

  @override
  YOLOTask get task => YOLOTask.detect;

  final _painter = DetectPainter();
  final _logController = StreamController<VisionLogEntry>.broadcast();

  final List<_Obj> _objects = [];
  int _nextId = 1;
  static const _iouThreshold = 0.3;
  static const _maxLeftFrames = 5;

  @override
  CustomPainter get painter => _painter;

  @override
  Stream<VisionLogEntry> get logStream => _logController.stream;

  @override
  VisionStatus get currentStatus {
    if (_objects.isEmpty) return const VisionStatus('0 objects');
    final names = _objects.map((o) => o.className).toSet().join(',');
    return VisionStatus('${_objects.length} objects | $names');
  }

  @override
  Future<void> onActivate(YOLOViewController controller) async {}

  @override
  void onFrame(YOLOResult result) {
    _matchOrCreate(result);
    _removeStale();
    _painter.update(_objects.map((o) => o.toPaintData()).toList());
  }

  void _matchOrCreate(YOLOResult result) {
    double bestIoU = 0;
    _Obj? best;

    for (final obj in _objects) {
      if (obj.className != result.className) continue;
      final iou = _computeIoU(result, obj.lastResult);
      if (iou > bestIoU && iou > _iouThreshold) {
        bestIoU = iou;
        best = obj;
      }
    }

    if (best != null) {
      best.lastResult = result;
      best.leftFrames = 0;
    } else {
      final obj = _Obj(id: _nextId++, className: result.className, lastResult: result);
      _objects.add(obj);
      _logController.add(VisionLogEntry(
        time: DateTime.now(),
        message: '${result.className} appeared (${result.confidence.toStringAsFixed(2)})',
      ));
    }
  }

  void _removeStale() {
    final toRemove = <int>[];
    for (int i = 0; i < _objects.length; i++) {
      _objects[i].leftFrames++;
      if (_objects[i].leftFrames >= _maxLeftFrames) {
        toRemove.add(i);
      }
    }

    for (final idx in toRemove.reversed) {
      final obj = _objects.removeAt(idx);
      _logController.add(VisionLogEntry(
        time: DateTime.now(),
        message: '${obj.className} disappeared',
      ));
    }
  }

  double _computeIoU(YOLOResult a, YOLOResult b) {
    final ax1 = a.bbox.left, ay1 = a.bbox.top;
    final ax2 = a.bbox.right, ay2 = a.bbox.bottom;
    final bx1 = b.bbox.left, by1 = b.bbox.top;
    final bx2 = b.bbox.right, by2 = b.bbox.bottom;

    final ix1 = math.max(ax1, bx1), iy1 = math.max(ay1, by1);
    final ix2 = math.min(ax2, bx2), iy2 = math.min(ay2, by2);
    if (ix2 <= ix1 || iy2 <= iy1) return 0;

    final iArea = (ix2 - ix1) * (iy2 - iy1);
    final aArea = (ax2 - ax1) * (ay2 - ay1);
    final bArea = (bx2 - bx1) * (by2 - by1);
    final uArea = aArea + bArea - iArea;
    return uArea > 0 ? iArea / uArea : 0;
  }

  @override
  Future<void> onDeactivate() async {
    _objects.clear();
    _nextId = 1;
    _painter.clear();
  }
}
```

- [ ] **Step 2: Write detect_painter.dart**

```dart
import 'package:flutter/material.dart';
import 'package:ultralytics_yolo/ultralytics_yolo.dart';

class DetectPaintData {
  final Rect bbox;
  final String className;
  final double confidence;

  const DetectPaintData({
    required this.bbox,
    required this.className,
    required this.confidence,
  });
}

const _classColors = <String, Color>{
  'person': Colors.green,
  'chair': Colors.blue,
  'couch': Colors.blue,
  'bed': Colors.purple,
  'dining table': Colors.orange,
  'table': Colors.orange,
  'tv': Colors.cyan,
  'laptop': Colors.yellow,
  'cell phone': Colors.yellow,
  'book': Colors.brown,
  'bottle': Colors.teal,
  'cup': Colors.teal,
};

Color _colorForClass(String name) => _classColors[name] ?? Colors.grey;

class DetectPainter extends CustomPainter {
  List<DetectPaintData> _objects = [];
  double _scaleX = 1, _scaleY = 1, _offsetX = 0, _offsetY = 0;

  void update(List<DetectPaintData> objects) {
    _objects = objects;
  }

  void setTransform(double scaleX, double scaleY, double offsetX, double offsetY) {
    _scaleX = scaleX;
    _scaleY = scaleY;
    _offsetX = offsetX;
    _offsetY = offsetY;
  }

  void clear() {
    _objects = [];
  }

  @override
  void paint(Canvas canvas, Size size) {
    for (final obj in _objects) {
      final color = _colorForClass(obj.className);
      final tl = _toScreen(obj.bbox.left, obj.bbox.top);
      final br = _toScreen(obj.bbox.right, obj.bbox.bottom);
      final rect = Rect.fromLTRB(tl.dx, tl.dy, br.dx, br.dy);

      final ln = Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2;
      canvas.drawRect(rect, ln);

      final label = '${obj.className} ${obj.confidence.toStringAsFixed(2)}';
      final tp = TextPainter(
        text: TextSpan(text: label, style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w600)),
        textDirection: TextDirection.ltr,
      )..layout();

      final bg = Paint()..color = color.withValues(alpha: 0.7);
      canvas.drawRect(Rect.fromLTWH(tl.dx, tl.dy - tp.height - 2, tp.width + 4, tp.height + 2), bg);
      tp.paint(canvas, Offset(tl.dx + 2, tl.dy - tp.height - 1));
    }
  }

  Offset _toScreen(double x, double y) {
    return Offset(x * _scaleX + _offsetX, y * _scaleY + _offsetY);
  }

  @override
  bool shouldRepaint(covariant DetectPainter oldDelegate) => true;
}
```

- [ ] **Step 3: Commit Mode B**

```bash
git add apps/flutter/lib/services/vision/modes/detect_mode.dart apps/flutter/lib/services/vision/painters/detect_painter.dart
git commit -m "feat: add DetectMode with object tracking and bbox painter"
```

---

### Task 5: Create CameraSettingsPage

**Files:**
- Create: `apps/flutter/lib/pages/camera_settings_page.dart`

- [ ] **Step 1: Write camera_settings_page.dart**

```dart
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/imu_sensor_service.dart';
import 'dart:math' as math;

enum GroundDirection {
  portraitDown,
  portraitUp,
  landscapeLeft,
  landscapeRight,
  custom,
}

class CameraSettingsPage extends StatefulWidget {
  const CameraSettingsPage({super.key});

  @override
  State<CameraSettingsPage> createState() => _CameraSettingsPageState();
}

class _CameraSettingsPageState extends State<CameraSettingsPage> {
  GroundDirection _direction = GroundDirection.portraitDown;
  double _customAngle = 0;
  bool _calibrating = false;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString('ground_direction') ?? 'portraitDown';
    final angle = prefs.getDouble('ground_custom_angle') ?? 0;
    setState(() {
      _direction = GroundDirection.values.firstWhere((d) => d.name == saved, orElse: () => GroundDirection.portraitDown);
      _customAngle = angle;
    });
  }

  Future<void> _saveDirection(GroundDirection dir) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('ground_direction', dir.name);
    if (dir == GroundDirection.custom) {
      await prefs.setDouble('ground_custom_angle', _customAngle);
    }
    setState(() => _direction = dir);
  }

  Future<void> _autoCalibrate() async {
    setState(() => _calibrating = true);
    try {
      final imu = ImuSensorService();
      final data = await imu.readOnce();
      if (data == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('IMU unavailable')),
          );
        }
        return;
      }

      final gx = data.accelX, gy = data.accelY, gz = data.accelZ;
      final mag = math.sqrt(gx * gx + gy * gy + gz * gz);
      if (mag < 0.5 || mag > 15) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Gravity reading unstable, hold device still')),
          );
        }
        return;
      }

      final angle = math.atan2(gy, gx) * 180 / math.pi;
      await _saveDirection(GroundDirection.custom);
      await SharedPreferences.getInstance().then((p) => p.setDouble('ground_custom_angle', angle));
      setState(() {
        _direction = GroundDirection.custom;
        _customAngle = angle;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Calibrated: ${angle.toStringAsFixed(0)}°')),
        );
      }
    } finally {
      if (mounted) setState(() => _calibrating = false);
    }
  }

  static String _label(GroundDirection dir) => switch (dir) {
    GroundDirection.portraitDown => 'Upright (default)',
    GroundDirection.portraitUp => 'Ceiling mount',
    GroundDirection.landscapeLeft => 'Tabletop / desk',
    GroundDirection.landscapeRight => 'Tabletop / desk (alt)',
    GroundDirection.custom => 'Custom angle',
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F0F23),
      appBar: AppBar(
        title: const Text('Camera Settings'),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white70,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('Ground Direction', style: TextStyle(color: Colors.white54, fontSize: 12)),
          const SizedBox(height: 8),
          ...GroundDirection.values.map((d) => RadioListTile<GroundDirection>(
            title: Text(_label(d), style: const TextStyle(color: Colors.white70, fontSize: 14)),
            value: d,
            groupValue: _direction,
            activeColor: const Color(0xFF00E676),
            onChanged: (v) => v != null ? _saveDirection(v) : null,
            dense: true,
          )),
          if (_direction == GroundDirection.custom) ...[
            const SizedBox(height: 8),
            Row(children: [
              const Text('Angle: ', style: TextStyle(color: Colors.white54, fontSize: 13)),
              Expanded(
                child: Slider(
                  value: _customAngle,
                  min: -180, max: 180,
                  divisions: 72,
                  label: '${_customAngle.toStringAsFixed(0)}°',
                  activeColor: const Color(0xFF00E676),
                  onChanged: (v) {
                    setState(() => _customAngle = v);
                    SharedPreferences.getInstance().then((p) => p.setDouble('ground_custom_angle', v));
                  },
                ),
              ),
              Text('${_customAngle.toStringAsFixed(0)}°', style: const TextStyle(color: Colors.white54, fontSize: 12)),
            ]),
          ],
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _calibrating ? null : _autoCalibrate,
              icon: _calibrating
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white54))
                : const Icon(Icons.sensors, size: 18, color: Colors.white70),
              label: Text(_calibrating ? 'Calibrating...' : 'Auto (IMU)', style: const TextStyle(color: Colors.white70, fontSize: 13)),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Colors.white24),
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
```

Note: `ImuSensorService.readOnce()` is a new method needed on the existing service. See Step 2.

- [ ] **Step 2: Add readOnce() to ImuSensorService**

Modify: `apps/flutter/lib/services/imu_sensor_service.dart`

The existing `ImuSensorService` has `dataStream` (broadcast stream). Add a `readOnce()` method:

```dart
  Future<ImuData?> readOnce() async {
    final completer = Completer<ImuData?>();
    late StreamSubscription<ImuData> sub;
    sub = dataStream.listen((data) {
      if (!completer.isCompleted) {
        completer.complete(data);
      }
    });
    start();
    final result = await completer.timeout(
      const Duration(seconds: 2),
      onTimeout: () => null,
    );
    await sub.cancel();
    stop();
    return result;
  }
```

The method temporarily starts the sensor, captures one reading, then stops. The existing `start()`/`stop()` lifecycle is used. If `start()` was already called elsewhere, this may cause double-listen issues — prefer calling this from a context where the sensor is not already streaming.

- [ ] **Step 3: Commit CameraSettingsPage**

```bash
git add apps/flutter/lib/pages/camera_settings_page.dart apps/flutter/lib/services/imu_sensor_service.dart
git commit -m "feat: add CameraSettingsPage with manual and IMU auto ground calibration"
```

---

### Task 6: Create VisionLogPanel widget

**Files:**
- Create: `apps/flutter/lib/widgets/vision_log_panel.dart`

- [ ] **Step 1: Write vision_log_panel.dart**

```dart
import 'package:flutter/material.dart';
import '../services/vision/vision_mode.dart';

class VisionLogPanel extends StatelessWidget {
  final List<VisionLogEntry> entries;
  final String statusText;
  final VoidCallback onClear;

  const VisionLogPanel({
    super.key,
    required this.entries,
    required this.statusText,
    required this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFF0C0C1C),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          color: const Color(0xFF141428),
          child: Row(children: [
            Expanded(
              child: Text(
                statusText,
                style: const TextStyle(fontSize: 10, fontFamily: 'monospace', color: Color(0xFF00E676)),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: onClear,
              child: Text('clear', style: TextStyle(fontSize: 10, color: Colors.white.withValues(alpha: 0.25))),
            ),
          ]),
        ),
        Expanded(
          child: entries.isEmpty
            ? const Center(child: Text('—', style: TextStyle(color: Colors.white12, fontSize: 24)))
            : ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
                itemCount: entries.length,
                itemBuilder: (_, i) {
                  final entry = entries[i];
                  final color = entry.isAlert ? Colors.redAccent : Colors.cyan.shade300;
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 1),
                    child: Text(
                      '[${entry.formattedTime}] ${entry.message}',
                      style: TextStyle(fontSize: 10, fontFamily: 'monospace', color: color),
                    ),
                  );
                },
              ),
        ),
      ]),
    );
  }
}
```

- [ ] **Step 2: Commit VisionLogPanel**

```bash
git add apps/flutter/lib/widgets/vision_log_panel.dart
git commit -m "feat: add VisionLogPanel widget with status line and scrollable log"
```

---

### Task 7: Rewrite CameraViewPage

**Files:**
- Create: `apps/flutter/lib/pages/camera_view_page.dart`
- Modify: `apps/flutter/lib/app.dart` (routing stays same but import is new file)

- [ ] **Step 1: Write camera_view_page.dart**

```dart
import 'dart:math' as math;
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:ultralytics_yolo/ultralytics_yolo.dart';
import '../services/vision/vision_mode.dart';
import '../services/vision/vision_mode_registry.dart';
import '../services/vision/vision_mode_manager.dart';
import '../services/vision/painters/pose_painter.dart';
import '../services/vision/painters/detect_painter.dart';
import '../widgets/vision_log_panel.dart';
import 'camera_settings_page.dart';

class CameraViewPage extends StatefulWidget {
  const CameraViewPage({super.key});

  @override
  State<CameraViewPage> createState() => _CameraViewPageState();
}

class _CameraViewPageState extends State<CameraViewPage> {
  CameraController? _cam;
  YOLOViewController? _yoloCtrl;
  final _manager = VisionModeManager();
  VisionMode? _selectedMode;
  bool _ready = false;
  String? _error;

  final List<VisionLogEntry> _logs = [];
  String _statusText = '';
  bool _isSwitching = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _init());
  }

  Future<void> _init() async {
    try {
      final cameras = await availableCameras();
      final back = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.back,
        orElse: () => cameras.first,
      );
      _cam = CameraController(
        back,
        ResolutionPreset.medium,
        enableAudio: false,
      );
      await _cam!.initialize();
    } catch (e) {
      _error = 'Camera: $e';
      if (mounted) setState(() {});
      return;
    }

    final modes = VisionModeRegistry.modes;
    if (modes.isEmpty) {
      _error = 'No vision modes registered';
      if (mounted) setState(() {});
      return;
    }

    _selectedMode = modes.first;

    if (mounted) {
      setState(() => _ready = true);
      _startYolo();
    }
  }

  void _startYolo() {
    if (_selectedMode == null || _cam == null) return;
    _manager.logEntries.listen((logs) {
      if (mounted) setState(() {
        _logs.clear();
        _logs.addAll(logs);
        _statusText = _manager.status.text;
      });
    });
    _manager.addListener(() {
      if (mounted) setState(() => _statusText = _manager.status.text);
    });
  }

  Future<void> _switchMode(VisionMode mode) async {
    if (_selectedMode?.id == mode.id || _isSwitching) return;
    setState(() => _isSwitching = true);
    try {
      await _manager.switchTo(mode);
      _selectedMode = mode;
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to switch: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSwitching = false);
    }
  }

  void _toggleInference() {
    _manager.toggleInference();
    setState(() {});
  }

  void _onYoloResult(YOLOResult result) {
    _manager.processResult(result);
  }

  @override
  void dispose() {
    _cam?.dispose();
    _manager.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Scaffold(
        backgroundColor: Colors.black,
        body: Center(child: Text(_error!, style: const TextStyle(color: Colors.redAccent))),
      );
    }
    if (!_ready) {
      return const Scaffold(
        backgroundColor: Colors.black,
        body: Center(child: CircularProgressIndicator(color: Colors.white30)),
      );
    }
    return _activeView();
  }

  Widget _activeView() {
    final previewSize = _cam!.value.previewSize;
    final ar = previewSize!.height / previewSize.width;

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(fit: StackFit.expand, children: [
        LayoutBuilder(
          builder: (ctx, constraints) {
            final widgetAr = constraints.maxWidth / constraints.maxHeight;
            double scaleX, scaleY, offsetX = 0, offsetY = 0;

            if (widgetAr > ar) {
              scaleY = constraints.maxHeight;
              scaleX = scaleY / ar;
              offsetX = (constraints.maxWidth - scaleX) / 2;
            } else {
              scaleX = constraints.maxWidth;
              scaleY = scaleX * ar;
              offsetY = (constraints.maxHeight - scaleY) / 2;
            }

            final painter = _manager.painter;
            if (painter is PosePainter) {
              painter.setTransform(scaleX, scaleY, offsetX, offsetY);
            } else if (painter is DetectPainter) {
              painter.setTransform(scaleX, scaleY, offsetX, offsetY);
            }

            return ClipRect(
              child: Stack(children: [
                FittedBox(
                  fit: BoxFit.cover,
                  child: SizedBox(
                    width: previewSize.width,
                    height: previewSize.height,
                    child: CameraPreview(_cam!),
                  ),
                ),
                Positioned.fill(
                  child: CustomPaint(
                    painter: _manager.painter,
                    size: Size(constraints.maxWidth, constraints.maxHeight),
                  ),
                ),
              ]),
            );
          },
        ),

        if (_selectedMode != null && _yoloCtrl == null)
          Positioned.fill(
            child: YOLOView(
              modelPath: _selectedMode!.modelId,
              onResult: (results) {
                for (final r in results) {
                  _onYoloResult(r);
                }
              },
              onControllerReady: (ctrl) {
                _yoloCtrl = ctrl;
                _manager.setController(ctrl);
                _manager.switchTo(_selectedMode!);
              },
            ),
          ),

        Positioned(
          top: MediaQuery.of(context).padding.top + 4,
          left: 8,
          right: 8,
          child: Row(children: [
            GestureDetector(
              onTap: () => Navigator.of(context).pop(),
              child: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(8)),
                child: const Icon(Icons.arrow_back, color: Colors.white70, size: 20),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(8)),
                child: _isSwitching
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white54))
                  : DropdownButtonHideUnderline(
                      child: DropdownButton<VisionMode>(
                        value: _selectedMode,
                        isExpanded: true,
                        dropdownColor: const Color(0xFF1A1A2E),
                        style: const TextStyle(color: Colors.white70, fontSize: 13),
                        items: VisionModeRegistry.modes.map((m) => DropdownMenuItem(
                          value: m,
                          child: Text(m.label),
                        )).toList(),
                        onChanged: (m) => m != null ? _switchMode(m) : null,
                      ),
                    ),
              ),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: _toggleInference,
              child: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(8)),
                child: Icon(
                  _manager.inferenceActive ? Icons.stop : Icons.play_arrow,
                  color: Colors.white70,
                  size: 20,
                ),
              ),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const CameraSettingsPage()),
              ),
              child: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(8)),
                child: const Icon(Icons.settings, color: Colors.white70, size: 20),
              ),
            ),
          ]),
        ),

        Positioned(
          bottom: 0, left: 0, right: 0,
          height: 160,
          child: VisionLogPanel(
            entries: _logs,
            statusText: _statusText,
            onClear: () { _manager.clearLogs(); setState(() => _logs.clear()); },
          ),
        ),
      ]),
    );
  }
}
```

**Important note**: The `YOLOView` widget serves as both the camera preview AND the inference engine. Having both `CameraPreview` and `YOLOView` would be redundant. After verifying `YOLOView`'s actual API (whether it includes the camera preview or just processes frames), adjust the implementation:

- If `YOLOView` includes camera preview: Remove the separate `CameraPreview` widget, use `YOLOView` alone. Pass camera controller via `YOLOView` if supported.
- If `YOLOView` is just an overlay/inference: Keep `CameraPreview` underneath, position `YOLOView` on top with transparent background.

The initial implementation places YOLOView as a positioned child. After `flutter pub get` and verifying the API, adjust accordingly.

- [ ] **Step 2: Update app.dart import (camera_view_page.dart recreated, import stays same)**

Verify that `apps/flutter/lib/app.dart` line 6 still imports the new file:

```dart
import 'pages/camera_view_page.dart';
```

No change needed — the path is identical.

- [ ] **Step 3: Commit CameraViewPage**

```bash
git add apps/flutter/lib/pages/camera_view_page.dart
git commit -m "feat: rewrite CameraViewPage with YOLO, dropdown mode switching, overlay controls"
```

---

### Task 8: Integration — Register modes in main.dart

**Files:**
- Modify: `apps/flutter/lib/main.dart`

- [ ] **Step 1: Update main.dart to register vision modes**

```dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'app.dart';
import 'services/pin_service.dart';
import 'services/vision/vision_mode_registry.dart';
import 'services/vision/modes/pose_mode.dart';
import 'services/vision/modes/detect_mode.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await PinService.instance.loadSavedPin();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);

  VisionModeRegistry.register(PoseMode());
  VisionModeRegistry.register(DetectMode());

  runApp(const IomteaToolsApp());
}
```

- [ ] **Step 2: Verify build compiles**

```bash
cd apps/flutter && flutter analyze
```

Expected: no errors. Address any type mismatches (particularly `YOLOResult.bbox`, `YOLOResult.keypoints` access patterns — adjust field names based on actual ultralytics_yolo API).

- [ ] **Step 3: Commit integration**

```bash
git add apps/flutter/lib/main.dart
git commit -m "feat: register PoseMode and DetectMode in app startup"
```

---

### Task 9: Verification — Run flutter analyze and fix issues

- [ ] **Step 1: Run static analysis**

```bash
cd apps/flutter && flutter analyze
```

If errors related to `ultralytics_yolo` types (e.g., `YOLOResult` field names, `YOLOView` parameters):

1. Check the actual API by reading `ultralytics_yolo` source in `.dart_tool/package_config.json` or pub.dev docs
2. Adjust field accesses to match actual API
3. Run `flutter analyze` again

- [ ] **Step 2: Fix any import issues, unused imports, type errors**

Iterate until `flutter analyze` passes with 0 errors.

- [ ] **Step 3: Commit fixes**

```bash
git add -A && git commit -m "fix: resolve ultralytics_yolo API type mismatches and lint issues"
```

---

### Task 10: Update existing test

**Files:**
- Modify: `apps/flutter/test/widget_test.dart`

- [ ] **Step 1: Update test to import new vision mode registrations**

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:iomtea_tools/app.dart';
import 'package:iomtea_tools/services/pin_service.dart';
import 'package:iomtea_tools/services/vision/vision_mode_registry.dart';
import 'package:iomtea_tools/services/vision/modes/pose_mode.dart';
import 'package:iomtea_tools/services/vision/modes/detect_mode.dart';

void main() {
  setUp(() {
    VisionModeRegistry.register(PoseMode());
    VisionModeRegistry.register(DetectMode());
  });

  testWidgets('App renders PIN screen by default', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    await PinService.instance.loadSavedPin();
    await tester.pumpWidget(const IomteaToolsApp());
    await tester.pump();
    expect(find.text('设备验证'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run test**

```bash
cd apps/flutter && flutter test
```

Expected: test passes.

- [ ] **Step 3: Commit test update**

```bash
git add apps/flutter/test/widget_test.dart
git commit -m "test: register vision modes in test setup"
```

---

## Post-Implementation Notes

After all tasks complete, verify end-to-end:

1. `cd apps/flutter && flutter analyze` — 0 errors
2. `cd apps/flutter && flutter test` — tests pass
3. Build and run on device to verify:
   - Camera opens correctly
   - Mode dropdown shows Pose/Fall and Detection
   - Pose mode renders skeleton overlay
   - Detection mode renders bbox overlays
   - Mode switching works without crashes
   - Log panel scrolls and clears
   - Settings page opens for calibration
   - Inference toggle pauses/resumes
