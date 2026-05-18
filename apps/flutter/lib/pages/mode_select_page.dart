import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../theme.dart';

class ModeSelectPage extends StatelessWidget {
  const ModeSelectPage({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: creamBg,
    appBar: AppBar(
      title: const Text('选择设备模式'),
      leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop()),
    ),
    body: Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.watch, size: 64, color: matchaPrimary),
            const SizedBox(height: 8),
            Text('请选择此设备的运行模式', style: TextStyle(fontSize: 16, color: textSecondary)),
            const SizedBox(height: 40),
            SizedBox(
              width: double.infinity,
              height: 120,
              child: Card(
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () => context.push('/wearable'),
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Row(
                      children: [
                        Container(
                          width: 56, height: 56,
                          decoration: BoxDecoration(color: matchaPrimary.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(16)),
                          child: Icon(Icons.watch, size: 28, color: matchaPrimary),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text('可穿戴模式', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: textPrimary)),
                              Text('IMU 跌倒检测 · 手表/手环', style: TextStyle(fontSize: 13, color: textSecondary)),
                            ],
                          ),
                        ),
                        Icon(Icons.chevron_right, color: textSecondary),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              height: 120,
              child: Card(
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () => context.push('/room-bind'),
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Row(
                      children: [
                        Container(
                          width: 56, height: 56,
                          decoration: BoxDecoration(color: Colors.blue.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(16)),
                          child: const Icon(Icons.videocam, size: 28, color: Colors.blue),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text('固定设备模式', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: textPrimary)),
                              Text('视觉检测 · 区域定位', style: TextStyle(fontSize: 13, color: textSecondary)),
                            ],
                          ),
                        ),
                        Icon(Icons.chevron_right, color: textSecondary),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}