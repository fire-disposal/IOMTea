import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../theme.dart';

class ModeSelectPage extends StatefulWidget {
  const ModeSelectPage({super.key});
  @override
  State<ModeSelectPage> createState() => _ModeSelectPageState();
}

class _BlobInfo {
  final IconData icon;
  final String label;
  final String sublabel;
  final Color color;
  final String route;
  const _BlobInfo({
    required this.icon,
    required this.label,
    required this.sublabel,
    required this.color,
    required this.route,
  });
}

class _ModeSelectPageState extends State<ModeSelectPage>
    with SingleTickerProviderStateMixin {
  late final AnimationController _anim;
  int? _activeBlob;

  static const _blobs = [
    _BlobInfo(icon: Icons.watch, label: '可穿戴设备', sublabel: 'IMU 跌倒检测', color: matchaPrimary, route: '/wearable'),
    _BlobInfo(icon: Icons.videocam, label: '固定设备', sublabel: '视觉区域定位', color: infoBlue, route: '/room-bind'),
    _BlobInfo(icon: Icons.bug_report, label: '调试模式', sublabel: 'MQTT 事件模拟器', color: warningOrange, route: '/debug'),
  ];

  @override
  void initState() {
    super.initState();
    _anim = AnimationController(
      duration: const Duration(seconds: 5),
      vsync: this,
    )..repeat();
  }

  @override
  void dispose() {
    _anim.dispose();
    super.dispose();
  }

  void _onBlobTap(int i) {
    setState(() => _activeBlob = i);
    Future.delayed(const Duration(milliseconds: 350), () {
      if (mounted && _activeBlob == i) {
        context.push(_blobs[i].route);
        setState(() => _activeBlob = null);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF121224),
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const Text('选择设备模式'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF0F0F23), Color(0xFF1A1A2E), Color(0xFF16213E)],
          ),
        ),
        child: SafeArea(
          child: AnimatedBuilder(
            animation: _anim,
            builder: (context, child) {
              final t = _anim.value;
              final size = MediaQuery.of(context).size;
              return Stack(
                children: [
                  CustomPaint(
                    size: Size(size.width, size.height),
                    painter: _ParticlePainter(t: t),
                  ),
                  ...List.generate(3, (i) {
                    final angle = i * (2 * math.pi / 3) - math.pi / 2;
                    final r = size.width * 0.28;
                    final cx = size.width / 2 + math.cos(angle) * r - 60;
                    final cy = size.height * 0.38 + math.sin(angle) * (r * 0.75) - 60;
                    final dx = math.sin(t * 2 * math.pi + i * 2.3) * 10;
                    final dy = math.cos(t * 2 * math.pi + i * 1.9) * 14;
                    final blob = _blobs[i];
                    final active = _activeBlob == i;
                    return Positioned(
                      left: cx + dx,
                      top: cy + dy,
                      child: _BlobView(
                        info: blob,
                        active: active,
                        onTap: () => _onBlobTap(i),
                      ),
                    );
                  }),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

class _BlobView extends StatelessWidget {
  final _BlobInfo info;
  final bool active;
  final VoidCallback onTap;
  const _BlobView({required this.info, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedScale(
        scale: active ? 1.15 : 1.0,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOutBack,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  center: const Alignment(-0.3, -0.3),
                  colors: [
                    info.color.withValues(alpha: 0.95),
                    info.color.withValues(alpha: 0.35),
                  ],
                ),
                boxShadow: [
                  BoxShadow(
                    color: info.color.withValues(alpha: 0.5),
                    blurRadius: 35,
                    spreadRadius: 8,
                  ),
                  BoxShadow(
                    color: info.color.withValues(alpha: 0.2),
                    blurRadius: 70,
                    spreadRadius: 15,
                  ),
                ],
              ),
              child: Icon(info.icon, size: 48, color: Colors.white.withValues(alpha: 0.9)),
            ),
            const SizedBox(height: 14),
            AnimatedOpacity(
              opacity: active ? 1.0 : 0.6,
              duration: const Duration(milliseconds: 200),
              child: Column(
                children: [
                  Text(
                    info.label,
                    style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    info.sublabel,
                    style: TextStyle(color: Colors.white.withValues(alpha: 0.45), fontSize: 12),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ParticlePainter extends CustomPainter {
  final double t;
  _ParticlePainter({required this.t});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint();
    final rng = math.Random(42);
    for (int i = 0; i < 35; i++) {
      final x = (rng.nextDouble() * size.width + math.sin(t * 0.7 + i * 1.3) * 40) % size.width;
      final y = (rng.nextDouble() * size.height + math.cos(t * 0.5 + i * 1.1) * 35) % size.height;
      final alpha = (0.06 + 0.07 * math.sin(t * 2.5 + i)).clamp(0.0, 0.2);
      paint.color = Colors.white.withValues(alpha: alpha);
      canvas.drawCircle(Offset(x, y), rng.nextDouble() * 2.5 + 1, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _ParticlePainter old) => old.t != t;
}
