import 'dart:convert';
import 'mqtt_service.dart';

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

  Map<String, dynamic> toJson() => {
    'type': type.name,
    'pin_code': pinCode,
    if (roomId != null) 'room_id': roomId,
    if (action != null) 'action': action,
    if (confidence != null) 'confidence': confidence,
    'timestamp': DateTime.now().toIso8601String(),
    ...metadata,
  };
}

class EventEmitter {
  static const _baseTopic = 'iomtea/device';

  static void emit(DeviceEvent event) {
    if (MqttService.instance.currentStatus.name != 'connected') return;
    final topic = '$_baseTopic/${event.pinCode}/events';
    MqttService.instance.publish(topic: topic, message: jsonEncode(event.toJson()));
  }
}