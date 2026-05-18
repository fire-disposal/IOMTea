import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/event_emitter.dart';
import '../services/mqtt_service.dart';
import '../services/pin_service.dart';
import '../theme.dart';

const _metrics = [
  'heart_rate', 'spo2', 'temperature', 'systolic_bp', 'diastolic_bp',
  'resp_rate', 'glucose', 'weight', 'motion_index', 'bed_status',
  'posture', 'ecg_waveform', 'resp_waveform', 'pressure_grid',
  'fall_detected', 'medication_taken', 'medication_missed',
];

const _sources = ['iot', 'simulator', 'manual'];

class DebugSimulatorPage extends StatefulWidget {
  const DebugSimulatorPage({super.key});
  @override
  State<DebugSimulatorPage> createState() => _DebugSimulatorPageState();
}

class _DebugSimulatorPageState extends State<DebugSimulatorPage> {
  final _pinCtrl = TextEditingController(text: PinService.instance.currentPin?.pin ?? '123456');
  final _valueCtrl = TextEditingController(text: '72');
  final _roomCtrl = TextEditingController();
  final _log = <String>[];
  String _metric = 'heart_rate';
  String _source = 'simulator';
  int _batchCount = 1;
  int _batchIntervalMs = 500;
  bool _running = false;

  @override
  void initState() {
    super.initState();
    _loadRoomId();
  }

  Future<void> _loadRoomId() async {
    final prefs = await SharedPreferences.getInstance();
    _roomCtrl.text = prefs.getString('bound_room_id') ?? '';
  }

  void _addLog(String msg) {
    setState(() => _log.insert(0, '[${DateTime.now().hour}:${DateTime.now().minute.toString().padLeft(2, '0')}] $msg'));
    if (_log.length > 100) _log.removeLast();
  }

  void _sendEvent({String? kind}) {
    final pin = _pinCtrl.text.trim();
    if (pin.isEmpty) { _addLog('❌ PIN 为空'); return; }

    final roomId = _roomCtrl.text.trim();
    EventEmitter.emit(DeviceEvent(
      type: _metric == 'fall_detected' ? DeviceEventType.fallDetected : DeviceEventType.actionDetected,
      pinCode: pin,
      roomId: roomId.isNotEmpty ? roomId : null,
      action: _metric,
      metadata: {
        'value': double.tryParse(_valueCtrl.text) ?? 0,
        'unit': _getUnit(_metric),
        'source': _source,
        'kind': kind ?? 'observation',
        if (kind == 'alert') 'severity': 'warning',
      },
    ));

    _addLog('📤 ${_metric}=${_valueCtrl.text} ${_getUnit(_metric)} (${kind ?? "observation"})');
  }

  String _getUnit(String metric) => switch (metric) {
    'heart_rate' => 'bpm', 'spo2' => '%', 'temperature' => '°C',
    'systolic_bp' || 'diastolic_bp' => 'mmHg', 'resp_rate' => 'rpm',
    'glucose' => 'mmol/L', 'weight' => 'kg', _ => '',
  };

  Future<void> _sendBatch() async {
    _running = true;
    for (int i = 0; i < _batchCount; i++) {
      _sendEvent();
      await Future.delayed(Duration(milliseconds: _batchIntervalMs));
    }
    _running = false;
    if (mounted) setState(() {});
    _addLog('✅ 批量发送完成 ($_batchCount 条)');
  }

