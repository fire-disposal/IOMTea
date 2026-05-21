import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:ultralytics_yolo/ultralytics_yolo.dart';
import '../services/vision/vision_mode.dart';
import '../services/vision/vision_mode_registry.dart';
import '../widgets/vision_log_panel.dart';
import '../widgets/ground_direction_indicator.dart';
import 'camera_settings_page.dart';

class CameraViewPage extends StatefulWidget {
  const CameraViewPage({super.key});

  @override
  State<CameraViewPage> createState() => _CameraViewPageState();
}

class _CameraViewPageState extends State<CameraViewPage> with WidgetsBindingObserver {
  final _controller = YOLOViewController();
  final _modes = VisionModeRegistry.modes;
  late VisionMode _mode;
  int _viewKey = 0;

  final List<VisionLogEntry> _logs = [];
  String _statusText = '';
  bool _paused = false;

  String _groundDir = 'portraitDown';
  double _groundAngle = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _mode = _modes.first;
    _loadGroundDir();
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
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void _onResult(List<YOLOResult> results) {
    if (_paused) return;
    final now = DateTime.now();
    final count = results.length;
    final best = results.isNotEmpty
      ? '${results.first.className} ${results.first.confidence.toStringAsFixed(2)}'
      : '';
    setState(() {
      _statusText = count > 0 ? '$count items | $best' : '0 items';
      for (final r in results.take(5)) {
        _logs.add(VisionLogEntry(time: now, message: '${r.className} ${r.confidence.toStringAsFixed(2)}'));
      }
      while (_logs.length > 200) { _logs.removeAt(0); }
    });
  }

  void _switchMode(VisionMode mode) {
    if (_mode.id == mode.id) return;
    setState(() {
      _mode = mode;
      _viewKey++;
      _logs.clear();
      _statusText = '';
    });
  }

  void _clearLogs() => setState(() { _logs.clear(); _statusText = ''; });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(fit: StackFit.expand, children: [
        AnimatedSwitcher(
          duration: 300.ms,
          child: YOLOView(
            key: ValueKey('${_mode.id}-$_viewKey'),
            modelPath: _mode.modelId,
            task: _mode.task,
            controller: _controller,
            useGpu: false,
            showNativeUI: false,
            onResult: _onResult,
          ),
        ),
        _topBar(),
        Positioned(
          bottom: 0, left: 0, right: 0,
          child: VisionLogPanel(entries: _logs, statusText: _statusText, onClear: _clearLogs)
              .animate()
              .slideY(begin: 1, duration: 300.ms, curve: Curves.easeOut)
              .fadeIn(duration: 200.ms),
        ),
        Positioned(
          bottom: 140, right: 8,
          child: GroundDirectionIndicator(
            direction: _groundDir, angle: _groundAngle,
            onTap: () async {
              await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const CameraSettingsPage()));
              _loadGroundDir();
            },
          ).animate().fadeIn(delay: 500.ms, duration: 300.ms),
        ),
      ]),
    );
  }

  Widget _topBar() {
    final top = MediaQuery.of(context).padding.top + 4;
    return Positioned(
      top: top, left: 8, right: 8,
      child: Row(children: [
        _barChip(Icons.arrow_back, onTap: () => Navigator.of(context).pop()),
        const SizedBox(width: 8),
        Expanded(
          child: Container(
            height: 36,
            padding: const EdgeInsets.symmetric(horizontal: 4),
            decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(8)),
            child: Row(
              children: _modes.map((m) {
                final active = _mode.id == m.id;
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 2),
                  child: ChoiceChip(
                    label: Text(m.label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: active ? Colors.white : Colors.white54)),
                    selected: active,
                    selectedColor: Colors.white24,
                    backgroundColor: Colors.transparent,
                    side: BorderSide.none,
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    visualDensity: VisualDensity.compact,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                    onSelected: (_) => _switchMode(m),
                  ),
                );
              }).toList(),
            ),
          ),
        ),
        const SizedBox(width: 8),
        _barChip(Icons.settings, onTap: () async {
          await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const CameraSettingsPage()));
          _loadGroundDir();
        }),
      ]),
    );
  }

  Widget _barChip(IconData icon, {VoidCallback? onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 36, height: 36,
        decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(8)),
        child: Icon(icon, color: Colors.white70, size: 20),
      ),
    );
  }
}
