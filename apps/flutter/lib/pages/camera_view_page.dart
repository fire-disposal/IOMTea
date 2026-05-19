import 'dart:io' show Platform;
import 'dart:math' as math;
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_mlkit_commons/google_mlkit_commons.dart';
import '../services/pose_estimator.dart';

class CameraViewPage extends StatefulWidget {
  const CameraViewPage({super.key});
  @override
  State<CameraViewPage> createState() => _CameraViewPageState();
}

class _CameraViewPageState extends State<CameraViewPage> with TickerProviderStateMixin {
  CameraController? _cam;
  final _pose = PoseEstimator();
  bool _ready = false, _busy = false;
  String? _error;
  int _frameId = 0;
  int _rawCount = 0;
  static const _skipFrames = 3;
  PoseResult? _poseResult;
  int _orientation = 90;

  late final AnimationController _lerp;
  PoseResult? _prevPose;

  final List<String> _log = [];
  bool _hasPerson = false;

  @override
  void initState() {
    super.initState();
    _lerp = AnimationController(duration: const Duration(milliseconds: 100), vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _init());
  }

  Future<void> _init() async {
    try {
      final cameras = await availableCameras();
      final back = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.back,
        orElse: () => cameras.first,
      );
      _orientation = back.sensorOrientation;
      _cam = CameraController(
        back,
        ResolutionPreset.medium,
        enableAudio: false,
        imageFormatGroup: Platform.isAndroid
            ? ImageFormatGroup.nv21
            : ImageFormatGroup.bgra8888,
      );
      await _cam!.initialize();
    } catch (e) { _error = '摄像头: $e'; }

    try { await _pose.load(); } catch (e) { _error = '${_error ?? ''}\n模型: $e'; }

