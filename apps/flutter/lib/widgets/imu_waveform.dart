import 'dart:math';
import 'package:flutter/material.dart';
import '../services/imu_sensor_service.dart';

class ImuWaveformPainter extends CustomPainter {
  final List<ImuData> data;
  ImuWaveformPainter({required this.data});

  @override
  void paint(Canvas canvas, Size size) {
    if (data.length < 2) return;
    final paint = Paint()..color = Colors.deepPurple..strokeWidth = 1.5..style = PaintingStyle.stroke;
    final midY = size.height / 2;
    final scaleX = size.width / max(1, data.length - 1);
    final maxMag = data.map((d) => d.accelMagnitude).reduce(max).clamp(1.0, 100.0);

    final path = Path();
    for (int i = 0; i < data.length; i++) {
      final x = i * scaleX;
      final y = midY - (data[i].accelMagnitude / maxMag) * (size.height / 2 - 10);
      if (i == 0) { path.moveTo(x, y); } else { path.lineTo(x, y); }
    }
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant ImuWaveformPainter old) => old.data != data;
}

class ImuWaveform extends StatelessWidget {
  final List<ImuData> data;
  const ImuWaveform({super.key, required this.data});

  @override
  Widget build(BuildContext context) => CustomPaint(
    size: Size.infinite,
    painter: ImuWaveformPainter(data: data),
  );
}
