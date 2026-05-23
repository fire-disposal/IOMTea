import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:ultralytics_yolo/ultralytics_yolo.dart';
import '../vision_mode.dart';
import '../painters/detect_painter.dart';

Rect _lerpRect(Rect a, Rect b, double t) {
  return Rect.fromLTRB(
    ui.lerpDouble(a.left, b.left, t) ?? b.left,
    ui.lerpDouble(a.top, b.top, t) ?? b.top,
    ui.lerpDouble(a.right, b.right, t) ?? b.right,
    ui.lerpDouble(a.bottom, b.bottom, t) ?? b.bottom,
  );
}

class _Obj {
  final int id;
  final String className;
  YOLOResult lastResult;
  int leftFrames;
  Rect _smoothedBox;

  _Obj({
    required this.id,
    required this.className,
    required this.lastResult,
    required this.leftFrames,
  }) : _smoothedBox = lastResult.boundingBox;

  void updateSmooth(Rect newBox, {double alpha = 0.35}) {
    _smoothedBox = _lerpRect(_smoothedBox, newBox, alpha);
  }

  DetectPaintData toPaintData() => DetectPaintData(
    bbox: _smoothedBox,
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
  bool _frameDirty = false;

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
    _frameDirty = true;
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
      best.updateSmooth(result.boundingBox);
    } else {
      final obj = _Obj(id: _nextId++, className: result.className, lastResult: result, leftFrames: 0);
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
    final ax1 = a.boundingBox.left, ay1 = a.boundingBox.top;
    final ax2 = a.boundingBox.right, ay2 = a.boundingBox.bottom;
    final bx1 = b.boundingBox.left, by1 = b.boundingBox.top;
    final bx2 = b.boundingBox.right, by2 = b.boundingBox.bottom;

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
    _frameDirty = false;
  }

  @override
  void flushFrame() {
    if (!_frameDirty) return;
    _removeStale();
    _painter.update(_objects.map((o) => o.toPaintData()).toList());
    _frameDirty = false;
  }
}
