import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../theme.dart';

class ModeSelectPage extends StatelessWidget {
  const ModeSelectPage({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: creamBg,
    appBar: AppBar(title: const Text('选择设备模式'), leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop())),
    body: Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          const Icon(Icons.devices, size: 48, color: matchaPrimary),
          const SizedBox(height: 32),
          _ModeCard(
            icon: Icons.watch, color: matchaPrimary,
            title: '可穿戴设备', subtitle: 'IMU 跌倒检测',
            onTap: () => context.push('/wearable'),
          ),
          const SizedBox(height: 16),
          _ModeCard(
            icon: Icons.videocam, color: Colors.blue,
            title: '固定设备', subtitle: '视觉区域定位',
            onTap: () => context.push('/room-bind'),
          ),
        ]),
      ),
    ),
  );
}

class _ModeCard extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title, subtitle;
  final VoidCallback onTap;

  const _ModeCard({required this.icon, required this.color, required this.title, required this.subtitle, required this.onTap});

  @override
  Widget build(BuildContext context) => SizedBox(
    width: double.infinity,
    height: 96,
    child: Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(children: [
            Container(
              width: 48, height: 48,
              decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(14)),
              child: Icon(icon, size: 24, color: color),
            ),
            const SizedBox(width: 16),
            Expanded(child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: textPrimary)),
              Text(subtitle, style: TextStyle(fontSize: 13, color: textSecondary)),
            ])),
            Icon(Icons.chevron_right, color: textSecondary),
          ]),
        ),
      ),
    ),
  );
}