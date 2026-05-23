import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:http/http.dart' as http;
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/mqtt_service.dart';
import '../services/pin_service.dart';
import '../theme.dart';
import 'pin_setup_page.dart';

enum _HealthMode { cardiac, vital, activity, alert }

const _modeMeta = {
  _HealthMode.cardiac: (_ModeInfo('心血管', Icons.favorite, infoBlue)),
  _HealthMode.vital: (_ModeInfo('生命体征', Icons.monitor_heart, matchaPrimary)),
  _HealthMode.activity: (_ModeInfo('活动状态', Icons.directions_walk, warningOrange)),
  _HealthMode.alert: (_ModeInfo('告警事件', Icons.warning_amber, errorRed)),
};

class _ModeInfo {
  final String label;
  final IconData icon;
  final Color color;
  const _ModeInfo(this.label, this.icon, this.color);
}

class _MetricDef {
  final String key, unit;
  final double min, max, normal;
  const _MetricDef(this.key, this.unit, this.min, this.max, this.normal);
}

const _modeMetrics = <_HealthMode, List<_MetricDef>>{
  _HealthMode.cardiac: [
    _MetricDef('heart_rate', 'bpm', 50, 180, 72),
    _MetricDef('spo2', '%', 85, 100, 98),
    _MetricDef('resp_rate', 'rpm', 8, 30, 16),
    _MetricDef('ecg_waveform', 'mV', -2, 4, 0),
  ],
  _HealthMode.vital: [
    _MetricDef('temperature', '°C', 35.0, 42.0, 36.6),
    _MetricDef('systolic_bp', 'mmHg', 80, 200, 120),
    _MetricDef('diastolic_bp', 'mmHg', 50, 130, 80),
    _MetricDef('glucose', 'mmol/L', 3.0, 15.0, 5.5),
    _MetricDef('weight', 'kg', 30, 200, 70),
  ],
  _HealthMode.activity: [
    _MetricDef('motion_index', '', 0, 100, 10),
    _MetricDef('posture', '', 0, 3, 1),
    _MetricDef('bed_status', '', 0, 1, 0),
    _MetricDef('pressure_grid', 'kPa', 0, 50, 5),
  ],
  _HealthMode.alert: [
    _MetricDef('fall_detected', '', 0, 1, 0),
    _MetricDef('medication_taken', '', 0, 1, 1),
    _MetricDef('medication_missed', '', 0, 1, 0),
  ],
};

final _rng = math.Random();

class SimulatorPage extends StatefulWidget {
  const SimulatorPage({super.key});
  @override
  State<SimulatorPage> createState() => _SimulatorPageState();
}

