import 'dart:math';

class FallDetector {
  static const _windowSize = 30;
  static const _fallThreshold = 25.0;
  static const _freeFallLow = 0.3;
  static const _impactHigh = 15.0;
  static const _cooldownMs = 5000;
  static const _postImpactStill = 0.6;
  static const _postImpactFrames = 10;

  final List<double> _buffer = [];
  final List<double> _orientBuf = [];
  int _lastEventTime = 0;
  bool _possibleFall = false;
  int _postImpactCounter = 0;

  bool feed(double accelMagnitude, {double ax = 0, double ay = 0, double az = 0}) {
    _buffer.add(accelMagnitude);
    if (_buffer.length > _windowSize) _buffer.removeAt(0);

    final horiz = sqrt(ax * ax + az * az);
    final tilt = horiz < 0.01 ? (ay > 0 ? 0.0 : 180.0) : atan2(ay, horiz) * 180 / pi;
    _orientBuf.add(tilt);
    if (_orientBuf.length > _windowSize) _orientBuf.removeAt(0);

    if (_buffer.length < _windowSize) return false;

    final now = DateTime.now().millisecondsSinceEpoch;
    if (now - _lastEventTime < _cooldownMs) return false;

    final svm = _buffer.reduce((a, b) => a + b) / _buffer.length;
    final variance = _buffer.map((v) => (v - svm) * (v - svm)).reduce((a, b) => a + b) / _buffer.length;

    if (_postImpactCounter > 0) {
      _postImpactCounter--;
      if (_postImpactCounter <= 0 && svm < _postImpactStill) {
        _lastEventTime = now;
        return true;
      }
    }

    if (svm < _freeFallLow) {
      _possibleFall = true;
      return false;
    }

    if (_possibleFall && svm > _impactHigh) {
      _possibleFall = false;
      _postImpactCounter = _postImpactFrames;
      return false;
    }

    if (variance > _fallThreshold && svm > 2.0) {
      _possibleFall = false;
      _lastEventTime = now;
      return true;
    }

    _possibleFall = false;
    return false;
  }

  void reset() {
    _buffer.clear();
    _orientBuf.clear();
    _possibleFall = false;
    _postImpactCounter = 0;
  }
}
