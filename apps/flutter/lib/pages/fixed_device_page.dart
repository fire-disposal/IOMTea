import 'dart:async';
import 'dart:ui' as ui;
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/action_classifier.dart';
import '../services/event_emitter.dart';
import '../services/mqtt_service.dart';
import '../services/pin_service.dart';
import '../services/pose_estimator.dart';
import '../theme.dart';

class FixedDevicePage extends StatefulWidget {
  final bool fromRoomBind;
  const FixedDevicePage({super.key, this.fromRoomBind = false});
  @override
  State<FixedDevicePage> createState() => _FixedDevicePageState();
}

class _FixedDevicePageState extends State<FixedDevicePage> {
  CameraController? _cam;
  final _pose = PoseEstimator();
  final _classifier = ActionClassifier();
  bool _camReady = false, _poseReady = false, _processing = false;
  String? _roomName;
  int _entryCount = 0, _exitCount = 0;
  bool _personPresent = false;
  int _lastReportTime = 0;
  ActionState _action = ActionState.unknown;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _checkRoomThenInit());
  }

  Future<void> _checkRoomThenInit() async {
    final prefs = await SharedPreferences.getInstance();
    _roomName = prefs.getString('bound_room_name');
    if (_roomName == null && !widget.fromRoomBind && mounted) {
      context.push('/room-bind');
      return;
    }

    try {
      final cameras = await availableCameras();
      final back = cameras.firstWhere((c) => c.lensDirection == CameraLensDirection.back, orElse: () => cameras.first);
      _cam = CameraController(back, ResolutionPreset.medium, enableAudio: false);
      await _cam!.initialize();
      _camReady = true;
    } catch (e) { _error = '摄像头: $e'; }

    try {
      await _pose.load();
      _poseReady = true;
    } catch (e) { _error = '${_error ?? ''}\n模型: $e'; }

    if (_camReady && _poseReady) _cam!.startImageStream(_onFrame);
    if (mounted) setState(() {});
  }

  void _onFrame(CameraImage image) {
    if (_processing) return;
    _processing = true;
    _toUiImage(image).then((img) async {
      if (img == null) { _processing = false; return; }
      final w = img.width;
      final h = img.height;
      final bytes = await img.toByteData(format: ui.ImageByteFormat.rawRgba);
      img.dispose();
      if (bytes == null) { _processing = false; return; }

      final pose = _pose.estimate(bytes, w, h);
      if (pose == null) { _processing = false; return; }

      final newAction = _classifier.classify(pose);
      final hasPerson = pose.keypoints[5].score > 0.3;

      setState(() => _action = newAction);

      final now = DateTime.now().millisecondsSinceEpoch;
      if (hasPerson != _personPresent && now - _lastReportTime > 2000) {
        _personPresent = hasPerson;
        _lastReportTime = now;
        final pin = PinService.instance.currentPin?.pin ?? '';
        EventEmitter.emitPresence(pin, _roomName ?? '', _personPresent, action: newAction.name);
        setState(() {});
      }
      _processing = false;
    }).catchError((_) { _processing = false; });
  }

  Future<ui.Image?> _toUiImage(CameraImage image) {
    final c = Completer<ui.Image?>();
    try { ui.decodeImageFromPixels(image.planes[0].bytes, image.width, image.height, ui.PixelFormat.bgra8888, (img) => c.complete(img)); }
    catch (_) { c.complete(null); }
    return c.future;
  }

  @override
  void dispose() { _cam?.stopImageStream(); _cam?.dispose(); _pose.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final connected = MqttService.instance.currentStatus.name == 'connected';
    return Scaffold(
      backgroundColor: creamBg,
      appBar: AppBar(
        title: const Text('固定设备监测'),
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop()),
        actions: [
          if (_poseReady) _ActionChip(action: _action), const SizedBox(width: 4),
          _StatusDot(online: connected), const SizedBox(width: 8),
        ],
      ),
      body: Column(children: [
        _HeaderBar(roomName: _roomName, personPresent: _personPresent),
        Expanded(child: _error != null ? Center(child: Padding(padding: const EdgeInsets.all(32), child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.error_outline, size: 32, color: Colors.red), const SizedBox(height: 8),
          Text(_error!, textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: errorRed)),
        ]))) : !_camReady ? const Center(child: CircularProgressIndicator()) : CameraPreview(_cam!)),
        Container(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8), color: Colors.white,
          child: Row(children: [
            Text('进入 $_entryCount  ·  离开 $_exitCount', style: TextStyle(fontSize: 13, color: textSecondary)),
            const Spacer(),
            if (!_poseReady && _camReady) Text('模型加载中...', style: TextStyle(fontSize: 11, color: warningOrange)),
          ])),
      ]),
    );
  }
}

class _HeaderBar extends StatelessWidget {
  final String? roomName; final bool personPresent;
  const _HeaderBar({required this.roomName, required this.personPresent});
  @override
  Widget build(BuildContext context) => Container(width: double.infinity, padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8), color: Colors.white,
    child: Row(children: [
      const Icon(Icons.meeting_room, size: 14, color: Colors.blue), const SizedBox(width: 4),
      Expanded(child: Text(roomName ?? '未绑定', style: TextStyle(fontSize: 13, color: textSecondary))),
      Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
        decoration: BoxDecoration(color: personPresent ? successGreen.withValues(alpha: 0.12) : Colors.grey.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
        child: Text(personPresent ? '有人' : '无人', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: personPresent ? successGreen : Colors.grey.shade700))),
    ]));
}

class _ActionChip extends StatelessWidget {
  final ActionState action;
  const _ActionChip({required this.action});
  String get label => switch (action) { ActionState.standing => '站立', ActionState.sitting => '坐下', ActionState.lying => '躺下', ActionState.walking => '行走', ActionState.fallen => '跌倒!', _ => '--' };
  Color get color => switch (action) { ActionState.standing => Colors.blue, ActionState.sitting => Colors.orange, ActionState.lying => Colors.purple, ActionState.walking => Colors.green, ActionState.fallen => errorRed, _ => textSecondary };
  @override
  Widget build(BuildContext context) => Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(10)),
    child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color)));
}

class _StatusDot extends StatelessWidget {
  final bool online; const _StatusDot({required this.online});
  @override
  Widget build(BuildContext context) => Container(width: 6, height: 6, decoration: BoxDecoration(shape: BoxShape.circle, color: online ? successGreen : Colors.grey));
}