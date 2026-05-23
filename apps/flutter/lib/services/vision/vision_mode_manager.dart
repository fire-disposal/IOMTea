import 'dart:async';
import 'package:flutter/material.dart';
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

    final previous = _active;
    _active = null;
    await previous?.onDeactivate();
    _logSub?.cancel();

    try {
      _logEntries.clear();
      _logController.add(List.unmodifiable(_logEntries));
      if (_controller != null) {
        await _controller!.switchModel(mode.modelId, mode.task);
      }
      await mode.onActivate(_controller!);
      _active = mode;
      _logSub = mode.logStream.listen(_onLogEntry);
    } catch (e) {
      _active = previous;
      notifyListeners();
      rethrow;
    }
    notifyListeners();
  }

  void toggleInference() {
    if (_active == null && !_inferenceActive) return;
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
