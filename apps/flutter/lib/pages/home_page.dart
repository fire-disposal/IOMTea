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

  void _skipPin() {
    setState(() { _pinState = _PinScreenState.verified; _pinInput.clear(); _pinError = null; });
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
              Positioned(
                top: MediaQuery.of(context).padding.top + 8,
                right: 16,
                child: TextButton.icon(
                  onPressed: verifying ? null : _skipPin,
                  icon: const Icon(Icons.science, size: 16),
                  label: const Text('测试', style: TextStyle(fontSize: 12)),
                  style: TextButton.styleFrom(
                    foregroundColor: warningOrange.withValues(alpha: 0.7),
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
      appBar: AnimatedGradientAppBar(
        title: 'IOMTea Tools',
        subtitle: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.fingerprint, size: 12, color: Colors.white.withValues(alpha: 0.7)),
          const SizedBox(width: 4),
          Text('已认证', style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.7))),
          const SizedBox(width: 10),
          Container(width: 5, height: 5, decoration: BoxDecoration(shape: BoxShape.circle, color: mqttOk ? const Color(0xFF81C784) : Colors.white38)),
          const SizedBox(width: 4),
          Text(mqttOk ? 'MQTT 在线' : '离线', style: TextStyle(fontSize: 11, color: mqttOk ? const Color(0xFF81C784) : Colors.white38)),
        ]),
        actions: [
          IconButton(icon: const Icon(Icons.settings_outlined), onPressed: () async {
            await context.push('/settings');
            if (mounted) _initPin();
          }),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: GridView.count(
          crossAxisCount: 2,
          mainAxisSpacing: 16,
          crossAxisSpacing: 16,
          childAspectRatio: 0.85,
          children: [
            _ModeCard(
              icon: Icons.watch, label: '可穿戴设备',
              sublabel: 'IMU 跌倒检测\n加速度·陀螺仪', color: matchaPrimary,
              onTap: () => context.push('/wearable'),
            ),
            _ModeCard(
              icon: Icons.videocam, label: '固定设备',
              sublabel: 'MoveNet 姿态估计\n识别框 + 骨架', color: infoBlue,
              onTap: () => context.push('/fixed-device'),
            ),
            _ModeCard(
              icon: Icons.bug_report, label: '事件模拟',
              sublabel: '健康数据生成\n批量事件上报', color: warningOrange,
              onTap: () => context.push('/debug'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ModeCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String sublabel;
  final Color color;
  final VoidCallback onTap;

  const _ModeCard({
    required this.icon,
    required this.label,
    required this.sublabel,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        elevation: 1,
        shadowColor: Colors.black12,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 12),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 56, height: 56,
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    colors: [color.withValues(alpha: 0.85), color.withValues(alpha: 0.25)],
                  ),
                  shape: BoxShape.circle,
                  boxShadow: [BoxShadow(color: color.withValues(alpha: 0.3), blurRadius: 16)],
                ),
                child: Icon(icon, size: 28, color: Colors.white),
              ),
              const SizedBox(height: 14),
              Text(label, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: textPrimary), textAlign: TextAlign.center),
              const SizedBox(height: 6),
              Text(sublabel, style: TextStyle(fontSize: 10, color: textSecondary, height: 1.4), textAlign: TextAlign.center),
            ],
          ),
        ),
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
