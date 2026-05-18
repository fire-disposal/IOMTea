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
  bool _running = false;
  int _fallCount = 0;
  int _sampleCount = 0;
  final List<ImuData> _history = [];

  void _toggle() {
    if (_running) {
      _sub?.cancel(); _sub = null; _sensor.stop();
    } else {
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
            metadata: {'accel_magnitude': mag, 'sample_count': _sampleCount},
          ));
        }
        setState(() { _latest = d; _history.add(d); _sampleCount++; if (_history.length > 200) _history.removeAt(0); });
      });
    }
    setState(() => _running = !_running);
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
      ),
      body: Column(children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          color: Colors.white,
          child: Row(children: [
            Icon(Icons.watch, size: 16, color: matchaPrimary),
            const SizedBox(width: 6),
            Text(PinService.instance.currentPin?.pin ?? '未绑定', style: TextStyle(fontSize: 13, color: textSecondary)),
            const Spacer(),
            Container(width: 8, height: 8, decoration: BoxDecoration(shape: BoxShape.circle, color: connected ? successGreen : Colors.grey)),
            const SizedBox(width: 6),
            Text(connected ? 'MQTT 在线' : 'MQTT 离线', style: TextStyle(fontSize: 13, color: connected ? successGreen : Colors.grey)),
          ]),
        ),
        Expanded(
          child: ListView(padding: const EdgeInsets.all(16), children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
                  _StatCard(label: '状态', value: _running ? '监测中' : '已停止', color: _running ? successGreen : Colors.grey),
                  _StatCard(label: '样本', value: '$_sampleCount', color: textPrimary),
                  _StatCard(label: '跌倒', value: '$_fallCount', color: _fallCount > 0 ? errorRed : textSecondary),
                  _StatCard(label: '加速度', value: mag.toStringAsFixed(2), color: mag > 2.5 ? warningOrange : textPrimary),
                ]),
              ),
            ),
            const SizedBox(height: 12),
            if (_latest != null) ...[
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: SizedBox(height: 160, child: ImuWaveform(data: _history)),
                ),
              ),
              const SizedBox(height: 12),
              Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
                _Stat('X', _latest!.accelX), _Stat('Y', _latest!.accelY), _Stat('Z', _latest!.accelZ),
                _Stat('陀螺', _latest!.gyroMagnitude),
              ]),
            ] else
              const SizedBox(height: 160, child: Center(child: Text('点击开始监测', style: TextStyle(color: Colors.grey)))),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _toggle,
                icon: Icon(_running ? Icons.stop : Icons.play_arrow),
                label: Text(_running ? '停止监测' : '开始监测'),
              ),
            ),
          ]),
        ),
      ]),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label, value;
  final Color color;
  const _StatCard({required this.label, required this.value, required this.color});
  @override
  Widget build(BuildContext context) => Column(children: [
    Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: color)),
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