class ImuStepCounter {
  int _steps = 0;
  bool _wasAbove = false;
  int _stepCooldown = 0;

  static const _threshold = 10.8;
  static const _minInterval = 8;

  int get steps => _steps;

  bool feed(double mag) {
    if (_stepCooldown > 0) {
      _stepCooldown--;
      return false;
    }

    final above = mag > _threshold;
    if (above && !_wasAbove) {
      _wasAbove = true;
      _steps++;
      _stepCooldown = _minInterval;
      return true;
    }
    _wasAbove = above;
    return false;
  }

  void reset() {
    _steps = 0;
    _wasAbove = false;
    _stepCooldown = 0;
  }
}
