import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../services/imu_sensor_service.dart';
import '../services/fall_detector.dart';
import '../services/event_emitter.dart';
import '../services/pin_service.dart';
import '../services/mqtt_service.dart';
import '../widgets/imu_waveform.dart';
import '../widgets/terminal_log.dart';
import '../theme.dart';

class WearablePage extends StatefulWidget {
  const WearablePage({super.key});
  @override
  State<WearablePage> createState() => _WearablePageState();
}

class _WearablePageState extends State<WearablePage>
    with SingleTickerProviderStateMixin {
  final _sensor = ImuSensorService();
  final _detector = FallDetector();
  StreamSubscription<ImuData>? _sub;
  ImuData? _latest;
  int _fallCount = 0;
  int _sampleCount = 0;
  final List<ImuData> _history = [];
  final List<String> _log = [];
  double _maxMag = 5.0;

  @override
  void initState() {
    super.initState();
    _start();
  }

  void _start() {
    _sensor.start();
    _sub = _sensor.dataStream.listen((d) {
      final mag = d.accelMagnitude;
      final net = (mag - 9.8).abs();
      if (net > _maxMag) _maxMag = net;

      if (_detector.feed(mag)) {
        _fallCount++;
        _addLog('🆘 跌倒 | ${net.toStringAsFixed(1)} m/s²', error: true);
        final pin = PinService.instance.currentPin?.pin ?? '';
        EventEmitter.emit(DeviceEvent(
          type: DeviceEventType.fallDetected,
          pinCode: pin,
          confidence: 0.9,
          metadata: {'accel_magnitude': mag},
        ));
      }

      if (_sampleCount > 50 && net > 4.0 && _sampleCount % 30 == 0) {
        _addLog('⚠ 高冲击 | ${net.toStringAsFixed(1)} m/s²', warning: true);
      }
      if (_sampleCount > 50 && mag < 0.8 && _sampleCount % 20 == 0) {
        _addLog('🌊 疑似失重 | ${mag.toStringAsFixed(1)} m/s²', warning: true);
      }

      setState(() {
        _latest = d;
        _history.add(d);
        _sampleCount++;
        if (_history.length > 200) _history.removeAt(0);
      });
    });
  }

  void _addLog(String msg, {bool warning = false, bool error = false}) {
    final now = DateTime.now();
    final ts = '${now.hour.toString().padLeft(2, "0")}:${now.minute.toString().padLeft(2, "0")}:${now.second.toString().padLeft(2, "0")}';
    final line = error ? '$ts $msg' : '$ts $msg';
    setState(() {
      _log.insert(0, line);
      if (_log.length > 100) _log.removeLast();
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    _sensor.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final mag = _latest?.accelMagnitude ?? 0;
    final connected = MqttService.instance.currentStatus.name == 'connected';

    return Scaffold(
      backgroundColor: creamBg,
      appBar: AnimatedGradientAppBar(
        title: '可穿戴监测',
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
            _buildUnifiedStatsCard(mag),
            Expanded(
              child: CustomScrollView(
                slivers: [
                  SliverToBoxAdapter(child: _buildWaveformCard()),
                  const SliverToBoxAdapter(child: SizedBox(height: 8)),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: TerminalLog(
                        entries: _log,
                        onClear: () => setState(() => _log.clear()),
                        maxHeight: 200,
                      ),
                    ),
                  ),
                  const SliverToBoxAdapter(child: SizedBox(height: 32)),
                ],
              ),
            ),
          ]),
    );
  }

  Widget _buildUnifiedStatsCard(double mag) {
    final net = (mag - 9.8).abs();
    final pct = (net / _maxMag).clamp(0.0, 1.0);
    final d = _latest!;
    return AppSectionCard(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Column(children: [
        Row(children: [
          _StatPill(label: '净加速度', value: '${net.toStringAsFixed(2)} m/s²', color: net > 3.0 ? warningOrange : matchaPrimary),
          const Spacer(),
          _StatPill(label: '样本', value: '$_sampleCount', color: textPrimary),
          const Spacer(),
          _StatPill(label: '跌倒', value: '$_fallCount', color: _fallCount > 0 ? errorRed : textSecondary),
        ]),
        const SizedBox(height: 10),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: pct,
            backgroundColor: Colors.grey.shade100,
            valueColor: AlwaysStoppedAnimation<Color>(net > 3.0 ? warningOrange : matchaPrimary),
            minHeight: 6,
          ),
        ),
        const SizedBox(height: 4),
        Row(children: [
          Text('0', style: TextStyle(fontSize: 10, color: textSecondary)),
          const Spacer(),
          Text('${_maxMag.toStringAsFixed(1)} m/s²', style: TextStyle(fontSize: 10, color: textSecondary)),
        ]),
        const Divider(height: 28),
        Row(children: [
          _GaugeStat(label: 'X', value: d.accelX, maxVal: 20),
          _GaugeStat(label: 'Y', value: d.accelY, maxVal: 20),
          _GaugeStat(label: 'Z', value: d.accelZ, maxVal: 20),
        ]),
        const SizedBox(height: 12),
        Row(children: [
          _GaugeStat(label: 'GX', value: d.gyroX, maxVal: 10),
          _GaugeStat(label: 'GY', value: d.gyroY, maxVal: 10),
          _GaugeStat(label: 'GZ', value: d.gyroZ, maxVal: 10),
        ]),
      ]),
    );
  }

  Widget _buildWaveformCard() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: Container(
          height: 140,
          color: Colors.white,
          child: Padding(
            padding: const EdgeInsets.all(8),
            child: ImuWaveform(data: _history),
          ),
        ),
      ),
    );
  }
}

class _StatPill extends StatelessWidget {
  final String label, value;
  final Color color;
  const _StatPill({required this.label, required this.value, required this.color});
  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: color, letterSpacing: -0.5)),
      const SizedBox(height: 2),
      Text(label, style: TextStyle(fontSize: 11, color: textSecondary)),
    ]);
  }
}

class _GaugeStat extends StatelessWidget {
  final String label; final double value; final double maxVal;
  const _GaugeStat({required this.label, required this.value, required this.maxVal});
  @override
  Widget build(BuildContext context) {
    final pct = (value.abs() / maxVal).clamp(0.0, 1.0);
    final absVal = value.abs();
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6),
        child: Column(children: [
          Text(value.toStringAsFixed(1), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, fontFamily: 'monospace')),
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: BorderRadius.circular(3),
            child: LinearProgressIndicator(
              value: pct,
              backgroundColor: Colors.grey.shade100,
              valueColor: AlwaysStoppedAnimation<Color>(
                absVal > maxVal * 0.7 ? warningOrange : matchaPrimary,
              ),
              minHeight: 4,
            ),
          ),
          const SizedBox(height: 4),
          Text(label, style: TextStyle(fontSize: 11, color: textSecondary, fontWeight: FontWeight.w600)),
        ]),
      ),
    );
  }
}

