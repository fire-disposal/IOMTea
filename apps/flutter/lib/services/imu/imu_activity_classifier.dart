import 'dart:math';

class ImuFeatureWindow {
  final List<double> _accelMag = [];
  final List<double> _accelX = [];
  final List<double> _accelY = [];
  final List<double> _accelZ = [];
  final int _maxSamples;

  ImuFeatureWindow({int maxSamples = 64}) : _maxSamples = maxSamples;

  bool get isFull => _accelMag.length >= _maxSamples;

  void add(double ax, double ay, double az, double mag) {
    _accelMag.add(mag);
    _accelX.add(ax);
    _accelY.add(ay);
    _accelZ.add(az);
    while (_accelMag.length > _maxSamples) {
      _accelMag.removeAt(0);
      _accelX.removeAt(0);
      _accelY.removeAt(0);
      _accelZ.removeAt(0);
    }
  }

  void clear() {
    _accelMag.clear();
    _accelX.clear();
    _accelY.clear();
    _accelZ.clear();
  }

  double get mean => _accelMag.isEmpty ? 0 : _accelMag.reduce((a, b) => a + b) / _accelMag.length;
  double get stdDev {
    if (_accelMag.length < 2) return 0;
    final m = mean;
    final variance = _accelMag.map((v) => (v - m) * (v - m)).reduce((a, b) => a + b) / (_accelMag.length - 1);
    return sqrt(variance);
  }

  double get peakToPeak {
    if (_accelMag.isEmpty) return 0;
    return _accelMag.reduce(max) - _accelMag.reduce(min);
  }

  int get zeroCrossingRate {
    if (_accelMag.length < 2) return 0;
    int count = 0;
    final m = mean;
    for (int i = 1; i < _accelMag.length; i++) {
      if ((_accelMag[i - 1] - m) * (_accelMag[i] - m) < 0) count++;
    }
    return count;
  }

  double get entropyX {
    if (_accelX.length < 2) return 0;
    final hist = List.filled(10, 0);
    final mn = _accelX.reduce(min);
    final mx = _accelX.reduce(max);
    final step = (mx - mn) / 10;
    if (step <= 0) return 0;
    for (final v in _accelX) {
      final idx = ((v - mn) / step).floor().clamp(0, 9);
      hist[idx]++;
    }
    double e = 0;
    for (final c in hist) {
      if (c > 0) {
        final p = c / _accelX.length;
        e -= p * (log(p) / log(2));
      }
    }
    return e;
  }
}

enum ActivityState { unknown, stationary, walking, running }

class ImuActivityClassifier {
  final ImuFeatureWindow _window = ImuFeatureWindow(maxSamples: 64);
  ActivityState _current = ActivityState.unknown;
  int _stateFrames = 0;
  static const _confirmFrames = 10;

  ActivityState get current => _current;

  /// Returns the new activity state if it changed, null otherwise.
  ActivityState? feed(double ax, double ay, double az, double mag) {
    _window.add(ax, ay, az, mag);
    if (!_window.isFull) return null;

    final std = _window.stdDev;
    final mean = _window.mean;
    final pp = _window.peakToPeak;
    final zcr = _window.zeroCrossingRate;

    ActivityState detected;

    if (std < 0.35 && pp < 1.5) {
      detected = ActivityState.stationary;
    } else if (std > 2.0 && mean > 10.5 && zcr > _window._accelMag.length * 0.15) {
      detected = ActivityState.running;
    } else if (std > 0.6 && zcr > 1) {
      detected = ActivityState.walking;
    } else {
      detected = ActivityState.unknown;
    }

    return _transition(detected);
  }

  ActivityState? _transition(ActivityState detected) {
    if (detected == _current) {
      _stateFrames = 0;
      return null;
    }
    _stateFrames++;
    if (_stateFrames >= _confirmFrames) {
      _current = detected;
      _stateFrames = 0;
      return _current;
    }
    return null;
  }

  void reset() {
    _window.clear();
    _current = ActivityState.unknown;
    _stateFrames = 0;
  }
}
