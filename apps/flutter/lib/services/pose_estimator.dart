import 'package:flutter/foundation.dart';
import 'package:google_mlkit_pose_detection/google_mlkit_pose_detection.dart';

class Keypoint {
  final double x, y, score;
  const Keypoint(this.x, this.y, this.score);
}

class PoseResult {
  final List<Keypoint> keypoints;
  const PoseResult(this.keypoints);
}

class PoseEstimator {
  PoseDetector? _detector;
  bool _loaded = false;

  Future<void> load() async {
    _detector = PoseDetector(
      options: PoseDetectorOptions(
        mode: PoseDetectionMode.stream,
        model: PoseDetectionModel.base,
      ),
    );
    _loaded = true;
  }

  bool get isLoaded => _loaded;

  Future<PoseResult?> processImage(InputImage inputImage) async {
    if (!_loaded || _detector == null) return null;
    try {
      final poses = await _detector!.processImage(inputImage);
      if (poses.isEmpty) return null;
      return _mapPose(poses.first);
    } catch (e) {
      debugPrint('ML Kit error: $e');
      return null;
    }
  }

  PoseResult _mapPose(Pose pose) {
    final lm = pose.landmarks;
    return PoseResult([
      _kp(lm, PoseLandmarkType.nose),
      _kp(lm, PoseLandmarkType.leftEye),
      _kp(lm, PoseLandmarkType.rightEye),
      _kp(lm, PoseLandmarkType.leftEar),
      _kp(lm, PoseLandmarkType.rightEar),
      _kp(lm, PoseLandmarkType.leftShoulder),
      _kp(lm, PoseLandmarkType.rightShoulder),
      _kp(lm, PoseLandmarkType.leftElbow),
      _kp(lm, PoseLandmarkType.rightElbow),
      _kp(lm, PoseLandmarkType.leftWrist),
      _kp(lm, PoseLandmarkType.rightWrist),
      _kp(lm, PoseLandmarkType.leftHip),
      _kp(lm, PoseLandmarkType.rightHip),
      _kp(lm, PoseLandmarkType.leftKnee),
      _kp(lm, PoseLandmarkType.rightKnee),
      _kp(lm, PoseLandmarkType.leftAnkle),
      _kp(lm, PoseLandmarkType.rightAnkle),
    ]);
  }

  Keypoint _kp(Map<PoseLandmarkType, PoseLandmark> lm, PoseLandmarkType type) {
    final l = lm[type];
    if (l == null) return const Keypoint(0, 0, 0);
    return Keypoint(l.x, l.y, l.likelihood);
  }

  void dispose() => _detector?.close();
}
