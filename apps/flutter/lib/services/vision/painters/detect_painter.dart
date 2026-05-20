import 'package:flutter/material.dart';
import 'package:ultralytics_yolo/ultralytics_yolo.dart';

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
  'person': Colors.green,
  'chair': Colors.blue,
  'couch': Colors.blue,
  'bed': Colors.purple,
  'dining table': Colors.orange,
  'table': Colors.orange,
  'tv': Colors.cyan,
  'laptop': Colors.yellow,
  'cell phone': Colors.yellow,
  'book': Colors.brown,
  'bottle': Colors.teal,
  'cup': Colors.teal,
};

Color _colorForClass(String name) => _classColors[name] ?? Colors.grey;

class DetectPainter extends CustomPainter {
  List<DetectPaintData> _objects = [];
  double _scaleX = 1, _scaleY = 1, _offsetX = 0, _offsetY = 0;

  void update(List<DetectPaintData> objects) {
    _objects = objects;
  }

  void setTransform(double scaleX, double scaleY, double offsetX, double offsetY) {
    _scaleX = scaleX;
    _scaleY = scaleY;
    _offsetX = offsetX;
    _offsetY = offsetY;
  }

  void clear() {
    _objects = [];
  }

  Offset _toScreen(double x, double y) {
    return Offset(x * _scaleX + _offsetX, y * _scaleY + _offsetY);
  }

  @override
  void paint(Canvas canvas, Size size) {
    for (final obj in _objects) {
      final color = _colorForClass(obj.className);
      final tl = _toScreen(obj.bbox.left, obj.bbox.top);
      final br = _toScreen(obj.bbox.right, obj.bbox.bottom);
      final rect = Rect.fromLTRB(tl.dx, tl.dy, br.dx, br.dy);

      final ln = Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2;
      canvas.drawRect(rect, ln);

      final label = '${obj.className} ${obj.confidence.toStringAsFixed(2)}';
      final tp = TextPainter(
        text: TextSpan(text: label, style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w600)),
        textDirection: TextDirection.ltr,
      )..layout();

      final bg = Paint()..color = color.withValues(alpha: 0.7);
      canvas.drawRect(Rect.fromLTWH(tl.dx, tl.dy - tp.height - 2, tp.width + 4, tp.height + 2), bg);
      tp.paint(canvas, Offset(tl.dx + 2, tl.dy - tp.height - 1));
    }
  }

  @override
  bool shouldRepaint(covariant DetectPainter oldDelegate) => true;
}
