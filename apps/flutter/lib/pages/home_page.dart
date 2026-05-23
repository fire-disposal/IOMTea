import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import '../services/pin_service.dart';
import '../services/mqtt_service.dart';
import '../theme.dart';
import 'pin_setup_page.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});
  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  bool _showBanner = false;
  bool _bannerDismissed = false;

  @override
  void initState() {
    super.initState();
    _showBanner = !PinService.instance.hasPin;
    MqttService.instance.statusStream.listen((s) {
      if (mounted) setState(() {});
    });
  }

  Future<void> _openPinSetup() async {
    final result = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const PinSetupPage()),
    );
    if (mounted) {
      if (result == true) {
        setState(() {
          _showBanner = false;
          _bannerDismissed = false;
        });
      } else {
        setState(() {
          _bannerDismissed = true;
        });
      }
    }
  }

  void _dismissBanner() {
    setState(() {
      _showBanner = false;
      _bannerDismissed = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    final mqttOk = MqttService.instance.currentStatus.name == 'connected';
    final hasPin = PinService.instance.hasPin;

    return Scaffold(
      backgroundColor: creamBg,
      appBar: AnimatedGradientAppBar(
        title: 'IOMTea Tools',
        subtitle: Row(mainAxisSize: MainAxisSize.min, children: [
          if (hasPin) ...[
            Icon(Icons.fingerprint, size: 12, color: Colors.white.withValues(alpha: 0.7)),
            const SizedBox(width: 4),
            Text('已认证', style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.7))),
            const SizedBox(width: 10),
          ],
          Container(width: 5, height: 5, decoration: BoxDecoration(shape: BoxShape.circle, color: mqttOk ? const Color(0xFF81C784) : Colors.white38)),
          const SizedBox(width: 4),
          Text(mqttOk ? 'MQTT 在线' : '离线', style: TextStyle(fontSize: 11, color: mqttOk ? const Color(0xFF81C784) : Colors.white38)),
        ]),
        actions: [
          IconButton(icon: const Icon(Icons.settings_outlined), onPressed: () async {
            await context.push('/settings');
            if (mounted) setState(() { _showBanner = !PinService.instance.hasPin && !_bannerDismissed; });
          }),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(kPagePadding),
        child: Column(children: [
          if (_showBanner)
            _buildPinBanner()
                .animate()
                .slideY(begin: -1, duration: 400.ms, curve: Curves.easeOut)
                .fadeIn(duration: 300.ms),
          const SizedBox(height: 8),
          Expanded(
            child: GridView.count(
              crossAxisCount: 2,
              mainAxisSpacing: 14,
              crossAxisSpacing: 14,
              childAspectRatio: 0.82,
              children: [
                _ModeCard(
                  icon: Icons.watch,
                  label: '可穿戴设备',
                  sublabel: 'IMU 跌倒检测\n加速度·陀螺仪',
                  color: matchaPrimary,
                  onTap: () => context.push('/wearable'),
                )
                    .animate()
                    .fadeIn(delay: 100.ms, duration: 400.ms)
                    .slideY(begin: 0.1, duration: 400.ms),
                _ModeCard(
                  icon: Icons.videocam,
                  label: '固定设备',
                  sublabel: 'YOLO 视觉检测\n识别 + 姿态估计',
                  color: infoBlue,
                  onTap: () => context.push('/fixed-device'),
                )
                    .animate()
                    .fadeIn(delay: 200.ms, duration: 400.ms)
                    .slideY(begin: 0.1, duration: 400.ms),
                _ModeCard(
                  icon: Icons.science_outlined,
                  label: '事件模拟',
                  sublabel: hasPin ? '健康数据生成\n批量事件上报' : '需先设置PIN码',
                  color: hasPin ? warningOrange : Colors.grey,
                  onTap: hasPin
                      ? () => context.push('/simulator')
                      : () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('请先设置设备PIN码'), duration: Duration(seconds: 2)),
                          );
                        },
                )
                    .animate()
                    .fadeIn(delay: 300.ms, duration: 400.ms)
                    .slideY(begin: 0.1, duration: 400.ms),
              ],
            ),
          ),
        ]),
      ),
    );
  }

  Widget _buildPinBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [matchaPrimary.withValues(alpha: 0.12), matchaLight.withValues(alpha: 0.06)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: matchaPrimary.withValues(alpha: 0.25), width: 1),
      ),
      child: Row(children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: matchaPrimary.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Icon(Icons.lock_outline, color: matchaPrimary, size: 22),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('设置设备PIN码', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: textPrimary)),
              const SizedBox(height: 2),
              Text('绑定后可解锁设备管理与事件上报', style: TextStyle(fontSize: 12, color: textSecondary)),
            ],
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          height: 34,
          child: FilledButton(
            onPressed: _openPinSetup,
            style: FilledButton.styleFrom(
              backgroundColor: matchaPrimary,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('去设置', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
          ),
        ),
        const SizedBox(width: 4),
        GestureDetector(
          onTap: _dismissBanner,
          child: const Padding(
            padding: EdgeInsets.all(4),
            child: Icon(Icons.close, size: 16, color: textSecondary),
          ),
        ),
      ]),
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
                width: 56,
                height: 56,
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
