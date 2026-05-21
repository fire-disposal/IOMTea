import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:ultralytics_yolo/ultralytics_yolo.dart';
import '../services/imu_sensor_service.dart';
import '../services/vision/vision_mode_registry.dart';

enum GroundDirection {
  portraitDown,
  portraitUp,
  landscapeLeft,
  landscapeRight,
  custom,
}

class _ModelInfo {
  final String modelId;
  final bool exists;
  final Map<String, dynamic>? metadata;
  final bool loading;

  const _ModelInfo({
    required this.modelId,
    this.exists = false,
    this.metadata,
    this.loading = false,
  });
}

class CameraSettingsPage extends StatefulWidget {
  const CameraSettingsPage({super.key});

  @override
  State<CameraSettingsPage> createState() => _CameraSettingsPageState();
}

class _CameraSettingsPageState extends State<CameraSettingsPage> {
  GroundDirection _direction = GroundDirection.portraitDown;
  double _customAngle = 0;
  double _prevAngle = 0;
  bool _calibrating = false;

  final List<_ModelInfo> _models = [];
  bool _modelLoading = true;

  @override
  void initState() {
    super.initState();
    _loadSettings();
    _loadModelInfo();
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString('ground_direction') ?? 'portraitDown';
    final angle = prefs.getDouble('ground_custom_angle') ?? 0;
    setState(() {
      _direction = GroundDirection.values.firstWhere((d) => d.name == saved, orElse: () => GroundDirection.portraitDown);
      _customAngle = angle;
      _prevAngle = angle;
    });
  }

