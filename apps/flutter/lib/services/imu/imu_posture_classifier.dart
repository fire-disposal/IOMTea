import 'dart:math';

enum PostureState { unknown, standing, sitting, lying, upsideDown }

class ImuPostureClassifier {
  PostureState _current = PostureState.unknown;
  int _stateFrames = 0;
  static const _confirmFrames = 15;
  static const _bufferSize = 32;

  final List<double> _axBuf = [];
  final List<double> _ayBuf = [];
  final List<double> _azBuf = [];

  PostureState get current => _current;

  PostureState? feed(double ax, double ay, double az) {
    _axBuf.add(ax);
    _ayBuf.add(ay);
    _azBuf.add(az);
    while (_axBuf.length > _bufferSize) {
      _axBuf.removeAt(0);
      _ayBuf.removeAt(0);
      _azBuf.removeAt(0);
    }
    if (_axBuf.length < _bufferSize) return null;

    final axMean = _axBuf.reduce((a, b) => a + b) / _axBuf.length;
    final ayMean = _ayBuf.reduce((a, b) => a + b) / _ayBuf.length;
    final azMean = _azBuf.reduce((a, b) => a + b) / _azBuf.length;

    final tiltDeg = _tiltAngle(axMean, ayMean, azMean);

    PostureState detected;
    if (tiltDeg.abs() < 25) {
      detected = PostureState.standing;
    } else if (tiltDeg.abs() < 65) {
      detected = PostureState.sitting;
    } else if (tiltDeg > 65) {
      detected = tiltDeg > 150 ? PostureState.upsideDown : PostureState.lying;
    } else {
      detected = PostureState.unknown;
    }

    return _transition(detected);
  }

  double _tiltAngle(double ax, double ay, double az) {
    final horiz = sqrt(ax * ax + az * az);
    if (horiz < 0.01) return ay > 0 ? 0 : 180;
    return atan2(ay, horiz) * 180 / pi;
  }

  PostureState? _transition(PostureState detected) {
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
    _axBuf.clear();
    _ayBuf.clear();
    _azBuf.clear();
    _current = PostureState.unknown;
    _stateFrames = 0;
  }
}