    if (mounted) {
      setState(() => _ready = _cam != null && _cam!.value.isInitialized && _pose.isLoaded);
      if (_ready) { _addLog('✅ 摄像头 + 姿态模型就绪'); _start(); }
    }
  }

  void _start() {
    _cam?.startImageStream(_onFrame);
    _addLog('▶ 开始检测');
  }

  void _stop() {
    _cam?.stopImageStream();
    setState(() { _poseResult = null; });
  }

  void _onFrame(CameraImage img) {
    if (_busy) return;
    _rawCount++;
    if (_rawCount % _skipFrames != 0) return;
    _busy = true;

    if (_rawCount == _skipFrames) {
      _addLog('📷 NV21 ${img.width}x${img.height} · ${img.planes.length} plane');
    }

    final inputImage = _cameraToInputImage(img);
    if (inputImage == null) {
      _busy = false;
      return;
    }

    _pose.processImage(inputImage).then((pose) {
      final nk = pose != null ? pose.keypoints.where((k) => k.score > 0.15).length : 0;
      final person = nk >= 4;
      final avg = nk > 0 ? pose!.keypoints.where((k) => k.score > 0.15).fold(0.0, (a, b) => a + b.score) / nk : 0.0;

      if (person != _hasPerson) {
        if (person) {
          _addLog('👤 检测到人物 · $_frameId帧时 · $nk关键点 · 置信度${(avg * 100).toInt()}%');
        } else {
          _addLog('🚶 人物离开 · $_frameId帧');
        }
        _hasPerson = person;
      }
      if (_frameId % 10 == 0) {
        if (person) {
          _addLog('📐 跟踪中 · $_frameId帧 · $nk点 · ${(avg * 100).toInt()}%');
        } else {
          _addLog('⏳ 未检测到人物 · $_frameId帧');
        }
      }

      if (mounted) {
        setState(() {
          _frameId++;
          _prevPose = _poseResult;
          if (pose != null) _poseResult = pose;
        });
        _lerp.forward(from: 0);
      }
      _busy = false;
    }).catchError((e) {
      _busy = false;
      debugPrint('ML Kit frame error: $e');
    });
  }

  static const _orientations = {
    DeviceOrientation.portraitUp: 0,
    DeviceOrientation.landscapeLeft: 90,
    DeviceOrientation.portraitDown: 180,
    DeviceOrientation.landscapeRight: 270,
  };

  InputImage? _cameraToInputImage(CameraImage img) {
    final rotation = _inputImageRotation();
    if (rotation == null) return null;

    final fmt = InputImageFormatValue.fromRawValue(img.format.raw);
    if (fmt == null ||
        (Platform.isAndroid && fmt != InputImageFormat.nv21) ||
        (Platform.isIOS && fmt != InputImageFormat.bgra8888)) {
      return null;
    }

    if (img.planes.length != 1) { return null; }
    final plane = img.planes.first;

    return InputImage.fromBytes(
      bytes: plane.bytes,
      metadata: InputImageMetadata(
        size: Size(img.width.toDouble(), img.height.toDouble()),
        rotation: rotation,
        format: fmt,
        bytesPerRow: plane.bytesPerRow,
      ),
    );
  }

  InputImageRotation? _inputImageRotation() {
    final deviceOrientation = _cam!.value.deviceOrientation;

    final orientationCompensation = _orientations[deviceOrientation];
    if (orientationCompensation == null) return null;

    int rotation;
    if (_cam!.description.lensDirection == CameraLensDirection.front) {
      rotation = (_orientation + orientationCompensation) % 360;
    } else {
      rotation = (_orientation - orientationCompensation + 360) % 360;
    }

    return InputImageRotationValue.fromRawValue(rotation);
  }

  void _addLog(String msg) {
    final n = DateTime.now();
    setState(() { _log.insert(0, '${n.hour.toString().padLeft(2, '0')}:${n.minute.toString().padLeft(2, '0')}:${n.second.toString().padLeft(2, '0')} $msg'); if (_log.length > 80) _log.removeLast(); });
  }

  @override
  void dispose() {
    _cam?.stopImageStream(); _cam?.dispose();
    _pose.dispose(); _lerp.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) return _errorScreen();
    if (!_ready) return _loadingScreen();
    return _activeScreen();
  }

  Widget _loadingScreen() => Scaffold(
    backgroundColor: Colors.black,
    appBar: _topBar(),
    body: const Center(child: CircularProgressIndicator(color: Colors.white30)),
  );

  Widget _errorScreen() => Scaffold(
    backgroundColor: Colors.black,
    appBar: _topBar(),
    body: Center(child: Text(_error!, style: const TextStyle(color: Colors.redAccent, fontSize: 13))),
  );

  Widget _activeScreen() => Scaffold(
    backgroundColor: Colors.black,
    appBar: _topBar(),
    body: AnimatedBuilder(
      animation: _lerp,
      builder: (_, __) {
        final t = Curves.easeOut.transform(_lerp.value);
        return Stack(fit: StackFit.expand, children: [
          AspectRatio(
            aspectRatio: 1.0 / _cam!.value.aspectRatio,
            child: ClipRect(child: Stack(children: [
              CameraPreview(_cam!),
              Positioned.fill(child: CustomPaint(painter: _Overlay(
                pose: _poseResult, prevPose: _prevPose, lerpT: t, orientation: _orientation,
              ))),
            ])),
          ),
          Positioned(bottom: 0, left: 0, right: 0, child: _bottomBar()),
        ]);
      },
    ),
  );

  PreferredSizeWidget _topBar() => AppBar(
    backgroundColor: Colors.black,
    elevation: 0,
    leading: IconButton(icon: const Icon(Icons.arrow_back, color: Colors.white54), onPressed: () => Navigator.of(context).pop()),
    title: const Text('固定设备监测', style: TextStyle(color: Colors.white38, fontSize: 16)),
    centerTitle: true,
  );

  Widget _bottomBar() {
    final avg = _poseResult != null && _poseResult!.keypoints.where((k) => k.score > 0.15).isNotEmpty
        ? _poseResult!.keypoints.where((k) => k.score > 0.15).fold(0.0, (a, b) => a + b.score) /
            _poseResult!.keypoints.where((k) => k.score > 0.15).length
        : 0.0;

    return Column(mainAxisSize: MainAxisSize.min, children: [
      if (_log.isNotEmpty)
        ConstrainedBox(
          constraints: const BoxConstraints(maxHeight: 140),
          child: Container(
            color: const Color(0xFF0C0C1C),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              _logHeader(),
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  itemCount: _log.length,
                  itemBuilder: (_, i) {
                    final s = _log[i];
                    return Text(s, style: TextStyle(fontSize: 10, fontFamily: 'monospace',
                      color: s.contains('👤') ? Colors.green.shade300 : s.contains('🚶') ? Colors.grey : Colors.cyan.shade300));
                  },
                ),
              ),
            ]),
          ),
        ),
      Container(
        padding: const EdgeInsets.fromLTRB(12, 6, 12, 10),
        decoration: const BoxDecoration(gradient: LinearGradient(
          colors: [Colors.transparent, Colors.black87], begin: Alignment.topCenter, end: Alignment.bottomCenter)),
        child: SafeArea(top: false, child: Row(children: [
          _chip(Icons.person, _hasPerson ? '有人' : '无人', _hasPerson ? '${(avg * 100).toInt()}%' : '--', _hasPerson ? Colors.greenAccent : Colors.grey),
          const SizedBox(width: 8),
          _chip(Icons.speed, '帧', '#$_frameId', Colors.cyanAccent),
          const Spacer(),
          SizedBox(height: 32, child: TextButton.icon(
            onPressed: _stop, icon: const Icon(Icons.stop_rounded, size: 16, color: Colors.white54), label: const Text('停止', style: TextStyle(fontSize: 12, color: Colors.white54)),
          )),
        ])),
      ),
    ]);
  }

  Widget _logHeader() => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
    child: Row(children: [
      const Icon(Icons.terminal, size: 10, color: Colors.white38),
      const SizedBox(width: 4),
      Text('日志 · ${_log.length}条', style: TextStyle(fontSize: 10, color: Colors.white.withValues(alpha: 0.35))),
      const Spacer(),
      GestureDetector(
        onTap: () => setState(() => _log.clear()),
        child: Text('清空', style: TextStyle(fontSize: 10, color: Colors.white.withValues(alpha: 0.25))),
      ),
    ]),
  );

  static Widget _chip(IconData icon, String label, String value, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
    decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(5)),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, size: 11, color: color), const SizedBox(width: 3),
      Text('$label ', style: TextStyle(fontSize: 10, color: Colors.white.withValues(alpha: 0.45))),
      Text(value, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color)),
    ]),
  );
}