class _SimulatorPageState extends State<SimulatorPage> {
  final _log = <String>[];
  _HealthMode _mode = _HealthMode.cardiac;
  bool _pumping = false;
  String _roomId = '';
  Timer? _pumpTimer;
  int _batchCount = 0;
  bool _pinBannerDismissed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    _roomId = prefs.getString('bound_room_id') ?? '';
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _pumpTimer?.cancel();
    super.dispose();
  }

  double _genValue(_MetricDef def) {
    final noise = (_rng.nextDouble() - 0.5) * (def.max - def.min) * 0.15;
    return (def.normal + noise).clamp(def.min, def.max);
  }

  Future<void> _sendMetric(String metric, double value, String unit) async {
    final pin = PinService.instance.currentPin?.pin;
    final deviceId = PinService.instance.deviceId;
    final payload = <String, dynamic>{
      'pin': pin,
      'deviceId': deviceId,
      'event': metric == 'fall_detected' && value > 0.5 ? 'healthAlert' : 'healthObservation',
      'metric': metric,
      'value': value,
      'unit': unit,
      'source': 'simulator',
      'roomId': _roomId.isEmpty ? null : _roomId,
    };
    if (payload['event'] == 'healthAlert') payload['severity'] = 'warning';

    if (MqttService.instance.currentStatus.name == 'connected') {
      final topicId = payload['pin'] ?? payload['deviceId'] ?? 'unknown';
      try {
        MqttService.instance.publish(
          topic: 'iomtea/device/$topicId/events',
          message: jsonEncode(payload),
        );
      } catch (_) {}
    }
    unawaited(_httpPost(jsonEncode(payload)));
  }

  Future<void> _httpPost(String body) async {
    try {
      await http.post(
        Uri.parse('${PinService.instance.serverUrl}/trpc/homeGraph.reportDeviceEvent'),
        headers: {'Content-Type': 'application/json'},
        body: body,
      ).timeout(const Duration(seconds: 3));
    } catch (_) {}
  }

  void _addLog(String msg) {
    setState(() {
      _log.insert(0, msg);
      if (_log.length > 80) _log.removeLast();
    });
  }

  void _togglePumping() {
    if (_pumping) {
      _pumpTimer?.cancel();
      _pumping = false;
      _batchCount = 0;
      _addLog('⏹ 数据流已停止');
    } else {
      _pumping = true;
      _batchCount = 0;
      _pumpTimer = Timer.periodic(const Duration(milliseconds: 800), (_) {
        if (!_pumping) return;
        _batchCount++;
        final defs = _modeMetrics[_mode]!;
        for (final d in defs) {
          final v = _genValue(d);
          unawaited(_sendMetric(d.key, v, d.unit));
        }
        if (_batchCount % 5 == 0) {
          _addLog('📤 #$_batchCount · ${_modeMeta[_mode]!.label} · ${defs.length}项');
        }
      });
      _addLog('▶ 数据流已启动 · ${_modeMeta[_mode]!.label}模式');
    }
    setState(() {});
  }

  void _sendSingleShot() {
    final defs = _modeMetrics[_mode]!;
    for (final d in defs) {
      final v = _genValue(d);
      _sendMetric(d.key, v, d.unit);
    }
    _addLog('📤 单次发送 · ${_modeMeta[_mode]!.label} · ${defs.length}项');
  }

  Future<void> _openPinSetup() async {
    await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const PinSetupPage()),
    );
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final connected = MqttService.instance.currentStatus.name == 'connected';
    final hasPin = PinService.instance.hasPin;

    return Scaffold(
      backgroundColor: creamBg,
      appBar: AnimatedGradientAppBar(
        title: '事件模拟器',
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Container(width: 6, height: 6, decoration: BoxDecoration(shape: BoxShape.circle, color: connected ? successGreen : Colors.grey)),
              const SizedBox(width: 4),
              Text(connected ? 'MQTT在线' : 'MQTT离线', style: TextStyle(fontSize: 11, color: connected ? successGreen : Colors.grey)),
            ]),
          ),
        ],
      ),
      body: Column(children: [
        if (!hasPin && !_pinBannerDismissed)
          _buildPinBanner()
              .animate()
              .slideY(begin: -1, duration: 300.ms)
              .fadeIn(duration: 200.ms),
        _buildModeSelector()
            .animate()
            .fadeIn(delay: 50.ms, duration: 300.ms),
        Expanded(
          child: ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 16), children: [
            _buildMetricsCard()
                .animate()
                .fadeIn(delay: 100.ms, duration: 300.ms)
                .slideY(begin: 0.05, duration: 300.ms),
            const SizedBox(height: 12),
            _buildControls()
                .animate()
                .fadeIn(delay: 200.ms, duration: 300.ms)
                .slideY(begin: 0.05, duration: 300.ms),
          ]),
        ),
        _buildLogPanel(),
      ]),
    );
  }

  Widget _buildPinBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      color: warningOrange.withValues(alpha: 0.08),
      child: Row(children: [
        const Icon(Icons.info_outline, size: 14, color: warningOrange),
        const SizedBox(width: 8),
        Expanded(
          child: Text('未设置PIN码，事件将匿名上报', style: TextStyle(fontSize: 12, color: textSecondary)),
        ),
        SizedBox(
          height: 28,
          child: TextButton(
            onPressed: _openPinSetup,
            style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 8), minimumSize: Size.zero, tapTargetSize: MaterialTapTargetSize.shrinkWrap),
            child: const Text('去设置', style: TextStyle(fontSize: 12)),
          ),
        ),
        GestureDetector(
          onTap: () => setState(() => _pinBannerDismissed = true),
          child: const Padding(
            padding: EdgeInsets.all(4),
            child: Icon(Icons.close, size: 14, color: textSecondary),
          ),
        ),
      ]),
    );
  }

  Widget _buildModeSelector() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
      color: Colors.white,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(children: _HealthMode.values.map((m) {
          final meta = _modeMeta[m]!;
          final active = _mode == m;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              label: Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(meta.icon, size: 16, color: active ? Colors.white : meta.color),
                const SizedBox(width: 6),
                Text(meta.label, style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: active ? Colors.white : textPrimary)),
              ]),
              selected: active,
              selectedColor: meta.color,
              backgroundColor: Colors.white,
              side: BorderSide(color: active ? meta.color : Colors.grey.shade300),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              padding: const EdgeInsets.symmetric(horizontal: 4),
              onSelected: (_) {
                if (_pumping) {
                  _pumpTimer?.cancel();
                  _pumping = false;
                }
                setState(() => _mode = m);
              },
            ),
          );
        }).toList()),
      ),
    );
  }

  Widget _buildMetricsCard() {
    final defs = _modeMetrics[_mode]!;
    final meta = _modeMeta[_mode]!;
    return AppSectionCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(color: meta.color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
            child: Icon(meta.icon, size: 20, color: meta.color),
          ),
          const SizedBox(width: 12),
          Text('${meta.label}指标', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: textPrimary)),
          if (_pumping) ...[
            const SizedBox(width: 8),
            Container(
              width: 8, height: 8,
              decoration: BoxDecoration(shape: BoxShape.circle, color: meta.color),
            ).animate(onPlay: (c) => c.repeat(reverse: true))
              .scale(end: const Offset(1.5, 1.5), duration: 450.ms)
              .fade(end: 0.3, duration: 450.ms),
          ],
          const Spacer(),
          if (_pumping)
            Text('#$_batchCount', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: meta.color, fontFamily: 'monospace')),
        ]),
        const SizedBox(height: 16),
        ...defs.map((d) => _MetricRow(def: d, genValue: () => _genValue(d))),
      ]),
    );
  }

  Widget _buildControls() {
    final connected = MqttService.instance.currentStatus.name == 'connected';
    return Column(children: [
      SizedBox(
        width: double.infinity,
        height: 50,
        child: FilledButton.icon(
          onPressed: _togglePumping,
          icon: Icon(_pumping ? Icons.stop_rounded : Icons.play_arrow_rounded, size: 22),
          label: Text(_pumping ? '停止数据流' : '启动模拟数据流', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
          style: _pumping ? FilledButton.styleFrom(backgroundColor: errorRed) : null,
        ),
      ),
      if (!_pumping) ...[
        const SizedBox(height: 8),
        SizedBox(
          width: double.infinity,
          height: 44,
          child: OutlinedButton.icon(
            onPressed: _sendSingleShot,
            icon: const Icon(Icons.send_rounded, size: 18),
            label: const Text('单次发送当前模式数据'),
          ),
        ),
      ],
      const SizedBox(height: 16),
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.grey.shade50,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: Column(children: [
          Row(children: [
            const Icon(Icons.info_outline, size: 14, color: Colors.grey),
            const SizedBox(width: 6),
            Expanded(child: Text('MQTT连接配置请前往设置', style: TextStyle(fontSize: 11, color: textSecondary))),
            TextButton(
              onPressed: () => context.push('/settings'),
              style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 8), minimumSize: Size.zero, tapTargetSize: MaterialTapTargetSize.shrinkWrap),
              child: const Text('打开', style: TextStyle(fontSize: 12)),
            ),
          ]),
          if (!connected)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Row(children: [
                Icon(Icons.cloud_off, size: 12, color: warningOrange),
                const SizedBox(width: 4),
                Text('MQTT未连接，数据仅通过HTTP上报', style: TextStyle(fontSize: 11, color: warningOrange)),
              ]),
            ),
        ]),
      ),
    ]);
  }

  Widget _buildLogPanel() {
    if (_log.isEmpty) return const SizedBox.shrink();
    return Container(
      constraints: const BoxConstraints(maxHeight: 180),
      decoration: BoxDecoration(
        color: const Color(0xFF0F0F23),
        borderRadius: BorderRadius.vertical(top: Radius.circular(kChipRadius + 4)),
      ),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          child: Row(children: [
            const Icon(Icons.terminal, size: 12, color: Colors.white38),
            const SizedBox(width: 6),
            Text('事件日志', style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.4))),
            const Spacer(),
            GestureDetector(
              onTap: () => setState(() => _log.clear()),
              child: Text('清空', style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.25))),
            ),
          ]),
        ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: _log.length,
            itemBuilder: (_, i) => Text(_log[i],
              style: TextStyle(fontSize: 10, fontFamily: 'monospace',
                color: _log[i].contains('⏹') ? Colors.grey : _log[i].contains('▶') || _log[i].contains('✅') ? successGreen : Colors.green.shade300)),
          ),
        ),
      ]),
    );
  }
}

