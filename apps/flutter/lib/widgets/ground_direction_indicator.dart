import 'dart:math' as math;
import 'package:flutter/material.dart';

class GroundDirectionIndicator extends StatelessWidget {
  final String direction;
  final double angle;
  final VoidCallback? onTap;

  const GroundDirectionIndicator({
    super.key,
    required this.direction,
    required this.angle,
    this.onTap,
  });

  double get _rotation => switch (direction) {
    'portraitUp' => math.pi,
    'landscapeLeft' => -math.pi / 2,
    'landscapeRight' => math.pi / 2,
    'custom' => angle * math.pi / 180,
    _ => 0,
  };

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: Colors.black54,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: Colors.white24, width: 0.5),
        ),
        child: Transform.rotate(
          angle: _rotation,
          child: const Icon(Icons.arrow_upward, color: Color(0xFF81C784), size: 20),
        ),
      ),
    );
  }
}
