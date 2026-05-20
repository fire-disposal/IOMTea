import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:ultralytics_yolo/ultralytics_yolo.dart';
import '../services/vision/vision_mode.dart';
import '../services/vision/vision_mode_registry.dart';
import '../services/vision/vision_mode_manager.dart';
import '../services/vision/painters/pose_painter.dart';
import '../services/vision/painters/detect_painter.dart';
import '../widgets/vision_log_panel.dart';
import 'camera_settings_page.dart';

class CameraViewPage extends StatefulWidget {
  const CameraViewPage({super.key});

  @override
  State<CameraViewPage> createState() => _CameraViewPageState();
}

class _CameraViewPageState extends State<CameraViewPage> with WidgetsBindingObserver {
  bool _isDisposed = false;
  CameraController? _cam;
  final _manager = VisionModeManager();
  VisionMode? _selectedMode;
  bool _ready = false;
  String? _error;

  final List<VisionLogEntry> _logs = [];
  String _statusText = '';
  bool _isSwitching = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _init());
  }

  Future<void> _init() async {
    try {
      final cameras = await availableCameras();
      final back = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.back,
        orElse: () => cameras.first,
      );
      _cam = CameraController(
        back,
        ResolutionPreset.medium,
        enableAudio: false,
      );
      await _cam!.initialize();
    } catch (e) {
      _error = 'Camera: $e';
      if (mounted && !_isDisposed) setState(() {});
      return;
    }

    final modes = VisionModeRegistry.modes;
    if (modes.isEmpty) {
      _error = 'No vision modes registered';
      if (mounted && !_isDisposed) setState(() {});
      return;
    }

    _selectedMode = modes.first;

    if (mounted && !_isDisposed) {
      setState(() => _ready = true);
      _startListening();
    }
  }

  void _startListening() {
    _manager.logEntries.listen((logs) {
      if (mounted && !_isDisposed) setState(() {
        _logs.clear();
        _logs.addAll(logs);
        _statusText = _manager.status.text;
      });
    });
    _manager.addListener(() {
      if (mounted && !_isDisposed) setState(() => _statusText = _manager.status.text);
    });
  }

  Future<void> _switchMode(VisionMode mode) async {
    if (_selectedMode?.id == mode.id || _isSwitching) return;
    if (mounted && !_isDisposed) setState(() => _isSwitching = true);
    try {
      await _manager.switchTo(mode);
      _selectedMode = mode;
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to switch: $e')),
        );
      }
    } finally {
      if (mounted && !_isDisposed) setState(() => _isSwitching = false);
    }
  }

  void _toggleInference() {
    _manager.toggleInference();
    if (mounted && !_isDisposed) setState(() {});
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      _cam?.stopImageStream();
      _manager.toggleInference();
    } else if (state == AppLifecycleState.resumed) {
      if (!_manager.inferenceActive) {
        _manager.toggleInference();
      }
    }
  }

  @override
  void dispose() {
    _isDisposed = true;
    WidgetsBinding.instance.removeObserver(this);
    _cam?.stopImageStream();
    _cam?.dispose();
    _manager.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Scaffold(
        backgroundColor: Colors.black,
        body: Center(child: Text(_error!, style: const TextStyle(color: Colors.redAccent))),
      );
    }
    if (!_ready) {
      return const Scaffold(
        backgroundColor: Colors.black,
        body: Center(child: CircularProgressIndicator(color: Colors.white30)),
      );
    }
    return _activeView();
  }

  Widget _activeView() {
    final previewSize = _cam!.value.previewSize;

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(fit: StackFit.expand, children: [
        LayoutBuilder(
          builder: (ctx, constraints) {
            double scaleX, scaleY, offsetX = 0, offsetY = 0;
            final ar = previewSize!.height / previewSize.width;
            final widgetAr = constraints.maxWidth / constraints.maxHeight;

            if (widgetAr > ar) {
              scaleY = constraints.maxHeight;
              scaleX = scaleY / ar;
              offsetX = (constraints.maxWidth - scaleX) / 2;
            } else {
              scaleX = constraints.maxWidth;
              scaleY = scaleX * ar;
              offsetY = (constraints.maxHeight - scaleY) / 2;
            }

            final painter = _manager.painter;
            if (painter is PosePainter) {
              painter.setTransform(scaleX, scaleY, offsetX, offsetY);
            } else if (painter is DetectPainter) {
              painter.setTransform(scaleX, scaleY, offsetX, offsetY);
            }

            return ClipRect(
              child: Stack(children: [
                FittedBox(
                  fit: BoxFit.cover,
                  child: SizedBox(
                    width: previewSize.width,
                    height: previewSize.height,
                    child: CameraPreview(_cam!),
                  ),
                ),
                Positioned.fill(
                  child: CustomPaint(
                    painter: _manager.painter,
                  ),
                ),
                Positioned.fill(
                  child: _selectedMode != null
                    ? YOLOView(
                        modelPath: _selectedMode!.modelId,
                        onResult: (results) {
                          for (final r in results) {
                            _manager.processResult(r);
                          }
                        },
                        onControllerReady: (ctrl) {
                          _manager.setController(ctrl);
                          _manager.switchTo(_selectedMode!);
                        },
                      )
                    : const SizedBox.shrink(),
                ),
              ]),
            );
          },
        ),

        Positioned(
          top: MediaQuery.of(context).padding.top + 4,
          left: 8,
          right: 8,
          child: Row(children: [
            GestureDetector(
              onTap: () => Navigator.of(context).pop(),
              child: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(8)),
                child: const Icon(Icons.arrow_back, color: Colors.white70, size: 20),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(8)),
                child: _isSwitching
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white54))
                  : DropdownButtonHideUnderline(
                      child: DropdownButton<VisionMode>(
                        value: _selectedMode,
                        isExpanded: true,
                        dropdownColor: const Color(0xFF1A1A2E),
                        style: const TextStyle(color: Colors.white70, fontSize: 13),
                        items: VisionModeRegistry.modes.map((m) => DropdownMenuItem(
                          value: m,
                          child: Text(m.label),
                        )).toList(),
                        onChanged: (m) => m != null ? _switchMode(m) : null,
                      ),
                    ),
              ),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: _toggleInference,
              child: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(8)),
                child: Icon(
                  _manager.inferenceActive ? Icons.stop : Icons.play_arrow,
                  color: Colors.white70,
                  size: 20,
                ),
              ),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const CameraSettingsPage()),
              ),
              child: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(8)),
                child: const Icon(Icons.settings, color: Colors.white70, size: 20),
              ),
            ),
          ]),
        ),

        Positioned(
          bottom: 0, left: 0, right: 0,
          height: 160,
          child: VisionLogPanel(
            entries: _logs,
            statusText: _statusText,
            onClear: () { _manager.clearLogs(); if (mounted && !_isDisposed) setState(() => _logs.clear()); },
          ),
        ),
      ]),
    );
  }
}
