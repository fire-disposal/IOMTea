import 'dart:math' as math;
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

enum _PinScreenState { loading, input, verifying, verified, success }

class _HomePageState extends State<HomePage>
    with SingleTickerProviderStateMixin {
  _PinScreenState _pinState = _PinScreenState.loading;
  final _pinInput = <String>[];
  String? _pinError;
  late final AnimationController _bgAnim;

  @override
  void initState() {
    super.initState();
    _bgAnim = AnimationController(
      duration: const Duration(seconds: 6),
      vsync: this,
    )..repeat();
    _initPin();
    MqttService.instance.statusStream.listen((s) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _bgAnim.dispose();
    super.dispose();
  }

  void _initPin() {
    if (PinService.instance.hasPin) {
      if (mounted) {
        setState(() => _pinState = _PinScreenState.verified);
        WidgetsBinding.instance.addPostFrameCallback((_) => context.push('/mode-select'));
      }
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
      setState(() { _pinState = _PinScreenState.success; _pinInput.clear(); _pinError = null; });
      await Future.delayed(const Duration(milliseconds: 900));
      if (mounted) setState(() => _pinState = _PinScreenState.verified);
    } else {
      setState(() { _pinState = _PinScreenState.input; _pinError = 'PIN码验证失败，请重试'; _pinInput.clear(); });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_pinState == _PinScreenState.success) return _buildSuccessScreen();
    if (_pinState != _PinScreenState.verified) return _buildPinScreen();
    return _buildMainContent();
  }

  Widget _buildSuccessScreen() {
    return Scaffold(
      backgroundColor: creamBg,
      body: AnimatedBuilder(
        animation: _bgAnim,
        builder: (context, child) {
          final t = _bgAnim.value;
          return Stack(
            children: [
              CustomPaint(
                size: MediaQuery.of(context).size,
                painter: _SuccessBgPainter(t: t),
              ),
              Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TweenAnimationBuilder<double>(
                      tween: Tween(begin: 0.0, end: 1.0),
                      duration: const Duration(milliseconds: 500),
                      curve: Curves.elasticOut,
                      builder: (context, value, child) {
                        return Transform.scale(
                          scale: value,
                          child: Container(
                            width: 80, height: 80,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: successGreen.withValues(alpha: 0.15),
                              boxShadow: [
                                BoxShadow(color: successGreen.withValues(alpha: 0.4), blurRadius: 24, spreadRadius: 4),
                              ],
                            ),
                            child: const Icon(Icons.check, size: 44, color: successGreen),
                          ),
                        );
                      },
                    ),
                    const SizedBox(height: 20),
                    TweenAnimationBuilder<double>(
                      tween: Tween(begin: 0.0, end: 1.0),
                      duration: const Duration(milliseconds: 400),
                      curve: Curves.easeOut,
                      builder: (context, value, child) {
                        return Opacity(
                          opacity: value,
                          child: const Text('验证成功', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w600, color: textPrimary)),
                        );
                      },
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildPinScreen() {
    final verifying = _pinState == _PinScreenState.verifying;
    return Scaffold(
      backgroundColor: creamBg,
      body: AnimatedBuilder(
        animation: _bgAnim,
        builder: (context, child) {
          final t = _bgAnim.value;
          return Stack(
            children: [
              CustomPaint(
                size: MediaQuery.of(context).size,
                painter: _PinBgPainter(t: t),
              ),
              SafeArea(
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
                          return Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 6),
                            child: AnimatedScale(
                              scale: filled ? 1.0 : 0.85,
                              duration: const Duration(milliseconds: 200),
                              curve: Curves.easeOutBack,
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 200),
                                width: 20, height: 20,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: filled ? matchaPrimary : Colors.transparent,
                                  border: Border.all(
                                    color: filled ? matchaPrimary : Colors.grey.shade300,
                                    width: 2,
                                  ),
                                  boxShadow: filled
                                    ? [BoxShadow(color: matchaPrimary.withValues(alpha: 0.5), blurRadius: 10, spreadRadius: 2)]
                                    : null,
                                ),
                              ),
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
            ],
          );
        },
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

class _PinBgPainter extends CustomPainter {
  final double t;
  _PinBgPainter({required this.t});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint();
    for (int i = 0; i < 3; i++) {
      final cx = size.width * (0.2 + i * 0.3);
      final cy = size.height * (0.3 + i * 0.2);
      final radius = 80 + math.sin(t * 1.5 + i * 2.0) * 20;
      paint.color = matchaLight.withValues(alpha: 0.06 + 0.03 * math.sin(t * 0.8 + i));
      canvas.drawCircle(Offset(cx, cy), radius, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _PinBgPainter old) => old.t != t;
}

class _SuccessBgPainter extends CustomPainter {
  final double t;
  _SuccessBgPainter({required this.t});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint();
    final cx = size.width / 2;
    final cy = size.height / 2;
    for (int i = 0; i < 6; i++) {
      final angle = i * math.pi / 3 + t * math.pi;
      final r = 60 + math.sin(t * 3 + i) * 15;
      paint.color = successGreen.withValues(alpha: 0.08 + 0.04 * math.sin(t * 2 + i));
      canvas.drawCircle(Offset(cx + math.cos(angle) * r, cy + math.sin(angle) * r), 40, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _SuccessBgPainter old) => old.t != t;
}
