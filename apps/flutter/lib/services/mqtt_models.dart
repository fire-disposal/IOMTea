class MqttConnectionConfig {
  final String broker;
  final int port;
  final String clientId;
  final int keepAlive;
  final bool autoReconnect;
  final bool useWebSocket;
  final String? username;
  final String? password;
  final int connectionTimeout;

  const MqttConnectionConfig({
    required this.broker,
    required this.port,
    required this.clientId,
    this.keepAlive = 20,
    this.autoReconnect = true,
    this.useWebSocket = false,
    this.username,
    this.password,
    this.connectionTimeout = 15,
  });
}
