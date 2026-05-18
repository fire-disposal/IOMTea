import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'mqtt_service.dart';
import 'pin_service.dart';

enum DeviceEventType { roomEnter, roomExit, fallDetected, actionDetected }

class DeviceEvent {
  final DeviceEventType type;
  final String pinCode;
  final String? roomId;
  final String? action;
  final double? confidence;
  final Map<String, dynamic> metadata;

  const DeviceEvent({
    required this.type,
    required this.pinCode,
    this.roomId,
    this.action,
    this.confidence,
    this.metadata = const {},
  });
}

class EventEmitter {
  static void emit(DeviceEvent event) {
    _send({
      'pin': event.pinCode,
      'event': event.type.name,
      'roomId': event.roomId,
      'action': event.action,
    });
  }

  static void emitPresence(String pin, String roomId, bool present, {String? action}) {
    _send({
      'pin': pin,
      'event': 'presenceUpdate',
      'roomId': roomId,
      'personPresent': present,
      'action': action,
    });
  }

  static void _send(Map<String, dynamic> payload) {
    if (MqttService.instance.currentStatus.name == 'connected') {
      MqttService.instance.publish(
        topic: 'iomtea/device/${payload['pin']}/events',
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