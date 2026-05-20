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