  @override
  void dispose() { _pinCtrl.dispose(); _valueCtrl.dispose(); _roomCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final connected = MqttService.instance.currentStatus.name == 'connected';

    return Scaffold(
      backgroundColor: creamBg,
      appBar: AppBar(
        title: const Text('事件模拟器'),
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop()),
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
        Expanded(
          child: ListView(padding: const EdgeInsets.all(16), children: [
            Card(
              child: Padding(padding: const EdgeInsets.all(16), child: Column(children: [
                TextField(controller: _pinCtrl, decoration: const InputDecoration(labelText: 'PIN', border: OutlineInputBorder(), isDense: true), style: const TextStyle(fontFamily: 'monospace', fontSize: 14)),
                const SizedBox(height: 8),
                TextField(controller: _roomCtrl, decoration: const InputDecoration(labelText: 'Room ID (可选)', border: OutlineInputBorder(), isDense: true), style: const TextStyle(fontFamily: 'monospace', fontSize: 12)),
              ])),
            ),
            Card(
              child: Padding(padding: const EdgeInsets.all(16), child: Column(children: [
                DropdownButtonFormField(
                  value: _metric, decoration: const InputDecoration(labelText: '指标', border: OutlineInputBorder(), isDense: true),
                  items: _metrics.map((m) => DropdownMenuItem(value: m, child: Text(m, style: const TextStyle(fontSize: 13)))).toList(),
                  onChanged: (v) => setState(() => _metric = v ?? 'heart_rate'),
                ),
                const SizedBox(height: 8),
                Row(children: [
                  Expanded(flex: 2, child: TextField(controller: _valueCtrl, decoration: const InputDecoration(labelText: '数值', border: OutlineInputBorder(), isDense: true), keyboardType: TextInputType.number, style: const TextStyle(fontFamily: 'monospace', fontSize: 14))),
                  const SizedBox(width: 8),
                  Expanded(child: DropdownButtonFormField(
                    value: _source, decoration: const InputDecoration(labelText: '来源', border: OutlineInputBorder(), isDense: true),
                    items: _sources.map((s) => DropdownMenuItem(value: s, child: Text(s, style: const TextStyle(fontSize: 12)))).toList(),
                    onChanged: (v) => setState(() => _source = v ?? 'simulator'),
                  )),
                ]),
              ])),
            ),
            Card(
              child: Padding(padding: const EdgeInsets.all(16), child: Column(children: [
                Row(children: [
                  Expanded(child: Text('批量发送', style: TextStyle(fontWeight: FontWeight.w600, color: textPrimary))),
                  Row(children: [
                    IconButton(icon: const Icon(Icons.remove), onPressed: _batchCount > 1 ? () => setState(() => _batchCount--) : null),
                    Text('$_batchCount', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                    IconButton(icon: const Icon(Icons.add), onPressed: _batchCount < 100 ? () => setState(() => _batchCount++) : null),
                  ]),
                ]),
                const SizedBox(height: 8),
                Row(children: [
                  const Text('间隔: ', style: TextStyle(color: Colors.grey, fontSize: 12)),
                  Expanded(
                    child: Slider(value: _batchIntervalMs.toDouble(), min: 100, max: 5000, divisions: 49,
                      label: '${_batchIntervalMs}ms',
                      onChanged: (v) => setState(() => _batchIntervalMs = v.round()),
                    ),
                  ),
                  Text('${_batchIntervalMs}ms', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                ]),
              ])),
            ),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: _running ? null : () => _sendEvent(kind: 'observation'),
                  icon: const Icon(Icons.send, size: 16),
                  label: const Text('发送观测'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: FilledButton.icon(
                  onPressed: _running ? null : () => _sendEvent(kind: 'alert'),
                  icon: const Icon(Icons.warning_amber, size: 16),
                  label: const Text('发送告警'),
                  style: FilledButton.styleFrom(backgroundColor: warningOrange),
                ),
              ),
            ]),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _running ? null : _sendBatch,
                icon: _running ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.repeat, size: 16),
                label: Text(_running ? '发送中...' : '批量发送 ($_batchCount 条)'),
                style: FilledButton.styleFrom(backgroundColor: matchaDark),
              ),
            ),
            const SizedBox(height: 16),
            Text('日志', style: TextStyle(fontWeight: FontWeight.w600, color: textPrimary)),
            const SizedBox(height: 4),
          ]),
        ),
        Container(
          constraints: const BoxConstraints(maxHeight: 200),
          color: Colors.black87,
          child: ListView.builder(
            padding: const EdgeInsets.all(8),
            itemCount: _log.length,
            itemBuilder: (_, i) => Text(_log[i],
              style: TextStyle(fontSize: 10, fontFamily: 'monospace', color: _log[i].startsWith('✅') ? successGreen : _log[i].startsWith('❌') ? errorRed : Colors.green.shade300)),
          ),
        ),
      ]),
    );
  }
}