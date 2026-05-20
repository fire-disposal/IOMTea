import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/imu_sensor_service.dart';
import 'dart:math' as math;

enum GroundDirection {
  portraitDown,
  portraitUp,
  landscapeLeft,
  landscapeRight,
  custom,
}

class CameraSettingsPage extends StatefulWidget {
  const CameraSettingsPage({super.key});

  @override
  State<CameraSettingsPage> createState() => _CameraSettingsPageState();
}

class _CameraSettingsPageState extends State<CameraSettingsPage> {
  GroundDirection _direction = GroundDirection.portraitDown;
  double _customAngle = 0;
  bool _calibrating = false;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString('ground_direction') ?? 'portraitDown';
    final angle = prefs.getDouble('ground_custom_angle') ?? 0;
    setState(() {
      _direction = GroundDirection.values.firstWhere((d) => d.name == saved, orElse: () => GroundDirection.portraitDown);
      _customAngle = angle;
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
      await _saveDirection(GroundDirection.custom);
      await SharedPreferences.getInstance().then((p) => p.setDouble('ground_custom_angle', angle));
      setState(() {
        _direction = GroundDirection.custom;
        _customAngle = angle;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Calibrated: ${angle.toStringAsFixed(0)}°')),
        );
      }
    } finally {
      if (mounted) setState(() => _calibrating = false);
    }
  }

  static String _label(GroundDirection dir) => switch (dir) {
    GroundDirection.portraitDown => 'Upright (default)',
    GroundDirection.portraitUp => 'Ceiling mount',
    GroundDirection.landscapeLeft => 'Tabletop / desk',
    GroundDirection.landscapeRight => 'Tabletop / desk (alt)',
    GroundDirection.custom => 'Custom angle',
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
          const Text('Ground Direction', style: TextStyle(color: Colors.white54, fontSize: 12)),
          const SizedBox(height: 8),
          ...GroundDirection.values.map((d) => RadioListTile<GroundDirection>(
            title: Text(_label(d), style: const TextStyle(color: Colors.white70, fontSize: 14)),
            value: d,
            groupValue: _direction,
            activeColor: const Color(0xFF00E676),
            onChanged: (v) => v != null ? _saveDirection(v) : null,
            dense: true,
          )),
          if (_direction == GroundDirection.custom) ...[
            const SizedBox(height: 8),
            Row(children: [
              const Text('Angle: ', style: TextStyle(color: Colors.white54, fontSize: 13)),
              Expanded(
                child: Slider(
                  value: _customAngle,
                  min: -180, max: 180,
                  divisions: 72,
                  label: '${_customAngle.toStringAsFixed(0)}°',
                  activeColor: const Color(0xFF00E676),
                  onChanged: (v) {
                    setState(() => _customAngle = v);
                    SharedPreferences.getInstance().then((p) => p.setDouble('ground_custom_angle', v));
                  },
                ),
              ),
              Text('${_customAngle.toStringAsFixed(0)}°', style: const TextStyle(color: Colors.white54, fontSize: 12)),
            ]),
          ],
          const SizedBox(height: 16),
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
        ],
      ),
    );
  }
}
