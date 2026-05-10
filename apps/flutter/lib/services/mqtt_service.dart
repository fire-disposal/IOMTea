import 'dart:async';
import 'dart:io';
import 'package:mqtt_client/mqtt_client.dart';
import 'package:mqtt_client/mqtt_server_client.dart';
import 'mqtt_models.dart';

enum MqttConnectionStatus { disconnected, connecting, connected, error }

class MqttService {
  static final instance = MqttService._();
  MqttService._();

  MqttServerClient? _client;
  final _statusCtrl = StreamController<MqttConnectionStatus>.broadcast();
  MqttConnectionStatus _status = MqttConnectionStatus.disconnected;

  Stream<MqttConnectionStatus> get statusStream => _statusCtrl.stream;
  MqttConnectionStatus get currentStatus => _status;

  Future<void> connect(MqttConnectionConfig config) async {
    try {
      _updateStatus(MqttConnectionStatus.connecting);
      _client = MqttServerClient(config.broker, config.clientId);
      _client!.port = config.port;
      _client!.keepAlivePeriod = config.keepAlive;
      _client!.autoReconnect = config.autoReconnect;
      _client!.setProtocolV311();

      final connMsg = MqttConnectMessage().withClientIdentifier(config.clientId).startClean();
      _client!.connectionMessage = connMsg;
      _client!.connectTimeoutPeriod = config.connectionTimeout * 1000;

      await _client!.connect(config.username, config.password);
      if (_client!.connectionStatus!.state != MqttConnectionState.connected) {
        throw Exception('连接失败');
      }
      _updateStatus(MqttConnectionStatus.connected);
    } catch (e) {
      _updateStatus(MqttConnectionStatus.error);
      rethrow;
    }
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
  void dispose() { _client?.disconnect(); _statusCtrl.close(); }
}
