import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../services/pin_service.dart';
import '../services/mqtt_service.dart';
import '../theme.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});
  @override
  State<HomePage> createState() => _HomePageState();
}

enum _PinScreenState { loading, input, verifying, verified }

class _HomePageState extends State<HomePage> {
  _PinScreenState _pinState = _PinScreenState.loading;
  final _pinInput = <String>[];
  String? _pinError;

  @override
  void initState() {
    super.initState();
    _initPin();
    MqttService.instance.statusStream.listen((s) {
      if (mounted) setState(() {});
    });
  }

  void _initPin() {
    if (PinService.instance.hasPin) {
      if (mounted) setState(() => _pinState = _PinScreenState.verified);
    } else {
      if (mounted) setState(() => _pinState = _PinScreenState.input);
    }
  }

  void _onDigit(String d) {
    if (_pinInput.length >= 6) return;
    setState(() { _pinInput.add(d); _pinError = null; });
  }

  void _onBackspace() {
    if (_pinInput.isEmpty) return;
    setState(() => _pinInput.removeLast());
  }

  Future<void> _onVerify() async {
    if (_pinInput.length < 4) {
      setState(() => _pinError = '请输入至少4位PIN码');
      return;
    }
    setState(() => _pinState = _PinScreenState.verifying);
    final ok = await PinService.instance.verifyPin(_pinInput.join());
    if (!mounted) return;
    if (ok) {
      await PinService.instance.savePin(_pinInput.join());
      setState(() { _pinState = _PinScreenState.verified; _pinInput.clear(); _pinError = null; });
    } else {
      setState(() { _pinState = _PinScreenState.input; _pinError = 'PIN码验证失败，请重试'; _pinInput.clear(); });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_pinState != _PinScreenState.verified) return _buildPinScreen();
    return _buildMainContent();
  }

  Widget _buildPinScreen() {
    final verifying = _pinState == _PinScreenState.verifying;
    return Scaffold(
      backgroundColor: creamBg,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            children: [
              const Spacer(flex: 2),
              Icon(Icons.lock_outline, size: 52, color: matchaPrimary),
              const SizedBox(height: 16),
              Text('设备验证', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w600, color: textPrimary)),
              const SizedBox(height: 8),
              Text('请输入设备PIN码', style: TextStyle(color: textSecondary, fontSize: 15)),
              const SizedBox(height: 36),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(6, (i) {
                  final filled = i < _pinInput.length;
                  return Container(
                    margin: const EdgeInsets.symmetric(horizontal: 6),
                    width: 20, height: 20,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: filled ? matchaPrimary : Colors.transparent,
                      border: Border.all(color: filled ? matchaPrimary : Colors.grey.shade300, width: 2),
                    ),
                  );
                }),
              ),
              const SizedBox(height: 16),
              if (_pinError != null)
                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 200),
                  child: Text(_pinError!, key: ValueKey(_pinError),
                    style: const TextStyle(color: errorRed, fontSize: 14)),
                ),
              const Spacer(flex: 1),
              _buildKeypad(verifying),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildKeypad(bool verifying) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        _buildKeyRow(['1', '2', '3'], verifying),
        const SizedBox(height: 10),
        _buildKeyRow(['4', '5', '6'], verifying),
        const SizedBox(height: 10),
        _buildKeyRow(['7', '8', '9'], verifying),
        const SizedBox(height: 10),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const SizedBox(width: 72),
            _KeyBtn(text: '0', onTap: verifying ? null : () => _onDigit('0')),
            const SizedBox(width: 10),
            _BackBtn(onTap: verifying ? null : _onBackspace),
          ],
        ),
        const SizedBox(height: 28),
        SizedBox(
          width: 240, height: 50,
          child: FilledButton(
            onPressed: verifying ? null : _onVerify,
            style: FilledButton.styleFrom(
              backgroundColor: matchaPrimary,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            child: verifying
              ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
              : const Text('验证', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
          ),
        ),
      ],
    );
  }

  Widget _buildKeyRow(List<String> keys, bool verifying) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: keys.map((k) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 5),
        child: _KeyBtn(text: k, onTap: verifying ? null : () => _onDigit(k)),
      )).toList(),
    );
  }

  Widget _buildMainContent() {
    final mqttOk = MqttService.instance.currentStatus.name == 'connected';
    return Scaffold(
      backgroundColor: creamBg,
      appBar: AppBar(
        title: const Text('IOMTea Tools'),
        actions: [
          IconButton(icon: const Icon(Icons.settings), onPressed: () async {
            await context.push('/settings');
            if (mounted) _initPin();
          }),
        ],
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
            color: Colors.white,
            child: Row(
              children: [
                Icon(Icons.fingerprint, size: 16, color: matchaPrimary),
                const SizedBox(width: 6),
                Text('PIN: ****', style: TextStyle(fontSize: 13, color: textSecondary)),
                const Spacer(),
                Container(
                  width: 8, height: 8, decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: mqttOk ? successGreen : Colors.grey,
                  ),
                ),
                const SizedBox(width: 6),
                Text(mqttOk ? 'MQTT 已连接' : 'MQTT 未连接',
                  style: TextStyle(fontSize: 13, color: mqttOk ? successGreen : Colors.grey)),
              ],
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 8),
                  Text('调试工具', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 12),
                  _ToolCard(icon: Icons.chat, title: 'MQTT 控制台', subtitle: '消息收发与 Topic 监控', onTap: () => context.push('/mqtt')),
                  _ToolCard(icon: Icons.videocam, title: '视觉跌倒检测', subtitle: 'YOLO 实时推理', onTap: () => context.push('/vision')),
                  _ToolCard(icon: Icons.sensors, title: 'IMU 运动监测', subtitle: '加速度计 + 陀螺仪波形', onTap: () => context.push('/imu')),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _KeyBtn extends StatelessWidget {
  final String text;
  final VoidCallback? onTap;
  const _KeyBtn({required this.text, this.onTap});
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 72, height: 52,
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        elevation: 1,
        shadowColor: Colors.black12,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: Center(child: Text(text,
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w500, color: textPrimary))),
        ),
      ),
    );
  }
}

class _BackBtn extends StatelessWidget {
  final VoidCallback? onTap;
  const _BackBtn({this.onTap});
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 72, height: 52,
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        elevation: 1,
        shadowColor: Colors.black12,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: const Center(child: Icon(Icons.backspace_outlined, color: textPrimary)),
        ),
      ),
    );
  }
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
