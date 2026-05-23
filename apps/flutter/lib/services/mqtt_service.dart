import 'dart:async';
import 'dart:convert';
import 'package:mqtt_client/mqtt_client.dart';
import 'package:mqtt_client/mqtt_server_client.dart';
import 'mqtt_models.dart';
import 'pin_service.dart';

enum MqttConnectionStatus { disconnected, connecting, connected, error }

class MqttService {
  static final instance = MqttService._();
  MqttService._();

  MqttServerClient? _client;
  final _statusCtrl = StreamController<MqttConnectionStatus>.broadcast();
  MqttConnectionStatus _status = MqttConnectionStatus.disconnected;
  String _deviceId = '';

  Stream<MqttConnectionStatus> get statusStream => _statusCtrl.stream;
  MqttConnectionStatus get currentStatus => _status;

  Future<void> connect(MqttConnectionConfig config) async {
    try {
      _updateStatus(MqttConnectionStatus.connecting);

      _deviceId = PinService.instance.deviceId;
      final persistentId = 'iomtea-$_deviceId';

      _client = MqttServerClient(config.broker, persistentId);
      _client!.port = config.port;
      _client!.keepAlivePeriod = config.keepAlive;
      _client!.autoReconnect = config.autoReconnect;
      _client!.setProtocolV311();

      final statusTopic = 'iomtea/device/$_deviceId/status';
      final lwtPayload = '{"online":false}';

      final connMsg = MqttConnectMessage()
          .withClientIdentifier(persistentId)
          .withWillTopic(statusTopic)
          .withWillMessage(lwtPayload)
          .withWillQos(MqttQos.atLeastOnce)
          .withWillRetain()
          .startClean();

      _client!.connectionMessage = connMsg;
      _client!.connectTimeoutPeriod = config.connectionTimeout * 1000;

      await _client!.connect(config.username, config.password);
      if (_client!.connectionStatus!.state != MqttConnectionState.connected) {
        throw Exception('连接失败');
      }

      _updateStatus(MqttConnectionStatus.connected);
      _publishOnline();
    } catch (e) {
      _updateStatus(MqttConnectionStatus.error);
      rethrow;
    }
  }

  void _publishOnline() {
    final statusTopic = 'iomtea/device/$_deviceId/status';
    final builder = MqttClientPayloadBuilder()
      ..addString(jsonEncode({
        'online': true,
        'ts': DateTime.now().millisecondsSinceEpoch,
        'version': '1.0.0',
      }));
    _client?.publishMessage(statusTopic, MqttQos.atLeastOnce, builder.payload!, retain: true);
  }

  void _publishOffline() {
    final statusTopic = 'iomtea/device/$_deviceId/status';
    final builder = MqttClientPayloadBuilder()
      ..addString(jsonEncode({'online': false}));
    _client?.publishMessage(statusTopic, MqttQos.atLeastOnce, builder.payload!, retain: true);
  }

  void publish({required String topic, required String message, MqttQos qos = MqttQos.atMostOnce}) {
    final builder = MqttClientPayloadBuilder()..addString(message);
    _client?.publishMessage(topic, qos, builder.payload!);
  }

  Subscription? subscribe(String topic, {MqttQos qos = MqttQos.atMostOnce}) {
    return _client?.subscribe(topic, qos);
  }

  Stream<List<MqttReceivedMessage<MqttMessage>>>? get messages => _client?.updates;

  void _updateStatus(MqttConnectionStatus s) { _status = s; _statusCtrl.add(s); }

  void dispose() {
    _publishOffline();
    _client?.disconnect();
    _statusCtrl.close();
  }
}
