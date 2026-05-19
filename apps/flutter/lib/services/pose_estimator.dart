import 'dart:typed_data';
import 'package:tflite_flutter/tflite_flutter.dart';

class Keypoint {
  final double x, y, score;
  const Keypoint(this.x, this.y, this.score);
}

class PoseResult {
  final List<Keypoint> keypoints;
  const PoseResult(this.keypoints);
}

class PoseEstimator {
  static const _inputSize = 192;
  static const _numKeypoints = 17;
  static const _outputDims = 3;

  Interpreter? _interpreter;
  bool _loaded = false;

  Future<void> load({String modelPath = 'assets/models/movenet_lightning.tflite'}) async {
    _interpreter = await Interpreter.fromAsset(modelPath,
      options: InterpreterOptions()..threads = 4,
    );
    _loaded = true;
  }

  bool get isLoaded => _loaded;

  PoseResult? estimate(ByteData bytes, int w, int h) {
    if (!_loaded || _interpreter == null) return null;
    if (w <= 0 || h <= 0) return null;

    final input = _preprocess(bytes, w, h);
    final flat = Float32List(_numKeypoints * _outputDims);
    _interpreter!.run(input, flat);

    final kps = <Keypoint>[];
    for (int i = 0; i < _numKeypoints; i++) {
      final idx = i * _outputDims;
      kps.add(Keypoint(
        flat[idx + 1].toDouble(),
        flat[idx + 0].toDouble(),
        flat[idx + 2].toDouble(),
      ));
    }
    return PoseResult(kps);
  }

  Float32List _preprocess(ByteData bytes, int w, int h) {
    final input = Float32List(1 * _inputSize * _inputSize * 3);
    for (int py = 0; py < _inputSize; py++) {
      for (int px = 0; px < _inputSize; px++) {
        final sx = (px * w / _inputSize).floor().clamp(0, w - 1);
        final sy = (py * h / _inputSize).floor().clamp(0, h - 1);
        final si = (sy * w + sx) * 4;
        final di = (py * _inputSize + px) * 3;
        input[di] = bytes.getUint8(si).toDouble() / 127.5 - 1.0;
        input[di + 1] = bytes.getUint8(si + 1).toDouble() / 127.5 - 1.0;
        input[di + 2] = bytes.getUint8(si + 2).toDouble() / 127.5 - 1.0;
      }
    }
    return input;
  }

  void dispose() => _interpreter?.close();
}