class _Overlay extends CustomPainter {
  final PoseResult? pose, prevPose;
  final double lerpT;
  final int orientation;

  _Overlay({required this.pose, required this.prevPose, required this.lerpT, required this.orientation});

  static const _skel = [
    [5,7],[7,9],[6,8],[8,10],[5,6],[5,11],[6,12],[11,12],[11,13],[13,15],[12,14],[14,16],
  ];

  static Offset _rot(double x, double y, int o) => switch (o) {
    90 => Offset(1 - y, x), 270 => Offset(y, 1 - x), 180 => Offset(1 - x, 1 - y), _ => Offset(x, y),
  };

  double _l(double a, double b) => a + (b - a) * lerpT;

  @override
  void paint(Canvas c, Size s) {
    if (pose == null) return;
    final cp = pose!.keypoints, pp = prevPose?.keypoints;
    final pts = <int, Offset>{};
    double x1 = s.width, y1 = s.height, x2 = 0, y2 = 0;
    int vc = 0;

    for (int i = 0; i < cp.length; i++) {
      if (cp[i].score < 0.15) continue;
      final px = _l(pp != null && i < pp.length ? pp[i].x : cp[i].x, cp[i].x);
      final py = _l(pp != null && i < pp.length ? pp[i].y : cp[i].y, cp[i].y);
      final r = _rot(px, py, orientation);
      final dx = r.dx * s.width, dy = r.dy * s.height;
      pts[i] = Offset(dx, dy);
      if (dx < x1) x1 = dx; if (dy < y1) y1 = dy;
      if (dx > x2) x2 = dx; if (dy > y2) y2 = dy;
      vc++;
    }

    final glow = Paint()..style = PaintingStyle.stroke..strokeWidth = 5..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3);
    final line = Paint()..style = PaintingStyle.stroke..strokeWidth = 2;

    const sc = [Colors.cyan, Colors.blue, Colors.cyan, Colors.blue, Colors.green, Colors.yellow, Colors.yellow, Colors.green, Colors.yellow, Colors.orange, Colors.yellow, Colors.orange];
    for (int i = 0; i < _skel.length; i++) {
      final a = pts[_skel[i][0]], b = pts[_skel[i][1]];
      if (a == null || b == null) continue;
      glow.color = sc[i].withValues(alpha: 0.35); c.drawLine(a, b, glow);
      line.color = sc[i].withValues(alpha: 0.8); c.drawLine(a, b, line);
    }

    final dp = Paint()..style = PaintingStyle.fill..color = const Color(0xFF00E676);
    final db = Paint()..style = PaintingStyle.stroke..strokeWidth = 1..color = Colors.white70;
    for (final p in pts.values) { c.drawCircle(p, 3.5, db); c.drawCircle(p, 2.5, dp); }

    if (vc < 4) return;
    drawBox(c, s, x1, y1, x2, y2);
  }

  void drawBox(Canvas c, Size s, double x1, double y1, double x2, double y2) {
    final px = (x2 - x1) * 0.06, py = (y2 - y1) * 0.06;
    x1 = (x1 - px).clamp(0, s.width); y1 = (y1 - py).clamp(0, s.height);
    x2 = (x2 + px).clamp(0, s.width); y2 = (y2 + py).clamp(0, s.height);
    final arm = math.min(math.min((x2 - x1) * 0.35, (y2 - y1) * 0.35), 50.0);
    final color = const Color(0xFF00E676);

    final gl = Paint()..color = color.withValues(alpha: 0.5)..strokeWidth = 3..style = PaintingStyle.stroke..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6);
    final ln = Paint()..color = color..strokeWidth = 2..style = PaintingStyle.stroke;
    c.drawLine(Offset(x1, y1), Offset(x1 + arm, y1), gl); c.drawLine(Offset(x1, y1), Offset(x1 + arm, y1), ln);
    c.drawLine(Offset(x1, y1), Offset(x1, y1 + arm), gl); c.drawLine(Offset(x1, y1), Offset(x1, y1 + arm), ln);

    final tp = TextPainter(text: TextSpan(text: 'Person', style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700)), textDirection: TextDirection.ltr)..layout();
    tp.paint(c, Offset(x1 + arm + 4, y1));
  }

  @override
  bool shouldRepaint(covariant _Overlay o) => true;
}
