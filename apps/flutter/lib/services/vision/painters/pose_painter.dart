import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:ultralytics_yolo/ultralytics_yolo.dart';

class PosePaintData {
  final List<Point> keypoints;
  final List<double> keypointConfidences;
  final Rect bbox;
  final double confidence;
  final String state;
  final bool isFallen;

  const PosePaintData({
    required this.keypoints,
    required this.keypointConfidences,
    required this.bbox,
    required this.confidence,
    required this.state,
    this.isFallen = false,
  });
}

class PosePainter extends CustomPainter {
  List<PosePaintData> _persons = [];

  static const _bones = [
    [5, 7], [7, 9], [6, 8], [8, 10], [5, 6],
    [5, 11], [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  ];

  static const _boneColors = [
    Color(0xFF00BCD4), Color(0xFF2196F3), Color(0xFF00BCD4), Color(0xFF2196F3),
    Color(0xFF4CAF50), Color(0xFFFFEB3B), Color(0xFFFFEB3B), Color(0xFF4CAF50),
    Color(0xFFFFEB3B), Color(0xFFFF9800), Color(0xFFFFEB3B), Color(0xFFFF9800),
  ];

  void update(List<PosePaintData> persons) {
    _persons = persons;
  }

  void clear() {
    _persons = [];
  }

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;
    for (final person in _persons) {
      final kp = person.keypoints;
      if (kp.isEmpty) continue;

      final pts = <int, Offset>{};
      double x1 = double.infinity, y1 = double.infinity, x2 = 0, y2 = 0;
      int vc = 0;

      for (int i = 0; i < kp.length && i < 17; i++) {
        if (i >= person.keypointConfidences.length || person.keypointConfidences[i] < 0.3) continue;
        final pt = Offset(kp[i].x, kp[i].y);
        pts[i] = pt;
        if (pt.dx < x1) x1 = pt.dx;
        if (pt.dy < y1) y1 = pt.dy;
        if (pt.dx > x2) x2 = pt.dx;
        if (pt.dy > y2) y2 = pt.dy;
        vc++;
      }

      _drawSkeleton(canvas, pts);

      final dp = Paint()..style = PaintingStyle.fill..color = const Color(0xFF00E676);
      final db = Paint()..style = PaintingStyle.stroke..strokeWidth = 1.5..color = Colors.white.withValues(alpha: 0.85);
      for (final p in pts.values) {
        canvas.drawCircle(p, 4.5, db);
        canvas.drawCircle(p, 3.5, dp);
      }

      if (vc >= 4) {
        _drawBBox(canvas, size, x1, y1, x2, y2, person.isFallen, person.confidence);
      }
    }
  }

  void _drawSkeleton(Canvas canvas, Map<int, Offset> pts) {
    for (int i = 0; i < _bones.length; i++) {
      final a = pts[_bones[i][0]], b = pts[_bones[i][1]];
      if (a == null || b == null) continue;
      final color = _boneColors[i];
      final glow = Paint()..style = PaintingStyle.stroke..strokeWidth = 6..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4)..color = color.withValues(alpha: 0.35);
      final line = Paint()..style = PaintingStyle.stroke..strokeWidth = 2.5..color = color.withValues(alpha: 0.85);
      canvas.drawLine(a, b, glow);
      canvas.drawLine(a, b, line);
    }
  }

  void _drawBBox(Canvas canvas, Size size, double x1, double y1, double x2, double y2, bool fallen, double confidence) {
    final px = (x2 - x1) * 0.06;
    final py = (y2 - y1) * 0.06;
    x1 = (x1 - px).clamp(0, size.width);
    y1 = (y1 - py).clamp(0, size.height);
    x2 = (x2 + px).clamp(0, size.width);
    y2 = (y2 + py).clamp(0, size.height);
    final arm = math.min(math.min((x2 - x1) * 0.35, (y2 - y1) * 0.35), 50.0);

    final color = fallen ? Colors.red : const Color(0xFF00E676);
    final a = fallen ? 0.6 : 0.5;

    final gl = Paint()..color = color.withValues(alpha: a)..strokeWidth = fallen ? 4 : 3..style = PaintingStyle.stroke..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6);
    final ln = Paint()..color = color..strokeWidth = fallen ? 3 : 2..style = PaintingStyle.stroke;

    void corner(double x, double y, double dx, double dy) {
      canvas.drawLine(Offset(x, y), Offset(x + dx, y + dy), gl);
      canvas.drawLine(Offset(x, y), Offset(x + dx, y + dy), ln);
    }

    corner(x1, y1, arm, 0);
    corner(x1, y1, 0, arm);
    corner(x2, y1, -arm, 0);
    corner(x2, y1, 0, arm);
    corner(x1, y2, 0, -arm);
    corner(x1, y2, arm, 0);
    corner(x2, y2, -arm, 0);
    corner(x2, y2, 0, -arm);

    final label = fallen ? 'FALLEN!' : 'Person';
    final tp = TextPainter(
      text: TextSpan(text: label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w800)),
      textDirection: TextDirection.ltr,
    )..layout();
    final bg = Paint()..color = Colors.black.withValues(alpha: 0.6);
    canvas.drawRRect(
      RRect.fromRectAndRadius(Rect.fromLTWH(x1 + arm + 2, y1, tp.width + 8, tp.height + 4), const Radius.circular(4)),
      bg,
    );
    tp.paint(canvas, Offset(x1 + arm + 5, y1 + 1));
  }

  @override
  bool shouldRepaint(covariant PosePainter oldDelegate) => true;
}
