import 'pose_estimator.dart';

enum ActionState { unknown, standing, sitting, lying, walking, fallen }

class ActionClassifier {
  static const _bufferSize = 8;
  ActionState _current = ActionState.unknown;
  ActionState? _prevState;
  final List<ActionState> _buffer = [];

  ActionState classify(PoseResult pose) {
    final kp = pose.keypoints;
    if (kp[5].score < 0.3 || kp[6].score < 0.3) return _current;

    final leftShoulder = kp[5];
    final rightShoulder = kp[6];
    final leftHip = kp[11];
    final rightHip = kp[12];
    final leftKnee = kp[13];
    final rightKnee = kp[14];
    final nose = kp[0];

    final shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
    final hipY = (leftHip.y + rightHip.y) / 2;
    final kneeY = (leftKnee.y + rightKnee.y) / 2;
    final torsoLength = (hipY - shoulderY).abs();
    if (torsoLength < 0.01) return _current;

    final torsoAngle = ((leftHip.x - leftShoulder.x).abs() / torsoLength).clamp(0.0, 1.0);
    final hipKneeRatio = (kneeY - hipY).abs() / torsoLength;
    final bodyHeight = (nose.y - kneeY).abs().clamp(0.01, double.infinity);
    final bodyLeanRatio = torsoLength / bodyHeight;

    ActionState detected;

    if (bodyLeanRatio < 0.25 && nose.y > hipY) {
      detected = ActionState.lying;
    } else if (hipKneeRatio < 0.4 && torsoAngle < 0.35) {
      detected = ActionState.sitting;
    } else if (torsoAngle < 0.35 && shoulderY < hipY) {
      detected = ActionState.standing;
    } else {
      detected = ActionState.walking;
    }

    _buffer.add(detected);
    if (_buffer.length > _bufferSize) _buffer.removeAt(0);
    if (_buffer.length < _bufferSize) return _current;

    final counts = <ActionState, int>{};
    for (final s in _buffer) { counts[s] = (counts[s] ?? 0) + 1; }
    final best = counts.entries.reduce((a, b) => a.value >= b.value ? a : b);

    if (best.value >= _bufferSize * 0.6 && best.key != _current) {
      _prevState = _current;
      _current = best.key;
    }

    return _current;
  }

  ActionState? popTransition() {
    final t = _prevState;
    _prevState = null;
    return t;
  }

  void reset() {
    _current = ActionState.unknown;
    _buffer.clear();
  }
}