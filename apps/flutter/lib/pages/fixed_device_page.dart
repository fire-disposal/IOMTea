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
  bool _active = false;
  bool _modelOk = true;
  bool _personPresent = false;
  int _entryCount = 0;
  int _exitCount = 0;
  String? _roomName;
  String? _roomId;

  @override
  void initState() {
    super.initState();
    _loadRoomInfo();
    _checkModel();
  }

  Future<void> _loadRoomInfo() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _roomName = prefs.getString('bound_room_name');
      _roomId = prefs.getString('bound_room_id');
    });
  }

  Future<void> _checkModel() async {
    try { await rootBundle.load(_modelPath); } catch (_) {
      if (mounted) setState(() => _modelOk = false);
    }
  }

  void _simulateToggle() {
    final pin = PinService.instance.currentPin?.pin ?? '';
    setState(() => _personPresent = !_personPresent);
    if (_personPresent) {
      _entryCount++;
      EventEmitter.emit(DeviceEvent(type: DeviceEventType.roomEnter, pinCode: pin, roomId: _roomId, metadata: {'room_name': _roomName}));
    } else {
      _exitCount++;
      EventEmitter.emit(DeviceEvent(type: DeviceEventType.roomExit, pinCode: pin, roomId: _roomId, metadata: {'room_name': _roomName}));
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
      ),
      body: Column(children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          color: Colors.white,
          child: Row(children: [
            const Icon(Icons.meeting_room, size: 16, color: Colors.blue),
            const SizedBox(width: 6),
            Text(_roomName ?? '未绑定房间', style: TextStyle(fontSize: 13, color: textSecondary)),
            const Spacer(),
            Container(width: 8, height: 8, decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _personPresent ? successGreen : Colors.grey,
            )),
            const SizedBox(width: 6),
            Text(_personPresent ? '有人' : '无人', style: TextStyle(fontSize: 13, color: _personPresent ? successGreen : Colors.grey)),
            const SizedBox(width: 12),
            Container(width: 8, height: 8, decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: connected ? successGreen : Colors.grey,
            )),
            const SizedBox(width: 4),
            Text(connected ? '✓' : '✗', style: TextStyle(fontSize: 11, color: connected ? successGreen : Colors.grey)),
          ]),
        ),
        Expanded(
          flex: 3,
          child: !_modelOk
            ? Container(color: Colors.grey.shade100, alignment: Alignment.center,
                child: const Column(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.error_outline, size: 48, color: Colors.red),
                  SizedBox(height: 8),
                  Text('模型文件缺失', style: TextStyle(color: Colors.red, fontSize: 13)),
                ]))
            : _active
              ? const YOLOView(modelPath: _modelPath, task: YOLOTask.detect)
              : Container(color: Colors.grey.shade900, alignment: Alignment.center,
                  child: const Icon(Icons.videocam_off, size: 48, color: Colors.white38)),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            _InfoChip(label: '进入', value: '$_entryCount', color: successGreen),
            const SizedBox(width: 12),
            _InfoChip(label: '离开', value: '$_exitCount', color: warningOrange),
            const Spacer(),
            TextButton.icon(
              onPressed: connected ? _simulateToggle : null,
              icon: Icon(_personPresent ? Icons.person_off : Icons.person, size: 16),
              label: Text(_personPresent ? '模拟离开' : '模拟进入', style: const TextStyle(fontSize: 12)),
            ),
            FilledButton.icon(
              onPressed: _modelOk ? () => setState(() => _active = !_active) : null,
              icon: Icon(_active ? Icons.stop : Icons.play_arrow),
              label: Text(_active ? '停止' : '开始'),
            ),
          ]),
        ),
      ]),
    );
  }
}

class _InfoChip extends StatelessWidget {
  final String label, value;
  final Color color;
  const _InfoChip({required this.label, required this.value, required this.color});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
    decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(20)),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      Text('$label: ', style: TextStyle(fontSize: 13, color: textSecondary)),
      Text(value, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: color)),
    ]),
  );
}