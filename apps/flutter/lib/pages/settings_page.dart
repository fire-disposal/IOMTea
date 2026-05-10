import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/mqtt_service.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});
  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  final _brokerCtrl = TextEditingController(text: '192.168.1.100');
  final _portCtrl = TextEditingController(text: '1883');
  final _usernameCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _connecting = false;
  String? _status;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    _brokerCtrl.text = prefs.getString('mqtt_broker') ?? '192.168.1.100';
    _portCtrl.text = prefs.getString('mqtt_port') ?? '1883';
    _usernameCtrl.text = prefs.getString('mqtt_username') ?? '';
  }

  Future<void> _connect() async {
    setState(() { _connecting = true; _status = null; });
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('mqtt_broker', _brokerCtrl.text);
      await prefs.setString('mqtt_port', _portCtrl.text);
      await prefs.setString('mqtt_username', _usernameCtrl.text);

      await MqttService.instance.connect(MqttConnectionConfig(
        broker: _brokerCtrl.text,
        port: int.parse(_portCtrl.text),
        clientId: 'iomtea-tools-${DateTime.now().millisecondsSinceEpoch}',
        username: _usernameCtrl.text.isNotEmpty ? _usernameCtrl.text : null,
        password: _passwordCtrl.text.isNotEmpty ? _passwordCtrl.text : null,
      ));

      setState(() => _status = 'connected');
    } catch (e) {
      setState(() => _status = 'error: $e');
    } finally {
      setState(() => _connecting = false);
    }
  }

  @override
  void dispose() {
    _brokerCtrl.dispose(); _portCtrl.dispose();
    _usernameCtrl.dispose(); _passwordCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('MQTT 设置')),
    body: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(children: [
        TextField(controller: _brokerCtrl, decoration: const InputDecoration(labelText: 'Broker 地址', hintText: '192.168.1.100')),
        const SizedBox(height: 12),
        TextField(controller: _portCtrl, decoration: const InputDecoration(labelText: '端口', hintText: '1883'), keyboardType: TextInputType.number),
        const SizedBox(height: 12),
        TextField(controller: _usernameCtrl, decoration: const InputDecoration(labelText: '用户名 (可选)')),
        const SizedBox(height: 12),
        TextField(controller: _passwordCtrl, decoration: const InputDecoration(labelText: '密码 (可选)'), obscureText: true),
        const SizedBox(height: 24),
        SizedBox(width: double.infinity, child: FilledButton.icon(
          onPressed: _connecting ? null : _connect,
          icon: _connecting ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.link),
          label: Text(_connecting ? '连接中...' : '连接'),
        )),
        if (_status != null) ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: _status == 'connected' ? Colors.green.shade50 : Colors.red.shade50, borderRadius: BorderRadius.circular(8)),
            child: Text(_status == 'connected' ? '已连接' : _status!, style: TextStyle(color: _status == 'connected' ? Colors.green : Colors.red)),
          ),
        ],
      ]),
    ),
  );
}
