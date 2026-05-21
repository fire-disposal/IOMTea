import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'mqtt_service.dart';
import 'pin_service.dart';

enum DeviceEventType { roomEnter, roomExit, fallDetected, actionDetected }

class DeviceEvent {
  final DeviceEventType type;
  final String? roomId;
  final String? action;
  final double? confidence;
  final Map<String, dynamic> metadata;

  const DeviceEvent({
    required this.type,
    this.roomId,
    this.action,
    this.confidence,
    this.metadata = const {},
  });
}

class EventEmitter {
  static void emit(DeviceEvent event) {
    final pin = PinService.instance.currentPin?.pin;
    final deviceId = PinService.instance.deviceId;
    final payload = <String, dynamic>{
      'deviceId': deviceId,
      'event': event.type.name,
      'roomId': event.roomId,
      'action': event.action,
      'confidence': event.confidence,
      'metadata': event.metadata,
    };
    if (pin != null) {
      payload['pin'] = pin;
    }
    _send(payload);
  }

  static void emitPresence(String roomId, bool present, {String? action}) {
    final pin = PinService.instance.currentPin?.pin;
    final deviceId = PinService.instance.deviceId;
    final payload = <String, dynamic>{
      'deviceId': deviceId,
      'event': 'presenceUpdate',
      'roomId': roomId,
      'personPresent': present,
      'action': action,
    };
    if (pin != null) {
      payload['pin'] = pin;
    }
    _send(payload);
  }

  static void _send(Map<String, dynamic> payload) {
    final topicId = payload['pin'] ?? payload['deviceId'] ?? 'unknown';
    if (MqttService.instance.currentStatus.name == 'connected') {
      MqttService.instance.publish(
        topic: 'iomtea/device/$topicId/events',
        message: jsonEncode(payload),
      );
    }

    unawaited(_httpSend(payload));
  }

  static Future<void> _httpSend(Map<String, dynamic> payload) async {
    try {
      await http.post(
        Uri.parse('${PinService.instance.serverUrl}/trpc/homeGraph.reportDeviceEvent'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(payload),
      ).timeout(const Duration(seconds: 3));
    } catch (_) {}
  }
}