  Future<void> _saveDirection(GroundDirection dir) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('ground_direction', dir.name);
    if (dir == GroundDirection.custom) {
      await prefs.setDouble('ground_custom_angle', _customAngle);
    }
    setState(() => _direction = dir);
  }

  void _setArrowAngle(double angle) {
    setState(() {
      _prevAngle = _customAngle;
      _customAngle = angle;
      _direction = GroundDirection.custom;
    });
    SharedPreferences.getInstance().then((p) {
      p.setString('ground_direction', GroundDirection.custom.name);
      p.setDouble('ground_custom_angle', angle);
    });
  }

  Future<void> _autoCalibrate() async {
    setState(() => _calibrating = true);
    try {
      final imu = ImuSensorService();
      final data = await imu.readOnce();
      if (data == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('IMU unavailable')),
          );
        }
        return;
      }

      final gx = data.accelX, gy = data.accelY, gz = data.accelZ;
      final mag = math.sqrt(gx * gx + gy * gy + gz * gz);
      if (mag < 0.5 || mag > 15) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Gravity reading unstable, hold device still')),
          );
        }
        return;
      }

      final angle = math.atan2(gy, gx) * 180 / math.pi;
      await SharedPreferences.getInstance().then((p) {
        p.setString('ground_direction', GroundDirection.custom.name);
        p.setDouble('ground_custom_angle', angle);
      });
      setState(() {
        _prevAngle = _customAngle;
        _direction = GroundDirection.custom;
        _customAngle = angle;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Calibrated: ${angle.toStringAsFixed(0)}\u00B0')),
        );
      }
    } finally {
      if (mounted) setState(() => _calibrating = false);
    }
  }

  Future<void> _loadModelInfo() async {
    final infos = <_ModelInfo>[];
    final modes = VisionModeRegistry.modes;
    for (final mode in modes) {
      try {
        final check = await YOLO.checkModelExists(mode.modelId);
        final exists = check['exists'] == true;
        Map<String, dynamic>? meta;
        if (exists) {
          try {
            meta = await YOLO.inspectModel(mode.modelId);
          } catch (_) {}
        }
        infos.add(_ModelInfo(modelId: mode.modelId, exists: exists, metadata: meta));
      } catch (_) {
        infos.add(_ModelInfo(modelId: mode.modelId));
      }
    }
    if (mounted) setState(() { _models.clear(); _models.addAll(infos); _modelLoading = false; });
  }

  Future<void> _downloadModel(String modelId, int index) async {
    setState(() => _models[index] = _ModelInfo(modelId: modelId, exists: _models[index].exists, metadata: _models[index].metadata, loading: true));
    try {
      final yolo = YOLO(modelPath: modelId, useGpu: false);
      await yolo.loadModel();
      await yolo.dispose();
      final check = await YOLO.checkModelExists(modelId);
      final meta = await YOLO.inspectModel(modelId);
      if (mounted) {
        setState(() => _models[index] = _ModelInfo(modelId: modelId, exists: check['exists'] == true, metadata: meta));
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$modelId downloaded')),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _models[index] = _ModelInfo(modelId: modelId, exists: _models[index].exists, metadata: _models[index].metadata));
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Download failed: $e')),
        );
      }
    }
  }

  static String _label(GroundDirection dir) => switch (dir) {
    GroundDirection.portraitDown => 'Upright (default)',
    GroundDirection.portraitUp => 'Ceiling mount',
    GroundDirection.landscapeLeft => 'Tabletop / desk',
    GroundDirection.landscapeRight => 'Tabletop / desk (alt)',
    GroundDirection.custom => 'Custom angle',
  };

  double _arrowAngleFor(GroundDirection dir) => switch (dir) {
    GroundDirection.portraitDown => 0,
    GroundDirection.portraitUp => 180,
    GroundDirection.landscapeLeft => 270,
    GroundDirection.landscapeRight => 90,
    GroundDirection.custom => _customAngle,
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F0F23),
      appBar: AppBar(
        title: const Text('Camera Settings'),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white70,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _sectionHeader('Ground Direction'),
          const SizedBox(height: 8),
          RadioGroup<GroundDirection>(
            groupValue: _direction,
            onChanged: (v) { if (v != null) _saveDirection(v); },
            child: Column(
              children: GroundDirection.values.map((d) => ListTile(
                title: Text(_label(d), style: const TextStyle(color: Colors.white70, fontSize: 14)),
                leading: Radio<GroundDirection>(value: d),
                dense: true,
                contentPadding: EdgeInsets.zero,
                onTap: () => _saveDirection(d),
              )).toList(),
            ),
          ),
          if (_direction == GroundDirection.custom) ...[
            const SizedBox(height: 12),
            _arrowSelector(),
          ],
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _calibrating ? null : _autoCalibrate,
              icon: _calibrating
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white54))
                : const Icon(Icons.sensors, size: 18, color: Colors.white70),
              label: Text(_calibrating ? 'Calibrating...' : 'Auto (IMU)', style: const TextStyle(color: Colors.white70, fontSize: 13)),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Colors.white24),
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
          const SizedBox(height: 24),
          _sectionHeader('Models'),
          const SizedBox(height: 8),
          _modelSection(),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _sectionHeader(String text) {
    return Text(text, style: const TextStyle(color: Colors.white54, fontSize: 12, fontWeight: FontWeight.w600));
  }

  Widget _arrowSelector() {
    const dirs = [
      ('\u2191', 0.0),
      ('\u2192', 90.0),
      ('\u2193', 180.0),
      ('\u2190', 270.0),
    ];

    final current = _arrowAngleFor(_direction);
    final active = dirs.firstWhere(
      (d) => (d.$2 - current).abs() < 1 || (d.$2 - current).abs() > 358,
      orElse: () => ('', -1.0),
    );

    return Column(children: [
      Container(
        width: 64, height: 64,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white24, width: 1),
        ),
        child: Center(
          child: TweenAnimationBuilder<double>(
            tween: Tween(begin: _prevAngle, end: current),
            duration: 400.ms,
            curve: Curves.easeOutCubic,
            builder: (context, angle, _) {
              return Transform.rotate(
                angle: angle * math.pi / 180,
                child: const Icon(Icons.arrow_upward, color: Color(0xFF00E676), size: 32),
              );
            },
          ),
        ),
      ),
      const SizedBox(height: 4),
      Text('${current.toStringAsFixed(0)}\u00B0', style: const TextStyle(color: Colors.white54, fontSize: 12)),
      const SizedBox(height: 8),
      Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const SizedBox(width: 40),
          _arrowBtn('\u2191', 0, active.$1 == '\u2191'),
          const SizedBox(width: 4),
          _arrowBtn('\u2192', 90, active.$1 == '\u2192'),
        ],
      ),
      const SizedBox(height: 4),
      Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _arrowBtn('\u2190', 270, active.$1 == '\u2190'),
          const SizedBox(width: 4),
          _arrowBtn('\u2193', 180, active.$1 == '\u2193'),
          const SizedBox(width: 4),
          const SizedBox(width: 40),
        ],
      ),
    ]);
  }

  Widget _arrowBtn(String label, double angle, bool active) {
    return GestureDetector(
      onTap: () => _setArrowAngle(angle),
      child: Container(
        width: 36, height: 36,
        decoration: BoxDecoration(
          color: active ? const Color(0xFF00E676).withValues(alpha: 0.15) : Colors.white10,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: active ? const Color(0xFF00E676).withValues(alpha: 0.5) : Colors.white12, width: 1),
        ),
        child: Center(
          child: Text(label, style: TextStyle(fontSize: 18, color: active ? const Color(0xFF00E676) : Colors.white38)),
        ),
      ),
    );
  }

  Widget _modelSection() {
    if (_modelLoading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 16),
        child: Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white30))),
      );
    }

    final modes = VisionModeRegistry.modes;
    if (modes.isEmpty) {
      return const Text('No vision modes registered', style: TextStyle(color: Colors.white38, fontSize: 13));
    }

    return Column(
      children: List.generate(modes.length, (i) {
        final mode = modes[i];
        final info = i < _models.length ? _models[i] : null;
        final exists = info?.exists ?? false;
        final meta = info?.metadata;
        final loading = info?.loading ?? false;

        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.white10, width: 0.5),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(
                child: Text(mode.label, style: const TextStyle(color: Colors.white70, fontSize: 14, fontWeight: FontWeight.w600)),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: exists ? const Color(0xFF00E676).withValues(alpha: 0.15) : Colors.white10,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  exists ? 'cached' : 'not downloaded',
                  style: TextStyle(fontSize: 10, color: exists ? const Color(0xFF00E676) : Colors.white38),
                ),
              ),
            ]),
            const SizedBox(height: 4),
            Text(mode.modelId, style: const TextStyle(color: Colors.white38, fontSize: 12, fontFamily: 'monospace')),
            const SizedBox(height: 2),
            Text('task: ${mode.task.name}', style: const TextStyle(color: Colors.white30, fontSize: 11)),
            if (meta != null) ...[
              const SizedBox(height: 4),
              Text(
                meta.entries.map((e) => '${e.key}: ${e.value}').join(' | '),
                style: const TextStyle(color: Colors.white24, fontSize: 10),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
            if (!exists) ...[
              const SizedBox(height: 8),
              AnimatedCrossFade(
                firstChild: SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: loading ? null : () => _downloadModel(mode.modelId, i),
                    style: OutlinedButton.styleFrom(
                      side: BorderSide(color: Colors.white.withValues(alpha: 0.15)),
                      padding: const EdgeInsets.symmetric(vertical: 6),
                    ),
                    child: const Text('Download', style: TextStyle(color: Colors.white54, fontSize: 12)),
                  ),
                ),
                secondChild: const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: LinearProgressIndicator(color: Color(0xFF00E676), backgroundColor: Colors.white10),
                ),
                crossFadeState: loading ? CrossFadeState.showSecond : CrossFadeState.showFirst,
                duration: 200.ms,
              ),
            ],
          ]),
        ).animate().fadeIn(delay: (i * 80).ms, duration: 300.ms);
      }),
    );
  }
}
