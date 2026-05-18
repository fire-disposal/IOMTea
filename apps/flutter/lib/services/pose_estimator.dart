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

    final input = _preprocess(bytes, w, h);
    final output = List.filled(1 * 17 * 3, 0.0).reshape([1, 17, 3]);
    _interpreter!.run(input, output);

    final kps = <Keypoint>[];
    for (int i = 0; i < 17; i++) {
      kps.add(Keypoint(
        (output[0][i][1] as num).toDouble(),
        (output[0][i][0] as num).toDouble(),
        (output[0][i][2] as num).toDouble(),
      ));
    }
    return PoseResult(kps);
  }

  Float32List _preprocess(ByteData bytes, int w, int h) {
    final input = Float32List(1 * 192 * 192 * 3);
    for (int py = 0; py < 192; py++) {
      for (int px = 0; px < 192; px++) {
        final sx = (px * w / 192).floor().clamp(0, w - 1);
        final sy = (py * h / 192).floor().clamp(0, h - 1);
        final si = (sy * w + sx) * 4;
        final di = (py * 192 + px) * 3;
        input[di] = bytes.getUint8(si).toDouble() / 127.5 - 1.0;
        input[di + 1] = bytes.getUint8(si + 1).toDouble() / 127.5 - 1.0;
        input[di + 2] = bytes.getUint8(si + 2).toDouble() / 127.5 - 1.0;
      }
    }
    return input;
  }

  void dispose() => _interpreter?.close();
}