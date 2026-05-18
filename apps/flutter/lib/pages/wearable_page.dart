import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../services/imu_sensor_service.dart';
import '../services/fall_detector.dart';
import '../services/event_emitter.dart';
import '../services/pin_service.dart';
import '../services/mqtt_service.dart';
import '../widgets/imu_waveform.dart';
import '../theme.dart';

class WearablePage extends StatefulWidget {
  const WearablePage({super.key});
  @override
  State<WearablePage> createState() => _WearablePageState();
}

class _WearablePageState extends State<WearablePage> {
  final _sensor = ImuSensorService();
  final _detector = FallDetector();
  StreamSubscription<ImuData>? _sub;
  ImuData? _latest;
  int _fallCount = 0;
  int _sampleCount = 0;
  final List<ImuData> _history = [];

  @override
  void initState() {
    super.initState();
    _start();
  }

  void _start() {
    _sensor.start();
    _sub = _sensor.dataStream.listen((d) {
      final mag = d.accelMagnitude;
      if (_detector.feed(mag)) {
        _fallCount++;
        final pin = PinService.instance.currentPin?.pin ?? '';
        EventEmitter.emit(DeviceEvent(
          type: DeviceEventType.fallDetected,
          pinCode: pin,
          confidence: 0.9,
          metadata: {'accel_magnitude': mag},
        ));
      }
      setState(() { _latest = d; _history.add(d); _sampleCount++; if (_history.length > 200) _history.removeAt(0); });
    });
  }

  @override
  void dispose() { _sub?.cancel(); _sensor.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final mag = _latest?.accelMagnitude ?? 0;
    final connected = MqttService.instance.currentStatus.name == 'connected';

    return Scaffold(
      backgroundColor: creamBg,
      appBar: AppBar(
        title: const Text('可穿戴监测'),
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop()),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Container(width: 6, height: 6, decoration: BoxDecoration(shape: BoxShape.circle, color: connected ? successGreen : Colors.grey)),
              const SizedBox(width: 4),
              Text(connected ? '在线' : '离线', style: TextStyle(fontSize: 12, color: connected ? successGreen : Colors.grey)),
            ]),
          ),
        ],
      ),
      body: _latest == null
        ? const Center(child: CircularProgressIndicator())
        : Column(children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            color: Colors.white,
            child: Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
              _MiniStat('加速度', '${mag.toStringAsFixed(2)} m/s²', mag > 2.5 ? warningOrange : textPrimary),
              _MiniStat('样本', '$_sampleCount', textPrimary),
              _MiniStat('跌倒', '$_fallCount', _fallCount > 0 ? errorRed : textSecondary),
            ]),
          ),
          Expanded(
            child: Column(children: [
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
                  _Stat('X', _latest!.accelX), _Stat('Y', _latest!.accelY), _Stat('Z', _latest!.accelZ),
                ]),
              ),
              const SizedBox(height: 16),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Container(color: Colors.white, child: ImuWaveform(data: _history)),
                  ),
                ),
              ),
            ]),
          ),
        ]),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label, value;
  final Color color;
  const _MiniStat(this.label, this.value, this.color);
  @override
  Widget build(BuildContext context) => Column(children: [
    Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: color)),
    Text(label, style: TextStyle(fontSize: 11, color: textSecondary)),
  ]);
}

class _Stat extends StatelessWidget {
  final String label; final double value;
  const _Stat(this.label, this.value);
  @override
  Widget build(BuildContext context) => Column(children: [
    Text(label, style: const TextStyle(color: Colors.grey, fontSize: 12)),
    Text(value.toStringAsFixed(2), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
  ]);
}