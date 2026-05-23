import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:ultralytics_yolo/ultralytics_yolo.dart';
import '../services/vision/vision_mode.dart';
import '../services/vision/vision_mode_registry.dart';
import '../widgets/vision_log_panel.dart';
import '../widgets/ground_direction_indicator.dart';
import '../theme.dart';
import 'camera_settings_page.dart';

class CameraViewPage extends StatefulWidget {
  const CameraViewPage({super.key});

  @override
  State<CameraViewPage> createState() => _CameraViewPageState();
}

class _CameraViewPageState extends State<CameraViewPage>
    with WidgetsBindingObserver {
  final _controller = YOLOViewController();
  final _modes = VisionModeRegistry.modes;
  late VisionMode _mode;

  final List<VisionLogEntry> _logs = [];
  StreamSubscription<VisionLogEntry>? _logSub;
  bool _paused = false;
  String _statusText = '';
  bool _showLogs = false;

  int _frameCount = 0;

  String _groundDir = 'portraitDown';
  double _groundAngle = 0;

  static const _streamingConfig = YOLOStreamingConfig(
    includeDetections: true,
    includePoses: true,
    includeMasks: false,
    includeOBB: false,
    includeOriginalImage: false,
    skipFrames: 2,
    maxFPS: 10,
  );

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _mode = _modes.first;
    _listenToModeLogs();
    _loadGroundDir();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _mode.onActivate(_controller);
    });
  }

  void _listenToModeLogs() {
    _logSub?.cancel();
    _logSub = _mode.logStream.listen((entry) {
      if (mounted) {
        setState(() {
          _logs.add(entry);
          while (_logs.length > 200) { _logs.removeAt(0); }
        });
      }
    });
  }

  Future<void> _loadGroundDir() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _groundDir = prefs.getString('ground_direction') ?? 'portraitDown';
      _groundAngle = prefs.getDouble('ground_custom_angle') ?? 0;
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _paused = state == AppLifecycleState.paused || state == AppLifecycleState.inactive;
  }

  @override
  void dispose() {
    _logSub?.cancel();
    _mode.onDeactivate();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void _onResult(List<YOLOResult> results) {
    if (_paused) return;
    for (final r in results) {
      _mode.onFrame(r);
    }
    _mode.flushFrame();

    _frameCount++;
    if (_frameCount % 8 == 0) {
      final st = _mode.currentStatus.text;
      if (st != _statusText) {
        setState(() { _statusText = st; });
      }
    }
  }

  Future<void> _switchMode(VisionMode mode) async {
    if (_mode.id == mode.id) return;
    final old = _mode;
    await old.onDeactivate();
    setState(() {
      _mode = mode;
      _logs.clear();
      _statusText = '';
      _frameCount = 0;
    });
    _listenToModeLogs();
    await mode.onActivate(_controller);
  }

  void _clearLogs() => setState(() { _logs.clear(); });

  void _openSettings() async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const CameraSettingsPage()),
    );
    _loadGroundDir();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black.withValues(alpha: 0.6),
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        titleSpacing: 4,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: _buildModeDropdown(),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: _openSettings,
          ),
        ],
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          YOLOView(
            modelPath: _mode.modelId,
            task: _mode.task,
            controller: _controller,
            useGpu: false,
            confidenceThreshold: 0.15,
            showNativeUI: false,
            showOverlays: false,
            streamingConfig: _streamingConfig,
            lensFacing: LensFacing.back,
            onResult: _onResult,
          ),
          IgnorePointer(
            child: _DetectionOverlay(mode: _mode),
          ),
        ],
      ),
      bottomSheet: _showLogs
        ? VisionLogPanel(
            entries: _logs,
            statusText: _statusText,
            onClear: _clearLogs,
            onClose: () => setState(() => _showLogs = false),
          )
        : null,
      floatingActionButton: Padding(
        padding: const EdgeInsets.only(bottom: 56),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            GroundDirectionIndicator(
              direction: _groundDir, angle: _groundAngle, onTap: _openSettings),
            const SizedBox(height: 8),
            _logToggle(),
          ],
        ),
      ),
    );
  }

  Widget _buildModeDropdown() {
    return Container(
      height: 34,
      padding: const EdgeInsets.symmetric(horizontal: 6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(kChipRadius + 12),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<VisionMode>(
          value: _mode,
          isExpanded: true,
          icon: const Icon(Icons.arrow_drop_down, color: Colors.white70, size: 18),
          dropdownColor: const Color(0xFF1E1E2E),
          style: const TextStyle(
              fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white),
          selectedItemBuilder: (context) => _modes.map((m) {
            return DropdownMenuItem<VisionMode>(
              value: m,
              child: Align(
                alignment: Alignment.centerLeft,
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(
                      m.id == 'detect'
                          ? Icons.crop_free
                          : Icons.accessibility_new,
                      size: 14,
                      color: Colors.white70),
                  const SizedBox(width: 6),
                  Text(m.label,
                      style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Colors.white)),
                ]),
              ),
            );
          }).toList(),
          items: _modes.map((m) {
            return DropdownMenuItem<VisionMode>(
              value: m,
              child: Row(children: [
                Icon(
                    m.id == 'detect'
                        ? Icons.crop_free
                        : Icons.accessibility_new,
                    size: 16,
                    color: m.id == _mode.id ? matchaLight : Colors.white54),
                const SizedBox(width: 8),
                Text(m.label,
                    style: TextStyle(
                        color: m.id == _mode.id ? matchaLight : Colors.white70,
                        fontWeight: FontWeight.w600)),
              ]),
            );
          }).toList(),
          onChanged: (m) {
            if (m != null) _switchMode(m);
          },
        ),
      ),
    );
  }

  Widget _logToggle() {
    return GestureDetector(
      onTap: () => setState(() => _showLogs = !_showLogs),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: _showLogs
              ? Colors.white.withValues(alpha: 0.18)
              : Colors.black.withValues(alpha: 0.55),
          borderRadius: BorderRadius.circular(kChipRadius + 12),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              _showLogs ? Icons.terminal : Icons.terminal_outlined,
              size: 13,
              color: _showLogs ? const Color(0xFF00E676) : Colors.white54,
            ),
            if (_logs.isNotEmpty) ...[
              const SizedBox(width: 4),
              Text(
                '${_logs.length}',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  fontFamily: 'monospace',
                  color: _showLogs ? const Color(0xFF00E676) : Colors.white54,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _DetectionOverlay extends StatefulWidget {
  final VisionMode mode;
  const _DetectionOverlay({required this.mode});

  @override
  State<_DetectionOverlay> createState() => _DetectionOverlayState();
}

class _DetectionOverlayState extends State<_DetectionOverlay>
    with TickerProviderStateMixin {
  late final Ticker _ticker;

  @override
  void initState() {
    super.initState();
    _ticker = createTicker((_) => setState(() {}));
    _ticker.start();
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: CustomPaint(painter: widget.mode.painter),
    );
  }
}
