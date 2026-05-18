import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:ultralytics_yolo/ultralytics_yolo.dart';
import '../services/event_emitter.dart';
import '../services/pin_service.dart';
import '../services/mqtt_service.dart';
import '../theme.dart';

class FixedDevicePage extends StatefulWidget {
  const FixedDevicePage({super.key});
  @override
  State<FixedDevicePage> createState() => _FixedDevicePageState();
}

class _FixedDevicePageState extends State<FixedDevicePage> {
  static const _modelPath = 'assets/models/yolo11n_int8.tflite';
  bool _modelOk = true;
  bool _personPresent = false;
  int _entryCount = 0;
  int _exitCount = 0;
  String? _roomName;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    try { await rootBundle.load(_modelPath); } catch (_) { _modelOk = false; }
    final prefs = await SharedPreferences.getInstance();
    setState(() { _roomName = prefs.getString('bound_room_name'); });
  }

  void _togglePresence() {
    final pin = PinService.instance.currentPin?.pin ?? '';
    setState(() { _personPresent = !_personPresent; });
    if (_personPresent) {
      _entryCount++;
      EventEmitter.emit(DeviceEvent(type: DeviceEventType.roomEnter, pinCode: pin, roomId: _roomName, metadata: {'room_name': _roomName}));
    } else {
      _exitCount++;
      EventEmitter.emit(DeviceEvent(type: DeviceEventType.roomExit, pinCode: pin, roomId: _roomName, metadata: {'room_name': _roomName}));
    }
  }

  @override
  Widget build(BuildContext context) {
    final connected = MqttService.instance.currentStatus.name == 'connected';

    return Scaffold(
      backgroundColor: creamBg,
      appBar: AppBar(
        title: const Text('固定设备监测'),
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop()),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Container(width: 6, height: 6, decoration: BoxDecoration(shape: BoxShape.circle, color: connected ? successGreen : Colors.grey)),
              const SizedBox(width: 4),
              Text(connected ? '在线' : '离线', style: TextStyle(fontSize: 12, color: connected ? successGreen : Colors.grey)),
              const SizedBox(width: 8),
            ]),
          ),
        ],
      ),
      body: Column(children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          color: Colors.white,
          child: Row(children: [
            const Icon(Icons.meeting_room, size: 14, color: Colors.blue),
            const SizedBox(width: 4),
            Expanded(child: Text(_roomName ?? '未绑定', style: TextStyle(fontSize: 13, color: textSecondary))),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: _personPresent ? successGreen.withValues(alpha: 0.12) : Colors.grey.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Container(width: 6, height: 6, decoration: BoxDecoration(shape: BoxShape.circle, color: _personPresent ? successGreen : Colors.grey)),
                const SizedBox(width: 4),
                Text(_personPresent ? '有人' : '无人', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: _personPresent ? successGreen : Colors.grey.shade700)),
              ]),
            ),
          ]),
        ),
        Expanded(
          child: !_modelOk
            ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.error_outline, size: 48, color: Colors.red),
                const SizedBox(height: 8),
                const Text('模型文件缺失', style: TextStyle(color: Colors.red)),
              ]))
            : const YOLOView(modelPath: _modelPath, task: YOLOTask.detect),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          color: Colors.white,
          child: Row(children: [
            _InfoChip(label: '进入', value: '$_entryCount'),
            const SizedBox(width: 12),
            _InfoChip(label: '离开', value: '$_exitCount'),
            const Spacer(),
            IconButton(
              icon: Icon(_personPresent ? Icons.person_off : Icons.person_add, size: 20),
              onPressed: connected ? _togglePresence : null,
              tooltip: _personPresent ? '模拟离开' : '模拟进入',
              style: IconButton.styleFrom(backgroundColor: matchaPrimary.withValues(alpha: 0.08)),
            ),
          ]),
        ),
      ]),
    );
  }
}

class _InfoChip extends StatelessWidget {
  final String label, value;
  const _InfoChip({required this.label, required this.value});
  @override
  Widget build(BuildContext context) => Text('$label $value', style: TextStyle(fontSize: 13, color: textSecondary));
}