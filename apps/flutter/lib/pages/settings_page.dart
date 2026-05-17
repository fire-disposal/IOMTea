import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/mqtt_models.dart';
import '../services/mqtt_service.dart';
import '../services/pin_service.dart';
import '../theme.dart';

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
  final _serverUrlCtrl = TextEditingController(text: 'http://localhost:3000');
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
    _serverUrlCtrl.text = prefs.getString('server_url') ?? 'http://localhost:3000';
  }

  Future<void> _saveServerUrl() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('server_url', _serverUrlCtrl.text);
    PinService.instance.serverUrl = _serverUrlCtrl.text;
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

  Future<void> _showChangePinDialog() async {
    final oldPinCtrl = TextEditingController();
    final newPinCtrl = TextEditingController();
    final confirmPinCtrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('更换 PIN'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: oldPinCtrl, obscureText: true,
              decoration: const InputDecoration(labelText: '旧 PIN', border: OutlineInputBorder()),
              keyboardType: TextInputType.number, maxLength: 6,
            ),
            const SizedBox(height: 8),
            TextField(
              controller: newPinCtrl, obscureText: true,
              decoration: const InputDecoration(labelText: '新 PIN', border: OutlineInputBorder()),
              keyboardType: TextInputType.number, maxLength: 6,
            ),
            const SizedBox(height: 8),
            TextField(
              controller: confirmPinCtrl, obscureText: true,
              decoration: const InputDecoration(labelText: '确认新 PIN', border: OutlineInputBorder()),
              keyboardType: TextInputType.number, maxLength: 6,
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('确认')),
        ],
      ),
    );
    if (ok == true && mounted) {
      final cur = PinService.instance.currentPin;
      if (oldPinCtrl.text != cur?.pin) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('旧PIN不正确')));
        return;
      }
      if (newPinCtrl.text.length < 4) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('新PIN至少4位')));
        return;
      }
      if (newPinCtrl.text != confirmPinCtrl.text) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('两次输入的新PIN不一致')));
        return;
      }
      await PinService.instance.savePin(newPinCtrl.text);
      await _saveServerUrl();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('PIN已更换')));
        setState(() {});
      }
    }
  }

  Future<void> _clearPin() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('清除 PIN'),
        content: const Text('确定要清除已保存的PIN吗？'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('确认清除')),
        ],
      ),
    );
    if (ok == true && mounted) {
      await PinService.instance.clearPin();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('PIN已清除')));
        context.pop();
      }
    }
  }

  @override
  void dispose() {
    _brokerCtrl.dispose(); _portCtrl.dispose();
    _usernameCtrl.dispose(); _passwordCtrl.dispose();
    _serverUrlCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('设置')),
    body: ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Text('PIN 验证', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 12),
        Card(
          color: Colors.white,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.fingerprint, size: 20, color: matchaPrimary),
                    const SizedBox(width: 8),
                    Text('当前 PIN', style: TextStyle(color: textSecondary)),
                    const Spacer(),
                    Text(PinService.instance.currentPin?.pin ?? '未设置',
                      style: TextStyle(fontWeight: FontWeight.w600, color: textPrimary)),
                  ],
                ),
                if (PinService.instance.currentPin != null) ...[
                  const SizedBox(height: 4),
                  Text('昵称: ${PinService.instance.currentPin!.nickname.isEmpty ? "无" : PinService.instance.currentPin!.nickname}',
                    style: TextStyle(fontSize: 12, color: textSecondary)),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _serverUrlCtrl,
          decoration: const InputDecoration(
            labelText: '服务器地址',
            hintText: 'http://localhost:3000',
            border: OutlineInputBorder(),
            prefixIcon: Icon(Icons.dns_outlined),
          ),
          onChanged: (_) => _saveServerUrl(),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _showChangePinDialog,
                icon: const Icon(Icons.lock_reset, size: 18),
                label: const Text('更换 PIN'),
                style: OutlinedButton.styleFrom(foregroundColor: matchaPrimary),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _clearPin,
                icon: const Icon(Icons.delete_outline, size: 18),
                label: const Text('清除 PIN'),
                style: OutlinedButton.styleFrom(foregroundColor: errorRed),
              ),
            ),
          ],
        ),
        const SizedBox(height: 32),
        const Divider(),
        const SizedBox(height: 16),
        Text('MQTT 设置', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 12),
        TextField(controller: _brokerCtrl, decoration: const InputDecoration(labelText: 'Broker 地址', hintText: '192.168.1.100', border: OutlineInputBorder())),
        const SizedBox(height: 12),
        TextField(controller: _portCtrl, decoration: const InputDecoration(labelText: '端口', hintText: '1883', border: OutlineInputBorder()), keyboardType: TextInputType.number),
        const SizedBox(height: 12),
        TextField(controller: _usernameCtrl, decoration: const InputDecoration(labelText: '用户名 (可选)', border: OutlineInputBorder())),
        const SizedBox(height: 12),
        TextField(controller: _passwordCtrl, decoration: const InputDecoration(labelText: '密码 (可选)', border: OutlineInputBorder()), obscureText: true),
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
      ],
    ),
  );
}
