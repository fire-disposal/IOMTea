import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:ultralytics_yolo/ultralytics_yolo.dart';

class PosePaintData {
  final List<YOLOKeypoint> keypoints;
  final Rect bbox;
  final double confidence;
  final String state;
  final bool isFallen;

  const PosePaintData({
    required this.keypoints,
    required this.bbox,
    required this.confidence,
    required this.state,
    this.isFallen = false,
  });
}

class PosePainter extends CustomPainter {
  List<PosePaintData> _persons = [];
  double _scaleX = 1, _scaleY = 1, _offsetX = 0, _offsetY = 0;

  static const _bones = [
    [5, 7], [7, 9], [6, 8], [8, 10], [5, 6],
    [5, 11], [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  ];

  static const _boneColors = [
    Colors.cyan, Colors.blue, Colors.cyan, Colors.blue,
    Colors.green, Colors.yellow, Colors.yellow, Colors.green,
    Colors.yellow, Colors.orange, Colors.yellow, Colors.orange,
  ];

  void update(List<PosePaintData> persons) {
    _persons = persons;
  }

  void setTransform(double scaleX, double scaleY, double offsetX, double offsetY) {
    _scaleX = scaleX;
    _scaleY = scaleY;
    _offsetX = offsetX;
    _offsetY = offsetY;
  }

  void clear() {
    _persons = [];
  }

  Offset _toScreen(double x, double y) {
    return Offset(x * _scaleX + _offsetX, y * _scaleY + _offsetY);
  }

  @override
  void paint(Canvas canvas, Size size) {
    for (final person in _persons) {
      final kp = person.keypoints;
      if (kp.isEmpty) continue;

      final pts = <int, Offset>{};
      double x1 = double.infinity, y1 = double.infinity, x2 = 0, y2 = 0;
      int vc = 0;

      for (int i = 0; i < kp.length && i < 17; i++) {
        if (kp[i].confidence < 0.3) continue;
        final dx = kp[i].x, dy = kp[i].y;
        final pt = _toScreen(dx, dy);
        pts[i] = pt;
        if (pt.dx < x1) x1 = pt.dx;
        if (pt.dy < y1) y1 = pt.dy;
        if (pt.dx > x2) x2 = pt.dx;
        if (pt.dy > y2) y2 = pt.dy;
        vc++;
      }

      _drawSkeleton(canvas, pts);

      final dp = Paint()..style = PaintingStyle.fill..color = const Color(0xFF00E676);
      final db = Paint()..style = PaintingStyle.stroke..strokeWidth = 1..color = Colors.white70;
      for (final p in pts.values) {
        canvas.drawCircle(p, 3.5, db);
        canvas.drawCircle(p, 2.5, dp);
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
      final glow = Paint()..style = PaintingStyle.stroke..strokeWidth = 5..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3)..color = color.withValues(alpha: 0.3);
      final line = Paint()..style = PaintingStyle.stroke..strokeWidth = 2..color = color.withValues(alpha: 0.8);
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

    final gl = Paint()..color = color.withValues(alpha: 0.5)..strokeWidth = fallen ? 4 : 3..style = PaintingStyle.stroke..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6);
    final ln = Paint()..color = color..strokeWidth = fallen ? 3 : 2..style = PaintingStyle.stroke;

    canvas.drawLine(Offset(x1, y1), Offset(x1 + arm, y1), gl);
    canvas.drawLine(Offset(x1, y1), Offset(x1 + arm, y1), ln);
    canvas.drawLine(Offset(x1, y1), Offset(x1, y1 + arm), gl);
    canvas.drawLine(Offset(x1, y1), Offset(x1, y1 + arm), ln);
    // top-right corner
    canvas.drawLine(Offset(x2 - arm, y1), Offset(x2, y1), gl);
    canvas.drawLine(Offset(x2 - arm, y1), Offset(x2, y1), ln);
    canvas.drawLine(Offset(x2, y1), Offset(x2, y1 + arm), gl);
    canvas.drawLine(Offset(x2, y1), Offset(x2, y1 + arm), ln);
    // bottom-left corner
    canvas.drawLine(Offset(x1, y2 - arm), Offset(x1, y2), gl);
    canvas.drawLine(Offset(x1, y2 - arm), Offset(x1, y2), ln);
    canvas.drawLine(Offset(x1, y2), Offset(x1 + arm, y2), gl);
    canvas.drawLine(Offset(x1, y2), Offset(x1 + arm, y2), ln);
    // bottom-right corner
    canvas.drawLine(Offset(x2 - arm, y2), Offset(x2, y2), gl);
    canvas.drawLine(Offset(x2 - arm, y2), Offset(x2, y2), ln);
    canvas.drawLine(Offset(x2, y2 - arm), Offset(x2, y2), gl);
    canvas.drawLine(Offset(x2, y2 - arm), Offset(x2, y2), ln);

    final label = fallen ? 'FALLEN!' : 'Person';
    final tp = TextPainter(
      text: TextSpan(text: label, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700)),
      textDirection: TextDirection.ltr,
    )..layout();
    final bg = Paint()..color = Colors.black54;
    canvas.drawRect(Rect.fromLTWH(x1 + arm + 2, y1, tp.width + 6, tp.height + 2), bg);
    tp.paint(canvas, Offset(x1 + arm + 4, y1));
  }

  @override
  bool shouldRepaint(covariant PosePainter oldDelegate) => true;
}
