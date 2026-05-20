import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
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

  final List<_Person> _tracked = [];
  int _nextId = 1;
  static const _iouThreshold = 0.3;
  static const _maxLeftFrames = 10;
  static const _fallenConfirmFrames = 6;
  bool _invertY = false;

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
  Future<void> onActivate(YOLOViewController controller) async {
    final prefs = await SharedPreferences.getInstance();
    final dir = prefs.getString('ground_direction') ?? 'portraitDown';
    _invertY = dir == 'portraitUp';
  }

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

      if (person.state == 'fallen') {
        if (newState != 'lying') {
          person.state = newState;
          person.fallenFrames = 0;
          _logController.add(VisionLogEntry(
            time: DateTime.now(),
            message: 'Person #${person.id} — $newState (${person.lastResult.confidence.toStringAsFixed(2)})',
          ));
        }
      } else if (newState != person.state) {
        person.state = newState;
        _logController.add(VisionLogEntry(
          time: DateTime.now(),
          message: 'Person #${person.id} — $newState (${person.lastResult.confidence.toStringAsFixed(2)})',
          isAlert: newState == 'fallen',
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

      if (newState == 'lying' && person.state != 'fallen') {
        person.fallenFrames++;
        if (person.fallenFrames >= _fallenConfirmFrames) {
          person.state = 'fallen';
          _logController.add(VisionLogEntry(
            time: DateTime.now(),
            message: 'Person #${person.id} — fallen (${person.lastResult.confidence.toStringAsFixed(2)})',
            isAlert: true,
          ));
        }
      } else if (newState != 'lying') {
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
    if (kp == null || kp.length < 13) return 'unknown';

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
    if (_invertY ? shoulderY > hipY : shoulderY < hipY) return 'standing';

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
    await _logController.close();
  }
}
