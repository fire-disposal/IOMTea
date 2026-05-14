import 'dart:async';
import 'package:flutter/material.dart';
import 'package:mqtt_client/mqtt_client.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/imu_sensor_service.dart';
import '../services/mqtt_service.dart';
import '../theme.dart';

class CollectionPanel extends StatefulWidget {
  const CollectionPanel({super.key});

  @override
  State<CollectionPanel> createState() => _CollectionPanelState();
}

class _CollectionPanelState extends State<CollectionPanel> {
  bool _mqttConnected = false;
  String? _patientName;
  int _selectedTool = -1; // -1 = none, 0 = MQTT, 1 = IMU, 2 = Log
  final List<String> _eventLog = [];
  final TextEditingController _topicController = TextEditingController();
  final TextEditingController _payloadController = TextEditingController();

  // IMU state
  final ImuSensorService _imuService = ImuSensorService();
  StreamSubscription<ImuData>? _imuSub;
  ImuData? _imuData;
  bool _imuRunning = false;
  int _imuSampleCount = 0;
  DateTime _lastFallLog = DateTime(2000);

  @override
  void initState() {
    super.initState();
    _addLog('📋 CV 端点已启动');
    _loadBinding();
    MqttService.instance.statusStream.listen((status) {
      setState(() {
        _mqttConnected = status == MqttConnectionStatus.connected;
      });
    });
  }

  @override
  void dispose() {
    _stopImu();
    _topicController.dispose();
    _payloadController.dispose();
    super.dispose();
  }

  void _startImu() {
    if (_imuRunning) return;
    _imuService.start();
    _imuSub = _imuService.dataStream.listen((d) {
      setState(() {
        _imuData = d;
        _imuSampleCount++;
        // Fall detection: high acceleration magnitude
        if (d.accelMagnitude > 20) {
          final now = DateTime.now();
          if (now.difference(_lastFallLog).inSeconds > 5) {
            _lastFallLog = now;
            _addLog('🚨 检测到跌倒事件！');
          }
        }
      });
    });
    setState(() => _imuRunning = true);
  }

  void _stopImu() {
    _imuSub?.cancel();
    _imuSub = null;
    _imuService.stop();
    setState(() => _imuRunning = false);
  }

  void _selectTool(int index) {
    setState(() {
      if (_selectedTool == index) {
        _selectedTool = -1;
        if (index == 1) _stopImu();
      } else {
        _selectedTool = index;
        if (index == 1) _startImu();
        if (_selectedTool != 1) _stopImu();
      }
    });
  }

  Future<void> _loadBinding() async {
    final prefs = await SharedPreferences.getInstance();
    final name = prefs.getString('patientName');
    setState(() {
      _patientName = name;
    });
    if (name != null && name.isNotEmpty) {
      _addLog('🔗 已绑定患者: $name');
    }
  }