class _MetricRow extends StatefulWidget {
  final _MetricDef def;
  final double Function() genValue;
  const _MetricRow({required this.def, required this.genValue});
  @override
  State<_MetricRow> createState() => _MetricRowState();
}

class _MetricRowState extends State<_MetricRow> {
  double _val = 0;

  @override
  void initState() {
    super.initState();
    _val = widget.def.normal;
  }

  void _refresh() => setState(() => _val = widget.genValue());

  @override
  Widget build(BuildContext context) {
    final pct = ((_val - widget.def.min) / (widget.def.max - widget.def.min)).clamp(0.0, 1.0);
    final isAlert = _val > widget.def.normal * 1.3 || _val < widget.def.normal * 0.7;
    final barColor = isAlert ? errorRed : matchaPrimary;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(children: [
        SizedBox(
          width: 80,
          child: Text(widget.def.key.replaceAll('_', ' '), style: TextStyle(fontSize: 12, color: textSecondary, fontWeight: FontWeight.w500)),
        ),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: SizedBox(
              height: 28,
              child: Stack(children: [
                Container(color: Colors.grey.shade100),
                FractionallySizedBox(
                  widthFactor: pct,
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(colors: [barColor.withValues(alpha: 0.5), barColor.withValues(alpha: 0.3)]),
                    ),
                  ),
                ),
                Align(
                  alignment: Alignment.centerLeft,
                  child: Padding(
                    padding: const EdgeInsets.only(left: 8),
                    child: Text('${_val.toStringAsFixed(1)} ${widget.def.unit}',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: textPrimary)),
                  ),
                ),
              ]),
            ),
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 32, height: 28,
          child: IconButton(
            padding: EdgeInsets.zero,
            iconSize: 16,
            icon: const Icon(Icons.refresh),
            color: textSecondary,
            onPressed: _refresh,
          ),
        ),
      ]),
    );
  }
}
