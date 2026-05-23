import 'dart:async';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:sensors_plus/sensors_plus.dart';
import 'fall_detector.dart';
import 'imu/imu_activity_classifier.dart';
import 'imu/imu_posture_classifier.dart';
import 'imu/imu_step_counter.dart';
import 'data_pipeline.dart';
import 'notification_service.dart';

class BackgroundHealthService {
  static BackgroundHealthService? _instance;
  static BackgroundHealthService get instance => _instance ??= BackgroundHealthService._();

  BackgroundHealthService._();

  bool _running = false;
  StreamSubscription<AccelerometerEvent>? _accelSub;
  StreamSubscription<GyroscopeEvent>? _gyroSub;

  final _fallDetector = FallDetector();
  final _activityClassifier = ImuActivityClassifier();
  final _postureClassifier = ImuPostureClassifier();
  final _stepCounter = ImuStepCounter();

  final _notif = NotificationService.instance;

  int _fallCount = 0;
  int _summaryTick = 0;
  static const _summaryInterval = 300;

  bool get isRunning => _running;

  Future<void> start() async {
    if (_running) return;
    _running = true;

    await DataPipeline.instance.init();
    await _notif.init();
    await _notif.showServiceStatus();

    _accelSub = accelerometerEventStream(
      samplingPeriod: const Duration(milliseconds: 50),
    ).listen(_onAccel);

    _gyroSub = gyroscopeEventStream(
      samplingPeriod: const Duration(milliseconds: 50),
    ).listen((_) {});

    FlutterBackgroundService().on('stopService').listen((_) => stop());
  }

  void _onAccel(AccelerometerEvent e) {
    final mag = _computeMag(e.x, e.y, e.z);

    final fall = _fallDetector.feed(mag, ax: e.x, ay: e.y, az: e.z);
    if (fall) {
      _fallCount++;
      _emitHealthEvent('fall', confidence: 0.9, ax: e.x, ay: e.y, az: e.z, mag: mag);
      _notif.showFallAlert();
    }

    final activity = _activityClassifier.feed(e.x, e.y, e.z, mag);
    if (activity != null) {
      _emitHealthEvent('activity_change', subtype: activity.name, ax: e.x, ay: e.y, az: e.z, mag: mag);
    }

    final posture = _postureClassifier.feed(e.x, e.y, e.z);
    if (posture != null) {
      _emitHealthEvent('posture_change', subtype: posture.name, ax: e.x, ay: e.y, az: e.z, mag: mag);
    }

    _stepCounter.feed(mag);

    _summaryTick++;
    if (_summaryTick >= _summaryInterval) {
      _summaryTick = 0;
      _notif.showSummary(
        fallCount: _fallCount,
        stepCount: _stepCounter.steps,
        activity: _activityClassifier.current.name,
        posture: _postureClassifier.current.name,
      );
    }
  }

  double _computeMag(double x, double y, double z) {
    return (x * x + y * y + z * z).isFinite ? (x * x + y * y + z * z) : 0;
  }

  void _emitHealthEvent(String type, {
    String? subtype,
    double confidence = 0.5,
    double ax = 0, double ay = 0, double az = 0,
    double mag = 0,
  }) {
    DataPipeline.instance.ingest(
      type: type,
      subtype: subtype,
      confidence: confidence,
      accelX: ax, accelY: ay, accelZ: az, accelMag: mag,
      priority: type == 'fall' ? EventPriority.high : EventPriority.normal,
    );
  }

  Future<void> stop() async {
    _running = false;
    await _accelSub?.cancel();
    await _gyroSub?.cancel();
    _fallDetector.reset();
    _activityClassifier.reset();
    _postureClassifier.reset();
    await _notif.cancelAll();
  }
}
