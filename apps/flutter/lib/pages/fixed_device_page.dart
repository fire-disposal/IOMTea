import 'dart:async';
import 'dart:math' as math;
import 'dart:typed_data';
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
  String? _roomId;
  int _entryCount = 0, _exitCount = 0;
  bool _personPresent = false;
  int _lastReportTime = 0;
  ActionState _action = ActionState.unknown;
  String? _error;
  PoseResult? _lastPose;
  Size? _previewSize;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _checkRoomThenInit());
  }

  Future<void> _checkRoomThenInit() async {
    final prefs = await SharedPreferences.getInstance();
    _roomName = prefs.getString('bound_room_name');
    _roomId = prefs.getString('bound_room_id');
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

    if (_camReady && _poseReady) {
      _cam!.startImageStream(_onFrame);
      try { _previewSize = Size(_cam!.value.previewSize!.width.toDouble(), _cam!.value.previewSize!.height.toDouble()); } catch (_) {}
    }
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

      setState(() {
        _action = newAction;
        _lastPose = pose;
        _previewSize ??= Size(w.toDouble(), h.toDouble());
      });

      final now = DateTime.now().millisecondsSinceEpoch;
      if (hasPerson != _personPresent && now - _lastReportTime > 2000) {
        _personPresent = hasPerson;
        _lastReportTime = now;
        final pin = PinService.instance.currentPin?.pin ?? '';
        EventEmitter.emitPresence(pin, _roomId ?? '', _personPresent, action: newAction.name);
        if (_personPresent) { _entryCount++; } else { _exitCount++; }
        setState(() {});
      }
      _processing = false;
    }).catchError((_) { _processing = false; });
  }

  Future<ui.Image?> _toUiImage(CameraImage image) {
    final c = Completer<ui.Image?>();
    try {
      final w = image.width;
      final h = image.height;
      if (image.format.group == ImageFormatGroup.bgra8888) {
        ui.decodeImageFromPixels(image.planes[0].bytes, w, h, ui.PixelFormat.bgra8888, (img) => c.complete(img));
      } else if (image.format.group == ImageFormatGroup.yuv420 ||
                 image.format.group == ImageFormatGroup.nv21) {
        final isNv21 = image.format.group == ImageFormatGroup.nv21;
        final pixels = _convertYuvToBgra(image, swapUV: isNv21);
        if (pixels != null) {
          ui.decodeImageFromPixels(pixels, w, h, ui.PixelFormat.bgra8888, (img) => c.complete(img));
        } else {
          c.complete(null);
        }
      } else {
        ui.decodeImageFromPixels(image.planes[0].bytes, w, h, ui.PixelFormat.bgra8888, (img) => c.complete(img));
      }
    } catch (_) {
      c.complete(null);
    }
    return c.future;
  }

  Uint8List? _convertYuvToBgra(CameraImage image, {bool swapUV = false}) {
    final w = image.width;
    final h = image.height;
    if (image.planes.length < 3) return null;
    final yPlane = image.planes[0];
    final uPlane = swapUV ? image.planes[2] : image.planes[1];
    final vPlane = swapUV ? image.planes[1] : image.planes[2];
    if (uPlane.bytes.isEmpty || vPlane.bytes.isEmpty) return null;
    final rgba = Uint8List(w * h * 4);
    for (int y = 0; y < h; y++) {
      for (int x = 0; x < w; x++) {
        final yVal = yPlane.bytes[y * yPlane.bytesPerRow + x];
        final uvX = (x ~/ 2).clamp(0, (w ~/ 2) - 1);
        final uvY = (y ~/ 2).clamp(0, (h ~/ 2) - 1);
        final uvIdx = uvY * vPlane.bytesPerRow + uvX * 2;
        if (uvIdx + 1 >= vPlane.bytes.length) continue;
        final uVal = uPlane.bytes[uvIdx] - 128;
        final vVal = vPlane.bytes[uvIdx + 1] - 128;
        final idx = (y * w + x) * 4;
        rgba[idx] = (yVal + 1.402 * vVal).round().clamp(0, 255);
        rgba[idx + 1] = (yVal - 0.344 * uVal - 0.714 * vVal).round().clamp(0, 255);
        rgba[idx + 2] = (yVal + 1.772 * uVal).round().clamp(0, 255);
        rgba[idx + 3] = 255;
      }
    }
    return rgba;
  }

  Widget _buildCameraView() {
    if (_error != null) {
      return Center(child: Padding(padding: const EdgeInsets.all(32), child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.error_outline, size: 32, color: Colors.red), const SizedBox(height: 8),
        Text(_error!, textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: errorRed)),
      ])));
    }
    if (!_camReady) return const Center(child: CircularProgressIndicator());

    return LayoutBuilder(builder: (context, constraints) {
      return Stack(
        fit: StackFit.expand,
        children: [
          CameraPreview(_cam!),
          if (_lastPose != null && _previewSize != null)
            CustomPaint(
              painter: _PoseOverlayPainter(
                pose: _lastPose!,
                previewSize: _previewSize!,
                widgetSize: Size(constraints.maxWidth, constraints.maxHeight),
              ),
            ),
        ],
      );
    });
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
        Expanded(child: _buildCameraView()),
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

class _PoseOverlayPainter extends CustomPainter {
  final PoseResult pose;
  final Size previewSize;
  final Size widgetSize;

  _PoseOverlayPainter({required this.pose, required this.previewSize, required this.widgetSize});

  static const _skeleton = [
    [5, 7], [7, 9], [6, 8], [8, 10], [5, 6],
    [5, 11], [6, 12], [11, 12], [11, 13], [13, 15],
    [12, 14], [14, 16],
  ];
  static const _colors = [
    Colors.cyan, Colors.blue, Colors.cyan, Colors.blue, Colors.green,
    Colors.yellow, Colors.yellow, Colors.green, Colors.yellow, Colors.orange,
    Colors.yellow, Colors.orange,
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final kps = pose.keypoints;
    final scaleX = widgetSize.width / previewSize.width;
    final scaleY = widgetSize.height / previewSize.height;
    final scale = math.min(scaleX, scaleY);
    final offsetX = (size.width - previewSize.width * scale) / 2;
    final offsetY = (size.height - previewSize.height * scale) / 2;

    final points = <int, Offset>{};
    for (int i = 0; i < kps.length; i++) {
      final kp = kps[i];
      if (kp.score < 0.3) continue;
      final x = kp.x * previewSize.width * scale + offsetX;
      final y = kp.y * previewSize.height * scale + offsetY;
      points[i] = Offset(x, y);
    }

    final linePaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0;

    for (int i = 0; i < _skeleton.length; i++) {
      final a = points[_skeleton[i][0]];
      final b = points[_skeleton[i][1]];
      if (a == null || b == null) continue;
      linePaint.color = _colors[i].withValues(alpha: 0.7);
      canvas.drawLine(a, b, linePaint);
    }

    final dotPaint = Paint()
      ..style = PaintingStyle.fill
      ..color = Colors.greenAccent.withValues(alpha: 0.9);

    for (final pt in points.values) {
      canvas.drawCircle(pt, 4, dotPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _PoseOverlayPainter old) =>
      old.pose != pose || old.widgetSize != widgetSize;
}