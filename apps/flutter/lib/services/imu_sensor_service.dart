import 'dart:async';
import 'dart:math';
import 'package:sensors_plus/sensors_plus.dart';

class ImuData {
  final DateTime timestamp;
  final double accelX, accelY, accelZ;
  final double gyroX, gyroY, gyroZ;
  double get accelMagnitude => sqrt(accelX * accelX + accelY * accelY + accelZ * accelZ);
  double get gyroMagnitude => sqrt(gyroX * gyroX + gyroY * gyroY + gyroZ * gyroZ);

  ImuData({
    required this.timestamp,
    this.accelX = 0, this.accelY = 0, this.accelZ = 0,
    this.gyroX = 0, this.gyroY = 0, this.gyroZ = 0,
  });
}

class ImuSensorService {
  StreamSubscription<AccelerometerEvent>? _accel;
  StreamSubscription<GyroscopeEvent>? _gyro;
  final _ctrl = StreamController<ImuData>.broadcast();
  Stream<ImuData> get dataStream => _ctrl.stream;

  double _ax = 0, _ay = 0, _az = 0, _gx = 0, _gy = 0, _gz = 0;
  Timer? _timer;

  void start() {
    _accel = accelerometerEventStream().listen((e) { _ax = e.x; _ay = e.y; _az = e.z; });
    _gyro = gyroscopeEventStream().listen((e) { _gx = e.x; _gy = e.y; _gz = e.z; });
    _timer = Timer.periodic(const Duration(milliseconds: 50), (_) {
      _ctrl.add(ImuData(timestamp: DateTime.now(), accelX: _ax, accelY: _ay, accelZ: _az, gyroX: _gx, gyroY: _gy, gyroZ: _gz));
    });
  }

  void stop() { _accel?.cancel(); _gyro?.cancel(); _timer?.cancel(); }

  Future<ImuData?> readOnce() async {
    final completer = Completer<ImuData?>();
    late StreamSubscription<ImuData> sub;
    sub = dataStream.listen((data) {
      if (!completer.isCompleted) {
        completer.complete(data);
      }
    });
    start();
    final result = await completer.future.timeout(
      const Duration(seconds: 2),
      onTimeout: () => null,
    );
    await sub.cancel();
    stop();
    return result;
  }

  void dispose() { stop(); _ctrl.close(); }
}
