import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});
  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  String? _broker;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() => _broker = prefs.getString('mqtt_broker'));
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('IOMTea Tools'),
      actions: [
        IconButton(icon: const Icon(Icons.settings), onPressed: () => context.push('/settings')),
      ],
    ),
    body: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: _broker != null ? Colors.green.shade50 : Colors.grey.shade100,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(children: [
              Icon(_broker != null ? Icons.cloud_done : Icons.cloud_off, color: _broker != null ? Colors.green : Colors.grey),
              const SizedBox(width: 12),
              Text(_broker != null ? 'MQTT: $_broker' : '未配置 MQTT 连接', style: TextStyle(color: _broker != null ? Colors.green.shade700 : Colors.grey)),
            ]),
          ),
          const SizedBox(height: 32),
          Text('调试工具', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          _ToolCard(icon: Icons.chat, title: 'MQTT 控制台', subtitle: '消息收发与 Topic 监控', onTap: () => context.push('/mqtt')),
          _ToolCard(icon: Icons.videocam, title: '视觉跌倒检测', subtitle: 'YOLO 实时推理', onTap: () => context.push('/vision')),
          _ToolCard(icon: Icons.sensors, title: 'IMU 运动监测', subtitle: '加速度计 + 陀螺仪波形', onTap: () => context.push('/imu')),
        ],
      ),
    ),
  );
}

class _ToolCard extends StatelessWidget {
  final IconData icon; final String title; final String subtitle; final VoidCallback onTap;
  const _ToolCard({required this.icon, required this.title, required this.subtitle, required this.onTap});

  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.only(bottom: 8),
    child: ListTile(
      leading: Icon(icon, size: 28),
      title: Text(title),
      subtitle: Text(subtitle, style: const TextStyle(fontSize: 12)),
      trailing: const Icon(Icons.chevron_right),
      onTap: onTap,
    ),
  );
}
