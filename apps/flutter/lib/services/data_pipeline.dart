import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:mqtt_client/mqtt_client.dart';
import 'mqtt_service.dart';
import 'pin_service.dart';
import 'database/database.dart';
import 'database/health_event_repo.dart';
import 'database/sync_queue_repo.dart';

enum EventPriority { high, normal, low }

class DataPipeline {
  static final DataPipeline instance = DataPipeline._();
  DataPipeline._();

  final _eventRepo = HealthEventRepo(AppDatabase.instance);
  final _syncRepo = SyncQueueRepo(AppDatabase.instance);
  Timer? _syncTimer;
  bool _syncing = false;

  static const _batchSize = 20;
  static const _syncInterval = Duration(seconds: 15);
  static const _maxRetries = 5;

  Future<void> init() async {
    await AppDatabase.instance.database;
    _startSyncLoop();
  }

  void _startSyncLoop() {
    _syncTimer?.cancel();
    _syncTimer = Timer.periodic(_syncInterval, (_) => _flushPending());
    _flushPending();
  }

  Future<void> ingest({
    required String type,
    String? subtype,
    double confidence = 0.5,
    Map<String, dynamic>? metadata,
    double? accelX, double? accelY, double? accelZ, double? accelMag,
    EventPriority priority = EventPriority.normal,
  }) async {
    final event = HealthEvent(
      timestamp: DateTime.now().millisecondsSinceEpoch,
      type: type,
      subtype: subtype,
      confidence: confidence,
      accelX: accelX, accelY: accelY, accelZ: accelZ,
      accelMag: accelMag,
      metadata: metadata,
    );
    await _eventRepo.insert(event);

    final payload = _buildPayload(type, subtype: subtype, confidence: confidence, metadata: metadata,
        accelX: accelX, accelY: accelY, accelZ: accelZ, accelMag: accelMag);

    if (priority == EventPriority.high) {
      _sendImmediate(payload);
    } else {
      await _syncRepo.enqueue(payload, topic: _topic());
    }
  }

  Map<String, dynamic> _buildPayload(String type, {
    String? subtype, double confidence = 0.5, Map<String, dynamic>? metadata,
    double? accelX, double? accelY, double? accelZ, double? accelMag,
  }) {
    final pin = PinService.instance.currentPin?.pin;
    final deviceId = PinService.instance.deviceId;
    return <String, dynamic>{
      'deviceId': deviceId,
      if (pin != null) 'pin': pin,
      'event': type,
      if (subtype != null) 'subtype': subtype,
      'confidence': confidence,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
      'source': 'iomtea-android',
      if (accelX != null) 'accel_x': accelX,
      if (accelY != null) 'accel_y': accelY,
      if (accelZ != null) 'accel_z': accelZ,
      if (accelMag != null) 'accel_mag': accelMag,
      if (metadata != null) 'metadata': metadata,
    };
  }

  String _topic() {
    final pin = PinService.instance.currentPin?.pin;
    final topicId = pin ?? PinService.instance.deviceId;
    return 'iomtea/device/$topicId/events';
  }

  void _sendImmediate(Map<String, dynamic> payload) {
    final connected = MqttService.instance.currentStatus.name == 'connected';
    if (connected) {
      MqttService.instance.publish(
        topic: _topic(),
        message: jsonEncode(payload),
        qos: MqttQos.atLeastOnce,
      );
    }
    unawaited(_httpPost(payload));
  }

  Future<void> _flushPending() async {
    if (_syncing) return;
    _syncing = true;
    try {
      final pending = await _syncRepo.getPending(limit: _batchSize);
      if (pending.isEmpty) return;

      final connected = MqttService.instance.currentStatus.name == 'connected';
      final batch = pending.map((q) => q.payload).toList();

      if (connected) {
        final batchPayload = jsonEncode({'events': batch.map((p) => jsonDecode(p)).toList()});
        MqttService.instance.publish(
          topic: _topic(),
          message: batchPayload,
          qos: MqttQos.atMostOnce,
        );
      }

      bool httpOk = false;
      try {
        final response = await http.post(
          Uri.parse('${PinService.instance.serverUrl}/trpc/homeGraph.reportDeviceEvent'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'events': batch.map((p) => jsonDecode(p)).toList()}),
        ).timeout(const Duration(seconds: 5));
        httpOk = response.statusCode == 200;
      } catch (_) {}

      for (final item in pending) {
        if (item.retries >= _maxRetries) {
          await _syncRepo.remove(item.id!);
        } else if (connected || httpOk) {
          await _syncRepo.remove(item.id!);
        } else {
          await _syncRepo.incrementRetries(item.id!);
        }
      }
    } finally {
      _syncing = false;
    }
  }

  Future<void> _httpPost(Map<String, dynamic> payload) async {
    try {
      await http.post(
        Uri.parse('${PinService.instance.serverUrl}/trpc/homeGraph.reportDeviceEvent'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(payload),
      ).timeout(const Duration(seconds: 3));
    } catch (_) {}
  }

  Future<int> pendingCount() => _syncRepo.pendingCount();

  void dispose() {
    _syncTimer?.cancel();
  }
}
