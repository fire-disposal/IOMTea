class FallDetector {
  static const _windowSize = 30;
  static const _fallThreshold = 25.0;
  static const _freeFallLow = 0.3;
  static const _impactHigh = 15.0;
  static const _cooldownMs = 5000;

  final List<double> _buffer = [];
  int _lastEventTime = 0;
  bool _possibleFall = false;

  bool feed(double accelMagnitude) {
    _buffer.add(accelMagnitude);
    if (_buffer.length > _windowSize) _buffer.removeAt(0);
    if (_buffer.length < _windowSize) return false;

    final now = DateTime.now().millisecondsSinceEpoch;
    if (now - _lastEventTime < _cooldownMs) return false;

    final svm = _buffer.reduce((a, b) => a + b) / _buffer.length;
    final variance = _buffer.map((v) => (v - svm) * (v - svm)).reduce((a, b) => a + b) / _buffer.length;

    if (svm < _freeFallLow) {
      _possibleFall = true;
      return false;
    }

    if (_possibleFall && svm > _impactHigh) {
      _possibleFall = false;
      _lastEventTime = now;
      return true;
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
    _possibleFall = false;
  }
}