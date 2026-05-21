import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:mqtt_client/mqtt_client.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/mqtt_models.dart';
import '../services/mqtt_service.dart';
import '../services/pin_service.dart';
import '../theme.dart';
import 'pin_setup_page.dart';

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
  String? _testResult;

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

  void _testMqtt() {
    final connected = MqttService.instance.currentStatus.name == 'connected';
    setState(() {
      _testResult = connected ? 'MQTT 连接测试成功 — 已连接至 ${_brokerCtrl.text}' : 'MQTT 连接测试失败 — 未连接，请先点击连接按钮';
    });
    Future.delayed(const Duration(seconds: 5), () {
      if (mounted) setState(() => _testResult = null);
    });
  }

  void _verifyPinMqtt() {
    final connected = MqttService.instance.currentStatus.name == 'connected';
    if (!connected) {
      setState(() => _testResult = 'PIN 验证失败 — MQTT 未连接');
      return;
    }
    final pin = PinService.instance.currentPin;
    if (pin == null) {
      setState(() => _testResult = 'PIN 验证失败 — 本地未设置 PIN');
      return;
    }

    final requestId = DateTime.now().millisecondsSinceEpoch.toString();
    final topic = 'users/${pin.pin}/admin/verify';
    final payload = jsonEncode({'pin': pin.pin, 'requestId': requestId});

    MqttService.instance.publish(topic: topic, message: payload);

    StreamSubscription? sub;
    final completer = Completer<void>();
    sub = MqttService.instance.messages?.listen((msgs) {
      for (final m in msgs) {
        final t = m.topic;
        if (t.contains('iomtea/admin/pin/verify') && t.contains('result')) {
          try {
            final pubMsg = m.payload as MqttPublishMessage;
            final str = String.fromCharCodes(pubMsg.payload.message);
            final body = jsonDecode(str) as Map<String, dynamic>;
            if (body['requestId'] == requestId || body['pin'] == pin.pin) {
              final valid = body['valid'] == true;
              setState(() {
                _testResult = valid ? 'PIN 验证成功 — ${body['nickname'] ?? pin.pin} 有效' : 'PIN 验证失败 — 后端未识别此 PIN';
              });
              completer.complete();
            }
          } catch (_) {}
        }
      }
    });

    MqttService.instance.subscribe('iomtea/admin/pin/verify/${pin.pin}/result');

    completer.future.timeout(const Duration(seconds: 5)).catchError((_) {
      if (mounted) setState(() => _testResult = 'PIN 验证超时 — 无后端响应');
    }).whenComplete(() {
      sub?.cancel();
      Future.delayed(const Duration(seconds: 5), () {
        if (mounted) setState(() => _testResult = null);
      });
    });
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

  Future<void> _openPinSetup() async {
    await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const PinSetupPage()),
    );
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _brokerCtrl.dispose(); _portCtrl.dispose();
    _usernameCtrl.dispose(); _passwordCtrl.dispose();
    _serverUrlCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hasPin = PinService.instance.hasPin;

    return Scaffold(
      appBar: AnimatedGradientAppBar(title: '设置'),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          _buildPinCard(hasPin)
              .animate()
              .fadeIn(delay: 50.ms, duration: 300.ms)
              .slideY(begin: 0.05, duration: 300.ms),
          const SizedBox(height: 28),
          Text('服务器', style: Theme.of(context).textTheme.titleMedium),
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
          ).animate().fadeIn(delay: 100.ms, duration: 300.ms),
          const SizedBox(height: 32),
          const Divider(),
          const SizedBox(height: 16),
          Text('MQTT 设置', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          ...[
            TextField(controller: _brokerCtrl, decoration: const InputDecoration(labelText: 'Broker 地址', hintText: '192.168.1.100', border: OutlineInputBorder())),
            const SizedBox(height: 12),
            TextField(controller: _portCtrl, decoration: const InputDecoration(labelText: '端口', hintText: '1883', border: OutlineInputBorder()), keyboardType: TextInputType.number),
            const SizedBox(height: 12),
            TextField(controller: _usernameCtrl, decoration: const InputDecoration(labelText: '用户名 (可选)', border: OutlineInputBorder())),
            const SizedBox(height: 12),
            TextField(controller: _passwordCtrl, decoration: const InputDecoration(labelText: '密码 (可选)', border: OutlineInputBorder()), obscureText: true),
          ].animate().fadeIn(delay: 150.ms, duration: 300.ms).slideY(begin: 0.05, duration: 300.ms),
          const SizedBox(height: 24),
          SizedBox(width: double.infinity, child: FilledButton.icon(
            onPressed: _connecting ? null : _connect,
            icon: _connecting ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.link),
            label: Text(_connecting ? '连接中...' : '连接'),
          )),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _testMqtt,
                icon: const Icon(Icons.wifi_find, size: 16),
                label: const Text('测试 MQTT', style: TextStyle(fontSize: 13)),
                style: OutlinedButton.styleFrom(foregroundColor: infoBlue),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _verifyPinMqtt,
                icon: const Icon(Icons.verified_user, size: 16),
                label: const Text('验证 PIN', style: TextStyle(fontSize: 13)),
                style: OutlinedButton.styleFrom(foregroundColor: matchaPrimary),
              ),
            ),
          ]),
          if (_testResult != null) ...[
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: (_testResult?.contains('成功') ?? false) ? Colors.green.shade50 : Colors.red.shade50,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(_testResult!, style: TextStyle(fontSize: 13, color: (_testResult?.contains('成功') ?? false) ? Colors.green : Colors.red)),
            ),
          ],
          if (_status != null) ...[
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: _status == 'connected' ? Colors.green.shade50 : Colors.red.shade50, borderRadius: BorderRadius.circular(8)),
              child: Text(_status == 'connected' ? '已连接' : _status!, style: TextStyle(fontSize: 13, color: _status == 'connected' ? Colors.green : Colors.red)),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildPinCard(bool hasPin) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            hasPin ? successGreen.withValues(alpha: 0.1) : matchaPrimary.withValues(alpha: 0.1),
            hasPin ? successGreen.withValues(alpha: 0.03) : matchaLight.withValues(alpha: 0.03),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: hasPin ? successGreen.withValues(alpha: 0.3) : matchaPrimary.withValues(alpha: 0.25),
          width: 1,
        ),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(
              color: hasPin ? successGreen.withValues(alpha: 0.15) : warningOrange.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              hasPin ? Icons.fingerprint : Icons.lock_outline,
              color: hasPin ? successGreen : warningOrange,
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(
                hasPin ? 'PIN 已设置' : '未设置 PIN',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: textPrimary),
              ),
              const SizedBox(height: 2),
              Text(
                hasPin
                    ? '当前 PIN: ${PinService.instance.currentPin?.pin ?? ""}'
                    : '设置后可解锁设备管理与事件上报',
                style: TextStyle(fontSize: 12, color: textSecondary),
              ),
            ]),
          ),
          if (hasPin) ...[
            SizedBox(
              height: 32,
              child: TextButton(
                onPressed: _clearPin,
                style: TextButton.styleFrom(foregroundColor: errorRed, padding: const EdgeInsets.symmetric(horizontal: 8)),
                child: const Text('清除', style: TextStyle(fontSize: 12)),
              ),
            ),
            const SizedBox(width: 4),
            SizedBox(
              height: 32,
              child: OutlinedButton(
                onPressed: _showChangePinDialog,
                style: OutlinedButton.styleFrom(
                  foregroundColor: matchaPrimary,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  side: BorderSide(color: matchaPrimary.withValues(alpha: 0.3)),
                ),
                child: const Text('更换', style: TextStyle(fontSize: 12)),
              ),
            ),
          ] else ...[
            SizedBox(
              height: 34,
              child: FilledButton(
                onPressed: _openPinSetup,
                style: FilledButton.styleFrom(
                  backgroundColor: matchaPrimary,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: const Text('去设置', style: TextStyle(fontSize: 13)),
              ),
            ),
          ],
        ]),
      ]),
    );
  }
}