  void _addLog(String event) {
    setState(() {
      _eventLog.insert(0, '${DateTime.now().toString().substring(11, 19)} $event');
      if (_eventLog.length > 50) _eventLog.removeLast();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: creamBg,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(_patientName ?? '未绑定', style: const TextStyle(fontSize: 16)),
            if (_patientName != null)
              Text('CV 感知端点', style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.7))),
          ],
        ),
        actions: [
          Container(
            width: 10, height: 10,
            margin: const EdgeInsets.only(right: 8),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _mqttConnected ? matchaPrimary : Colors.grey,
            ),
          ),
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () => Navigator.of(context).pushNamed('/settings'),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            flex: 3,
            child: Container(
              color: Colors.black87,
              child: Stack(
                children: [
                  const Center(
                    child: Icon(Icons.videocam, size: 64, color: Colors.white24),
                  ),
                  Positioned(
                    bottom: 8, left: 8, right: 8,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.black54,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Text(
                            '跌倒检测: 监视中',
                            style: TextStyle(color: Colors.white70, fontSize: 12),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          Expanded(
            flex: 2,
            child: Container(
              color: Colors.white,
              child: Column(
                children: [
                  Container(
                    decoration: const BoxDecoration(
                      border: Border(bottom: BorderSide(color: Color(0xFFEEEEEE))),
                    ),
                    child: Row(
                      children: [
                        _toolTab(Icons.chat, 'MQTT', 0),
                        _toolTab(Icons.sensors, 'IMU', 1),
                        _toolTab(Icons.list_alt, '日志', 2),
                      ],
                    ),
                  ),

                  Expanded(
                    child: _selectedTool == 0 ? _mqttTool()
                        : _selectedTool == 1 ? _imuTool()
                        : _selectedTool == 2 ? _logTool()
                        : _idleTool(),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _toolTab(IconData icon, String label, int index) {
    final selected = _selectedTool == index;
    return Expanded(
      child: InkWell(
        onTap: () => _selectTool(index),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: selected ? matchaPrimary : Colors.transparent, width: 2)),
          ),
          child: Column(
            children: [
              Icon(icon, size: 20, color: selected ? matchaPrimary : textSecondary),
              const SizedBox(height: 2),
              Text(label, style: TextStyle(fontSize: 11, color: selected ? matchaPrimary : textSecondary)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _idleTool() {
    return Center(
      child: Text(
        _patientName != null ? '选择工具箱' : '请先绑定患者',
        style: const TextStyle(color: textSecondary),
      ),
    );
  }

  Widget _mqttTool() {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
          child: Row(
            children: [
              Expanded(
                flex: 2,
                child: TextField(
                  controller: _topicController,
                  style: const TextStyle(fontSize: 12, fontFamily: 'monospace'),
                  decoration: const InputDecoration(
                    hintText: '主题',
                    isDense: true,
                    contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 3,
                child: TextField(
                  controller: _payloadController,
                  style: const TextStyle(fontSize: 12, fontFamily: 'monospace'),
                  decoration: const InputDecoration(
                    hintText: '消息内容',
                    isDense: true,
                    contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
              const SizedBox(width: 4),
              IconButton(
                icon: const Icon(Icons.send, size: 18, color: matchaPrimary),
                onPressed: () {
                  final topic = _topicController.text.trim();
                  final payload = _payloadController.text.trim();
                  if (topic.isEmpty || payload.isEmpty) return;
                  try {
                    MqttService.instance.publish(topic: topic, message: payload, qos: MqttQos.atMostOnce);
                    _addLog('📤 $topic: $payload');
                  } catch (e) {
                    _addLog('📤 发送失败: $e');
                  }
                  _topicController.clear();
                  _payloadController.clear();
                },
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: _eventLog.length,
            itemBuilder: (_, i) => Text(
              _eventLog[i],
              style: const TextStyle(fontSize: 11, fontFamily: 'monospace', color: textSecondary),
            ),
          ),
        ),
      ],
    );
  }

  Widget _imuTool() {
    final d = _imuData;
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: matchaPrimary.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                const Icon(Icons.sensors, color: matchaPrimary, size: 20),
                const SizedBox(width: 8),
                const Text('IMU 传感器', style: TextStyle(fontWeight: FontWeight.w500, fontSize: 13)),
                const Spacer(),
                Container(
                  width: 8, height: 8,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _imuRunning ? matchaPrimary : Colors.grey,
                  ),
                ),
                const SizedBox(width: 4),
                Text(
                  _imuRunning ? '采样中' : '已停止',
                  style: const TextStyle(fontSize: 11, color: textSecondary),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _imuValueCard('X', d != null ? d.accelX.toStringAsFixed(2) : '0.00', 'g'),
              const SizedBox(width: 8),
              _imuValueCard('Y', d != null ? d.accelY.toStringAsFixed(2) : '0.00', 'g'),
              const SizedBox(width: 8),
              _imuValueCard('Z', d != null ? d.accelZ.toStringAsFixed(2) : '0.00', 'g'),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              _imuValueCard('陀螺仪', d != null ? d.gyroMagnitude.toStringAsFixed(2) : '0.00', '°/s'),
              const SizedBox(width: 8),
              _imuValueCard('采样率', '$_imuSampleCount', '样本'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _imuValueCard(String label, String value, String unit) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFFEEEEEE)),
        ),
        child: Column(
          children: [
            Text(label, style: const TextStyle(fontSize: 10, color: textSecondary)),
            const SizedBox(height: 2),
            Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: textPrimary)),
            Text(unit, style: const TextStyle(fontSize: 10, color: textSecondary)),
          ],
        ),
      ),
    );
  }

  Widget _logTool() {
    if (_eventLog.isEmpty) {
      return const Center(child: Text('暂无事件', style: TextStyle(color: textSecondary)));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(8),
      itemCount: _eventLog.length,
      itemBuilder: (_, i) {
        final msg = _eventLog[i];
        String icon = '📋';
        if (msg.contains('📤')) icon = '';
        if (msg.contains('跌倒')) icon = '🚨';
        if (msg.contains('绑定')) icon = '🔗';
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 2),
          child: Text(
            '$icon $msg',
            style: TextStyle(
              fontSize: 11,
              fontFamily: 'monospace',
              color: msg.contains('跌倒') ? errorRed : textSecondary,
            ),
          ),
        );
      },
    );
  }
}
