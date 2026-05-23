import 'package:flutter/material.dart';

class DetectPaintData {
  final Rect bbox;
  final String className;
  final double confidence;

  const DetectPaintData({
    required this.bbox,
    required this.className,
    required this.confidence,
  });
}

const _classColors = <String, Color>{
  'person': Color(0xFF4CAF50),
  'chair': Color(0xFF2196F3),
  'couch': Color(0xFF2196F3),
  'bed': Color(0xFF9C27B0),
  'dining table': Color(0xFFFF9800),
  'table': Color(0xFFFF9800),
  'tv': Color(0xFF00BCD4),
  'laptop': Color(0xFFFFEB3B),
  'cell phone': Color(0xFFFFEB3B),
  'book': Color(0xFF795548),
  'bottle': Color(0xFF009688),
  'cup': Color(0xFF009688),
};

Color _colorForClass(String name) => _classColors[name] ?? Colors.grey;

class DetectPainter extends CustomPainter {
  List<DetectPaintData> _objects = [];

  void update(List<DetectPaintData> objects) {
    _objects = objects;
  }

  void clear() {
    _objects = [];
  }

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;
    for (final obj in _objects) {
      final color = _colorForClass(obj.className);
      final rect = obj.bbox;

      final outer = Paint()
        ..color = Colors.white.withValues(alpha: 0.5)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3.5;
      final inner = Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5;
      canvas.drawRect(rect, outer);
      canvas.drawRect(rect, inner);

      final label = '${obj.className} ${obj.confidence.toStringAsFixed(2)}';
      final tp = TextPainter(
        text: TextSpan(text: label, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: -0.2)),
        textDirection: TextDirection.ltr,
      )..layout();

      final bgRect = RRect.fromRectAndRadius(
        Rect.fromLTWH(rect.left, rect.top - tp.height - 4, tp.width + 8, tp.height + 4),
        const Radius.circular(4),
      );
      final bg = Paint()..color = color.withValues(alpha: 0.85);
      canvas.drawRRect(bgRect, bg);
      tp.paint(canvas, Offset(rect.left + 4, rect.top - tp.height - 2));
    }
  }

  @override
  bool shouldRepaint(covariant DetectPainter oldDelegate) => true;
}
