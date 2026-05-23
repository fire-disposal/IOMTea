# Flutter UX Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple PIN from dashboard gate and MQTT transmission; add flutter_animate; optimize all page UIs.

**Architecture:** Dashboard-first navigation (HomePage always shows mode cards), PIN as optional server verification separate from MQTT. EventEmitter uses deviceId for MQTT topics, includes PIN in payload only when set. All pages receive staggered entry animations and polished UX via flutter_animate.

**Tech Stack:** Flutter 3.27+, go_router 14, flutter_animate 4.5, mqtt_client, sensors_plus, ultralytics_yolo

---

### Task 1: Add `flutter_animate` dependency

**Files:**
- Modify: `apps/flutter/pubspec.yaml`
- Modify: `apps/flutter/lib/main.dart`

- [ ] **Step 1: Add dependency to pubspec.yaml**

Open `apps/flutter/pubspec.yaml`. Add `flutter_animate: ^4.5.2` under dependencies, between the `shared_preferences` and `ultralytics_yolo` entries:

```yaml
  # 存储
  shared_preferences: ^2.3.0

  # 动画
  flutter_animate: ^4.5.2

  # YOLO
  ultralytics_yolo: ^0.3.4
```

- [ ] **Step 2: Run pub get**

```bash
cd apps/flutter; flutter pub get
```

Expected: `exit code 0`, packages resolved successfully.

- [ ] **Step 3: Add global import in main.dart**

Open `apps/flutter/lib/main.dart`. Add import for flutter_animate after the existing flutter imports:

```dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:ultralytics_yolo/ultralytics_yolo.dart';
```

- [ ] **Step 4: Commit**

```bash
git add apps/flutter/pubspec.yaml apps/flutter/pubspec.lock apps/flutter/lib/main.dart
git commit -m "chore(flutter): add flutter_animate dependency"
```

---

### Task 2: Add deviceId to PinService

**Files:**
- Modify: `apps/flutter/lib/services/pin_service.dart`

- [ ] **Step 1: Add deviceId property and generation logic**

At the top of `pin_service.dart`, add `'dart:math'` import. Add `String _deviceId = ''` and `String get deviceId => _deviceId` next to the existing `_currentPin` field. Add UUID generation in `loadSavedPin()`.

Full modified `pin_service.dart`:

```dart
import 'dart:convert';
import 'dart:math';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class PinInfo {
  final String pin;
  final String nickname;
  final String label;
  PinInfo({required this.pin, required this.nickname, required this.label});
}

class PinService {
  static final instance = PinService._();
  PinService._();

  PinInfo? _currentPin;
  PinInfo? get currentPin => _currentPin;
  bool get hasPin => _currentPin != null;

  String _deviceId = '';
  String get deviceId => _deviceId;

  String serverUrl = 'http://localhost:3000';

  String _generateDeviceId() {
    final r = Random();
    return '${DateTime.now().millisecondsSinceEpoch}-${r.nextInt(999999).toString().padLeft(6, '0')}';
  }

  Future<void> loadSavedPin() async {
    final prefs = await SharedPreferences.getInstance();
    final pin = prefs.getString('pin_code');
    final nickname = prefs.getString('pin_nickname') ?? '';
    final label = prefs.getString('pin_label') ?? '';
    serverUrl = prefs.getString('server_url') ?? 'http://localhost:3000';
    _deviceId = prefs.getString('device_id') ?? '';
    if (_deviceId.isEmpty) {
      _deviceId = _generateDeviceId();
      await prefs.setString('device_id', _deviceId);
    }
    if (pin != null && pin.length >= 4) {
      _currentPin = PinInfo(pin: pin, nickname: nickname, label: label);
    }
  }

  Future<bool> verifyPin(String pin) async {
    try {
      final url = '$serverUrl/trpc/pin.verify?input=${Uri.encodeComponent(jsonEncode({"pin": pin}))}';
      final res = await http.get(Uri.parse(url)).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) return true;
      return false;
    } catch (_) {
      return false;
    }
  }

  Future<void> savePin(String pin, {String nickname = '', String label = ''}) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('pin_code', pin);
    await prefs.setString('pin_nickname', nickname);
    await prefs.setString('pin_label', label);
    _currentPin = PinInfo(pin: pin, nickname: nickname, label: label);
  }

  Future<void> clearPin() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('pin_code');
    await prefs.remove('pin_nickname');
    await prefs.remove('pin_label');
    _currentPin = null;
  }
}
```

- [ ] **Step 2: Verify no compile errors**

```bash
cd apps/flutter; dart analyze lib/services/pin_service.dart
```

Expected: no issues.

- [ ] **Step 3: Commit**

```bash
git add apps/flutter/lib/services/pin_service.dart
git commit -m "feat(flutter): add deviceId generation to PinService"
```

---

### Task 3: Create PinSetupPage (extract from HomePage)

**Files:**
- Create: `apps/flutter/lib/pages/pin_setup_page.dart`

- [ ] **Step 1: Write PinSetupPage**

Create `apps/flutter/lib/pages/pin_setup_page.dart`:

```dart
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../services/pin_service.dart';
import '../theme.dart';

class PinSetupPage extends StatefulWidget {
  const PinSetupPage({super.key});
  @override
  State<PinSetupPage> createState() => _PinSetupPageState();
}

enum _PinScreenState { input, verifying, success }

class _PinSetupPageState extends State<PinSetupPage>
    with SingleTickerProviderStateMixin {
  _PinScreenState _pinState = _PinScreenState.input;
  final _pinInput = <String>[];
  String? _pinError;
  late final AnimationController _bgAnim;

  @override
  void initState() {
    super.initState();
    _bgAnim = AnimationController(
      duration: const Duration(seconds: 6),
      vsync: this,
    )..repeat();
  }

  @override
  void dispose() {
    _bgAnim.dispose();
    super.dispose();
  }

  void _onDigit(String d) {
    if (_pinInput.length >= 6) return;
    setState(() { _pinInput.add(d); _pinError = null; });
  }

  void _onBackspace() {
    if (_pinInput.isEmpty) return;
    setState(() => _pinInput.removeLast());
  }

  Future<void> _onVerify() async {
    if (_pinInput.length < 4) {
      setState(() => _pinError = '请输入至少4位PIN码');
      return;
    }
    setState(() => _pinState = _PinScreenState.verifying);
    final ok = await PinService.instance.verifyPin(_pinInput.join());
    if (!mounted) return;
    if (ok) {
      await PinService.instance.savePin(_pinInput.join());
      setState(() { _pinState = _PinScreenState.success; _pinInput.clear(); _pinError = null; });
      await Future.delayed(const Duration(milliseconds: 900));
      if (mounted) Navigator.of(context).pop(true);
    } else {
      setState(() { _pinState = _PinScreenState.input; _pinError = 'PIN码验证失败，请重试'; _pinInput.clear(); });
    }
  }

  void _skipPin() {
    Navigator.of(context).pop(false);
  }

  @override
  Widget build(BuildContext context) {
    if (_pinState == _PinScreenState.success) return _buildSuccessScreen();
    return _buildPinScreen();
  }

  Widget _buildSuccessScreen() {
    return Scaffold(
      backgroundColor: creamBg,
      body: AnimatedBuilder(
        animation: _bgAnim,
        builder: (context, child) {
          final t = _bgAnim.value;
          return Stack(
            children: [
              CustomPaint(
                size: MediaQuery.of(context).size,
                painter: _SuccessBgPainter(t: t),
              ),
              Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 80, height: 80,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: successGreen.withValues(alpha: 0.15),
                        boxShadow: [
                          BoxShadow(color: successGreen.withValues(alpha: 0.4), blurRadius: 24, spreadRadius: 4),
                        ],
                      ),
                      child: const Icon(Icons.check, size: 44, color: successGreen),
                    ).animate().scale(
                      begin: const Offset(0, 0),
                      duration: 500.ms,
                      curve: Curves.elasticOut,
                    ),
                    const SizedBox(height: 20),
                    const Text('验证成功', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w600, color: textPrimary))
                      .animate().fadeIn(duration: 400.ms),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildPinScreen() {
    final verifying = _pinState == _PinScreenState.verifying;
    return Scaffold(
      backgroundColor: creamBg,
      appBar: AppBar(
        title: const Text('设备验证'),
        backgroundColor: Colors.transparent,
        foregroundColor: textPrimary,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.of(context).pop(false),
        ),
      ),
      body: AnimatedBuilder(
        animation: _bgAnim,
        builder: (context, child) {
          final t = _bgAnim.value;
          return Stack(
            children: [
              CustomPaint(
                size: MediaQuery.of(context).size,
                painter: _PinBgPainter(t: t),
              ),
              SafeArea(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 32),
                  child: Column(
                    children: [
                      const Spacer(flex: 2),
                      Icon(Icons.lock_outline, size: 52, color: matchaPrimary),
                      const SizedBox(height: 16),
                      Text('设备验证', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w600, color: textPrimary)),
                      const SizedBox(height: 8),
                      Text('请输入设备PIN码', style: TextStyle(color: textSecondary, fontSize: 15)),
                      const SizedBox(height: 36),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: List.generate(6, (i) {
                          final filled = i < _pinInput.length;
                          return Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 6),
                            child: AnimatedScale(
                              scale: filled ? 1.0 : 0.85,
                              duration: const Duration(milliseconds: 200),
                              curve: Curves.easeOutBack,
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 200),
                                width: 20, height: 20,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: filled ? matchaPrimary : Colors.transparent,
                                  border: Border.all(
                                    color: filled ? matchaPrimary : Colors.grey.shade300,
                                    width: 2,
                                  ),
                                  boxShadow: filled
                                    ? [BoxShadow(color: matchaPrimary.withValues(alpha: 0.5), blurRadius: 10, spreadRadius: 2)]
                                    : null,
                                ),
                              ),
                            ),
                          );
                        }),
                      ),
                      const SizedBox(height: 16),
                      if (_pinError != null)
                        Text(_pinError!, style: const TextStyle(color: errorRed, fontSize: 14)),
                      const Spacer(flex: 1),
                      _buildKeypad(verifying),
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              ),
              Positioned(
                top: MediaQuery.of(context).padding.top + 8,
                right: 16,
                child: TextButton.icon(
                  onPressed: verifying ? null : _skipPin,
                  icon: const Icon(Icons.science, size: 16),
                  label: const Text('测试跳过', style: TextStyle(fontSize: 12)),
                  style: TextButton.styleFrom(
                    foregroundColor: warningOrange.withValues(alpha: 0.7),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildKeypad(bool verifying) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        _buildKeyRow(['1', '2', '3'], verifying),
        const SizedBox(height: 10),
        _buildKeyRow(['4', '5', '6'], verifying),
        const SizedBox(height: 10),
        _buildKeyRow(['7', '8', '9'], verifying),
        const SizedBox(height: 10),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const SizedBox(width: 72),
            _KeyBtn(text: '0', onTap: verifying ? null : () => _onDigit('0')),
            const SizedBox(width: 10),
            _BackBtn(onTap: verifying ? null : _onBackspace),
          ],
        ),
        const SizedBox(height: 28),
        SizedBox(
          width: 240, height: 50,
          child: FilledButton(
            onPressed: verifying ? null : _onVerify,
            style: FilledButton.styleFrom(
              backgroundColor: matchaPrimary,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            child: verifying
              ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
              : const Text('验证', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
          ),
        ),
      ],
    );
  }

  Widget _buildKeyRow(List<String> keys, bool verifying) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: keys.map((k) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 5),
        child: _KeyBtn(text: k, onTap: verifying ? null : () => _onDigit(k)),
      )).toList(),
    );
  }
}

class _KeyBtn extends StatelessWidget {
  final String text;
  final VoidCallback? onTap;
  const _KeyBtn({required this.text, this.onTap});
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 72, height: 52,
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        elevation: 1,
        shadowColor: Colors.black12,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: Center(child: Text(text,
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w500, color: textPrimary))),
        ),
      ),
    );
  }
}

class _BackBtn extends StatelessWidget {
  final VoidCallback? onTap;
  const _BackBtn({this.onTap});
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 72, height: 52,
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        elevation: 1,
        shadowColor: Colors.black12,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: const Center(child: Icon(Icons.backspace_outlined, color: textPrimary)),
        ),
      ),
    );
  }
}

class _PinBgPainter extends CustomPainter {
  final double t;
  _PinBgPainter({required this.t});
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint();
    for (int i = 0; i < 3; i++) {
      final cx = size.width * (0.2 + i * 0.3);
      final cy = size.height * (0.3 + i * 0.2);
      final radius = 80 + math.sin(t * 1.5 + i * 2.0) * 20;
      paint.color = matchaLight.withValues(alpha: 0.06 + 0.03 * math.sin(t * 0.8 + i));
      canvas.drawCircle(Offset(cx, cy), radius, paint);
    }
  }
  @override
  bool shouldRepaint(covariant _PinBgPainter old) => old.t != t;
}

class _SuccessBgPainter extends CustomPainter {
  final double t;
  _SuccessBgPainter({required this.t});
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint();
    final cx = size.width / 2;
    final cy = size.height / 2;
    for (int i = 0; i < 6; i++) {
      final angle = i * math.pi / 3 + t * math.pi;
      final r = 60 + math.sin(t * 3 + i) * 15;
      paint.color = successGreen.withValues(alpha: 0.08 + 0.04 * math.sin(t * 2 + i));
      canvas.drawCircle(Offset(cx + math.cos(angle) * r, cy + math.sin(angle) * r), 40, paint);
    }
  }
  @override
  bool shouldRepaint(covariant _SuccessBgPainter old) => old.t != t;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/flutter/lib/pages/pin_setup_page.dart
git commit -m "feat(flutter): extract PinSetupPage from HomePage"
```

---

### Task 4: Decouple EventEmitter from PIN

**Files:**
- Modify: `apps/flutter/lib/services/event_emitter.dart`

- [ ] **Step 1: Rewrite EventEmitter to use deviceId, make pinCode optional**

Replace the entire `apps/flutter/lib/services/event_emitter.dart`:

```dart
import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'mqtt_service.dart';
import 'pin_service.dart';

enum DeviceEventType { roomEnter, roomExit, fallDetected, actionDetected }

class DeviceEvent {
  final DeviceEventType type;
  final String? roomId;
  final String? action;
  final double? confidence;
  final Map<String, dynamic> metadata;

  const DeviceEvent({
    required this.type,
    this.roomId,
    this.action,
    this.confidence,
    this.metadata = const {},
  });
}

class EventEmitter {
  static void emit(DeviceEvent event) {
    final pin = PinService.instance.currentPin?.pin;
    final deviceId = PinService.instance.deviceId;
    final payload = <String, dynamic>{
      'deviceId': deviceId,
      'event': event.type.name,
      'roomId': event.roomId,
      'action': event.action,
      'confidence': event.confidence,
      'metadata': event.metadata,
    };
    if (pin != null) {
      payload['pin'] = pin;
    }
    _send(payload);
  }

  static void emitPresence(String roomId, bool present, {String? action}) {
    final pin = PinService.instance.currentPin?.pin;
    final deviceId = PinService.instance.deviceId;
    final payload = <String, dynamic>{
      'deviceId': deviceId,
      'event': 'presenceUpdate',
      'roomId': roomId,
      'personPresent': present,
      'action': action,
    };
    if (pin != null) {
      payload['pin'] = pin;
    }
    _send(payload);
  }

  static void _send(Map<String, dynamic> payload) {
    final topicId = payload['pin'] ?? payload['deviceId'] ?? 'unknown';
    if (MqttService.instance.currentStatus.name == 'connected') {
      MqttService.instance.publish(
        topic: 'iomtea/device/$topicId/events',
        message: jsonEncode(payload),
      );
    }

    unawaited(_httpSend(payload));
  }

  static Future<void> _httpSend(Map<String, dynamic> payload) async {
    try {
      await http.post(
        Uri.parse('${PinService.instance.serverUrl}/trpc/homeGraph.reportDeviceEvent'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(payload),
      ).timeout(const Duration(seconds: 3));
    } catch (_) {}
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/flutter/lib/services/event_emitter.dart
git commit -m "refactor(flutter): decouple EventEmitter from PIN, use deviceId as fallback"
```

---

### Task 5: Refactor HomePage — dashboard-first with PIN banner

**Files:**
- Modify: `apps/flutter/lib/pages/home_page.dart`

- [ ] **Step 1: Rewrite HomePage**

Replace the entire `apps/flutter/lib/pages/home_page.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import '../services/pin_service.dart';
import '../services/mqtt_service.dart';
import '../theme.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});
  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  bool _showBanner = false;
  bool _bannerDismissed = false;

  @override
  void initState() {
    super.initState();
    _showBanner = !PinService.instance.hasPin;
    MqttService.instance.statusStream.listen((s) {
      if (mounted) setState(() {});
    });
  }

  Future<void> _openPinSetup() async {
    final result = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const _PinSetupEntry()),
    );
    if (mounted) {
      if (result == true) {
        setState(() { _showBanner = false; _bannerDismissed = false; });
      } else {
        setState(() { _bannerDismissed = true; });
      }
    }
  }

  void _dismissBanner() {
    setState(() { _showBanner = false; _bannerDismissed = true; });
  }

  @override
  Widget build(BuildContext context) {
    final mqttOk = MqttService.instance.currentStatus.name == 'connected';
    final hasPin = PinService.instance.hasPin;

    return Scaffold(
      backgroundColor: creamBg,
      appBar: AnimatedGradientAppBar(
        title: 'IOMTea Tools',
        subtitle: Row(mainAxisSize: MainAxisSize.min, children: [
          if (hasPin) ...[
            Icon(Icons.fingerprint, size: 12, color: Colors.white.withValues(alpha: 0.7)),
            const SizedBox(width: 4),
            Text('已认证', style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.7))),
            const SizedBox(width: 10),
          ],
          Container(width: 5, height: 5, decoration: BoxDecoration(shape: BoxShape.circle, color: mqttOk ? const Color(0xFF81C784) : Colors.white38)),
          const SizedBox(width: 4),
          Text(mqttOk ? 'MQTT 在线' : '离线', style: TextStyle(fontSize: 11, color: mqttOk ? const Color(0xFF81C784) : Colors.white38)),
        ]),
        actions: [
          IconButton(icon: const Icon(Icons.settings_outlined), onPressed: () async {
            await context.push('/settings');
            if (mounted) setState(() { _showBanner = !PinService.instance.hasPin && !_bannerDismissed; });
          }),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(children: [
          if (_showBanner) _buildPinBanner().animate().slideY(begin: -1, duration: 400.ms, curve: Curves.easeOut),
          const SizedBox(height: 8),
          Expanded(
            child: GridView.count(
              crossAxisCount: 2,
              mainAxisSpacing: 16,
              crossAxisSpacing: 16,
              childAspectRatio: 0.85,
              children: [
                _ModeCard(
                  icon: Icons.watch, label: '可穿戴设备',
                  sublabel: 'IMU 跌倒检测\n加速度·陀螺仪', color: matchaPrimary,
                  onTap: () => context.push('/wearable'),
                ).animate().fadeIn(delay: 100.ms, duration: 400.ms).slideY(begin: 0.1, duration: 400.ms),
                _ModeCard(
                  icon: Icons.videocam, label: '固定设备',
                  sublabel: 'YOLO 视觉检测\n识别 + 姿态估计', color: infoBlue,
                  onTap: () => context.push('/fixed-device'),
                ).animate().fadeIn(delay: 200.ms, duration: 400.ms).slideY(begin: 0.1, duration: 400.ms),
                _ModeCard(
                  icon: Icons.bug_report, label: '事件模拟',
                  sublabel: hasPin ? '健康数据生成\n批量事件上报' : '需先设置PIN码\n方可使用此功能',
                  color: hasPin ? warningOrange : Colors.grey,
                  onTap: hasPin
                    ? () => context.push('/debug')
                    : () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('请先设置设备PIN码'), duration: Duration(seconds: 2)),
                        );
                      },
                ).animate().fadeIn(delay: 300.ms, duration: 400.ms).slideY(begin: 0.1, duration: 400.ms),
              ],
            ),
          ),
        ]),
      ),
    );
  }

  Widget _buildPinBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [matchaPrimary.withValues(alpha: 0.12), matchaLight.withValues(alpha: 0.06)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: matchaPrimary.withValues(alpha: 0.25), width: 1),
      ),
      child: Row(children: [
        Container(
          width: 40, height: 40,
          decoration: BoxDecoration(
            color: matchaPrimary.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Icon(Icons.lock_outline, color: matchaPrimary, size: 22),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('设置设备PIN码', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: textPrimary)),
              const SizedBox(height: 2),
              Text('绑定后可解锁设备管理与事件上报', style: TextStyle(fontSize: 12, color: textSecondary)),
            ],
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          height: 34,
          child: FilledButton(
            onPressed: _openPinSetup,
            style: FilledButton.styleFrom(
              backgroundColor: matchaPrimary,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('去设置', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
          ),
        ),
        const SizedBox(width: 4),
        GestureDetector(
          onTap: _dismissBanner,
          child: const Padding(
            padding: EdgeInsets.all(4),
            child: Icon(Icons.close, size: 16, color: textSecondary),
          ),
        ),
      ]),
    );
  }
}

class _PinSetupEntry extends StatelessWidget {
  const _PinSetupEntry();
  @override
  Widget build(BuildContext context) {
    final p = import('pin_setup_page.dart');
    throw UnimplementedError('Use PinSetupPage directly');
  }
}
```

Wait — the `_PinSetupEntry` approach with import won't work in a clean way. Let me just import PinSetupPage directly.

- [ ] **Step 1 (revised): Rewrite HomePage with proper import**

Replace the entire `apps/flutter/lib/pages/home_page.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import '../services/pin_service.dart';
import '../services/mqtt_service.dart';
import '../theme.dart';
import 'pin_setup_page.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});
  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  bool _showBanner = false;
  bool _bannerDismissed = false;

  @override
  void initState() {
    super.initState();
    _showBanner = !PinService.instance.hasPin;
    MqttService.instance.statusStream.listen((s) {
      if (mounted) setState(() {});
    });
  }

  Future<void> _openPinSetup() async {
    final result = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const PinSetupPage()),
    );
    if (mounted) {
      if (result == true) {
        setState(() { _showBanner = false; _bannerDismissed = false; });
      } else {
        setState(() { _bannerDismissed = true; });
      }
    }
  }

  void _dismissBanner() {
    setState(() { _showBanner = false; _bannerDismissed = true; });
  }

  @override
  Widget build(BuildContext context) {
    final mqttOk = MqttService.instance.currentStatus.name == 'connected';
    final hasPin = PinService.instance.hasPin;

    return Scaffold(
      backgroundColor: creamBg,
      appBar: AnimatedGradientAppBar(
        title: 'IOMTea Tools',
        subtitle: Row(mainAxisSize: MainAxisSize.min, children: [
          if (hasPin) ...[
            Icon(Icons.fingerprint, size: 12, color: Colors.white.withValues(alpha: 0.7)),
            const SizedBox(width: 4),
            Text('已认证', style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.7))),
            const SizedBox(width: 10),
          ],
          Container(width: 5, height: 5, decoration: BoxDecoration(shape: BoxShape.circle, color: mqttOk ? const Color(0xFF81C784) : Colors.white38)),
          const SizedBox(width: 4),
          Text(mqttOk ? 'MQTT 在线' : '离线', style: TextStyle(fontSize: 11, color: mqttOk ? const Color(0xFF81C784) : Colors.white38)),
        ]),
        actions: [
          IconButton(icon: const Icon(Icons.settings_outlined), onPressed: () async {
            await context.push('/settings');
            if (mounted) setState(() { _showBanner = !PinService.instance.hasPin && !_bannerDismissed; });
          }),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(children: [
          if (_showBanner)
            _buildPinBanner()
              .animate()
              .slideY(begin: -1, duration: 400.ms, curve: Curves.easeOut)
              .fadeIn(duration: 300.ms),
          const SizedBox(height: 8),
          Expanded(
            child: GridView.count(
              crossAxisCount: 2,
              mainAxisSpacing: 16,
              crossAxisSpacing: 16,
              childAspectRatio: 0.85,
              children: [
                _ModeCard(
                  icon: Icons.watch, label: '可穿戴设备',
                  sublabel: 'IMU 跌倒检测\n加速度·陀螺仪', color: matchaPrimary,
                  onTap: () => context.push('/wearable'),
                )
                  .animate()
                  .fadeIn(delay: 100.ms, duration: 400.ms)
                  .slideY(begin: 0.1, duration: 400.ms),
                _ModeCard(
                  icon: Icons.videocam, label: '固定设备',
                  sublabel: 'YOLO 视觉检测\n识别 + 姿态估计', color: infoBlue,
                  onTap: () => context.push('/fixed-device'),
                )
                  .animate()
                  .fadeIn(delay: 200.ms, duration: 400.ms)
                  .slideY(begin: 0.1, duration: 400.ms),
                _ModeCard(
                  icon: Icons.bug_report, label: '事件模拟',
                  sublabel: hasPin ? '健康数据生成\n批量事件上报' : '需先设置PIN码',
                  color: hasPin ? warningOrange : Colors.grey,
                  onTap: hasPin
                    ? () => context.push('/debug')
                    : () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('请先设置设备PIN码'), duration: Duration(seconds: 2)),
                        );
                      },
                )
                  .animate()
                  .fadeIn(delay: 300.ms, duration: 400.ms)
                  .slideY(begin: 0.1, duration: 400.ms),
              ],
            ),
          ),
        ]),
      ),
    );
  }

  Widget _buildPinBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [matchaPrimary.withValues(alpha: 0.12), matchaLight.withValues(alpha: 0.06)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: matchaPrimary.withValues(alpha: 0.25), width: 1),
      ),
      child: Row(children: [
        Container(
          width: 40, height: 40,
          decoration: BoxDecoration(
            color: matchaPrimary.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Icon(Icons.lock_outline, color: matchaPrimary, size: 22),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('设置设备PIN码', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: textPrimary)),
              const SizedBox(height: 2),
              Text('绑定后可解锁设备管理与事件上报', style: TextStyle(fontSize: 12, color: textSecondary)),
            ],
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          height: 34,
          child: FilledButton(
            onPressed: _openPinSetup,
            style: FilledButton.styleFrom(
              backgroundColor: matchaPrimary,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('去设置', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
          ),
        ),
        const SizedBox(width: 4),
        GestureDetector(
          onTap: _dismissBanner,
          child: const Padding(
            padding: EdgeInsets.all(4),
            child: Icon(Icons.close, size: 16, color: textSecondary),
          ),
        ),
      ]),
    );
  }
}

class _ModeCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String sublabel;
  final Color color;
  final VoidCallback onTap;

  const _ModeCard({
    required this.icon,
    required this.label,
    required this.sublabel,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        elevation: 1,
        shadowColor: Colors.black12,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 12),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 56, height: 56,
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    colors: [color.withValues(alpha: 0.85), color.withValues(alpha: 0.25)],
                  ),
                  shape: BoxShape.circle,
                  boxShadow: [BoxShadow(color: color.withValues(alpha: 0.3), blurRadius: 16)],
                ),
                child: Icon(icon, size: 28, color: Colors.white),
              ),
              const SizedBox(height: 14),
              Text(label, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: textPrimary), textAlign: TextAlign.center),
              const SizedBox(height: 6),
              Text(sublabel, style: TextStyle(fontSize: 10, color: textSecondary, height: 1.4), textAlign: TextAlign.center),
            ],
          ),
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/flutter/lib/pages/home_page.dart
git commit -m "refactor(flutter): dashboard-first HomePage with PIN setup banner"
```

---

### Task 6: Add page transitions to go_router

**Files:**
- Modify: `apps/flutter/lib/app.dart`

- [ ] **Step 1: Replace GoRouter with pageBuilder-based routes with slide transitions**

Replace the entire `apps/flutter/lib/app.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'theme.dart';
import 'pages/home_page.dart';
import 'pages/wearable_page.dart';
import 'pages/camera_view_page.dart';
import 'pages/debug_simulator_page.dart';
import 'pages/settings_page.dart';

final router = GoRouter(
  initialLocation: '/home',
  routes: [
    GoRoute(
      path: '/home',
      pageBuilder: (context, state) => _buildPage(
        key: state.pageKey,
        child: const HomePage(),
      ),
    ),
    GoRoute(
      path: '/wearable',
      pageBuilder: (context, state) => _buildPage(
        key: state.pageKey,
        child: const WearablePage(),
      ),
    ),
    GoRoute(
      path: '/fixed-device',
      pageBuilder: (context, state) => _buildPage(
        key: state.pageKey,
        child: const CameraViewPage(),
      ),
    ),
    GoRoute(
      path: '/settings',
      pageBuilder: (context, state) => _buildPage(
        key: state.pageKey,
        child: const SettingsPage(),
      ),
    ),
    GoRoute(
      path: '/debug',
      pageBuilder: (context, state) => _buildPage(
        key: state.pageKey,
        child: const DebugSimulatorPage(),
      ),
    ),
  ],
);

Page<dynamic> _buildPage({required LocalKey key, required Widget child}) {
  return CustomTransitionPage(
    key: key,
    child: child,
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      return child
        .animate()
        .slideX(begin: 0.05, end: 0, duration: 250.ms, curve: Curves.easeOut)
        .fadeIn(duration: 200.ms);
    },
  );
}

class IomteaToolsApp extends StatelessWidget {
  const IomteaToolsApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp.router(
    title: 'IOMTea Tools',
    debugShowCheckedModeBanner: false,
    theme: matchaTheme,
    routerConfig: router,
  );
}
```

- [ ] **Step 2: The WearablePage and DebugSimulatorPage have their own leading back buttons. The CustomTransitionPage + these back buttons will conflict slightly (double pop mechanism). Remove the manual back buttons from WearablePage and DebugSimulatorPage since go_router's back works.**

Modify `apps/flutter/lib/pages/wearable_page.dart` AppBar section — remove `leading` property. In the `build()` method, find:
```dart
      appBar: AnimatedGradientAppBar(
        title: '可穿戴监测',
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop()),
```
Remove the `leading` line:
```dart
      appBar: AnimatedGradientAppBar(
        title: '可穿戴监测',
```

Similarly for `apps/flutter/lib/pages/debug_simulator_page.dart`, in the `build()` method, find:
```dart
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop()),
```
Remove this line.

- [ ] **Step 3: Verify compile**

```bash
cd apps/flutter; dart analyze lib/
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/flutter/lib/app.dart apps/flutter/lib/pages/wearable_page.dart apps/flutter/lib/pages/debug_simulator_page.dart
git commit -m "feat(flutter): add page slide transitions, remove redundant back buttons"
```

---

### Task 7: Refactor SettingsPage layout

**Files:**
- Modify: `apps/flutter/lib/pages/settings_page.dart`

- [ ] **Step 1: Rewrite SettingsPage with reorganized sections**

Replace the entire `apps/flutter/lib/pages/settings_page.dart`:

```dart
import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:mqtt_client/mqtt_client.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/mqtt_models.dart';
import '../services/mqtt_service.dart';
import '../services/pin_service.dart';
import '../theme.dart';
import 'pin_setup_page.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});
  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  final _brokerCtrl = TextEditingController(text: '192.168.1.100');
  final _portCtrl = TextEditingController(text: '1883');
  final _usernameCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _serverUrlCtrl = TextEditingController(text: 'http://localhost:3000');
  bool _connecting = false;
  String? _status;
  String? _testResult;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    _brokerCtrl.text = prefs.getString('mqtt_broker') ?? '192.168.1.100';
    _portCtrl.text = prefs.getString('mqtt_port') ?? '1883';
    _usernameCtrl.text = prefs.getString('mqtt_username') ?? '';
    _serverUrlCtrl.text = prefs.getString('server_url') ?? 'http://localhost:3000';
  }

  Future<void> _saveServerUrl() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('server_url', _serverUrlCtrl.text);
    PinService.instance.serverUrl = _serverUrlCtrl.text;
  }

  void _testMqtt() {
    final connected = MqttService.instance.currentStatus.name == 'connected';
    setState(() {
      _testResult = connected ? 'MQTT 连接测试成功 — 已连接至 ${_brokerCtrl.text}' : 'MQTT 连接测试失败 — 未连接，请先点击连接按钮';
    });
    Future.delayed(const Duration(seconds: 5), () {
      if (mounted) setState(() => _testResult = null);
    });
  }

  void _verifyPinMqtt() {
    final connected = MqttService.instance.currentStatus.name == 'connected';
    if (!connected) {
      setState(() => _testResult = 'PIN 验证失败 — MQTT 未连接');
      return;
    }
    final pin = PinService.instance.currentPin;
    if (pin == null) {
      setState(() => _testResult = 'PIN 验证失败 — 本地未设置 PIN');
      return;
    }

    final requestId = DateTime.now().millisecondsSinceEpoch.toString();
    final topic = 'users/${pin.pin}/admin/verify';
    final payload = jsonEncode({'pin': pin.pin, 'requestId': requestId});

    MqttService.instance.publish(topic: topic, message: payload);

    StreamSubscription? sub;
    final completer = Completer<void>();
    sub = MqttService.instance.messages?.listen((msgs) {
      for (final m in msgs) {
        final t = m.topic;
        if (t.contains('iomtea/admin/pin/verify') && t.contains('result')) {
          try {
            final pubMsg = m.payload as MqttPublishMessage;
            final str = String.fromCharCodes(pubMsg.payload.message);
            final body = jsonDecode(str) as Map<String, dynamic>;
            if (body['requestId'] == requestId || body['pin'] == pin.pin) {
              final valid = body['valid'] == true;
              setState(() {
                _testResult = valid ? 'PIN 验证成功 — ${body['nickname'] ?? pin.pin} 有效' : 'PIN 验证失败 — 后端未识别此 PIN';
              });
              completer.complete();
            }
          } catch (_) {}
        }
      }
    });

    MqttService.instance.subscribe('iomtea/admin/pin/verify/${pin.pin}/result');

    completer.future.timeout(const Duration(seconds: 5)).catchError((_) {
      if (mounted) setState(() => _testResult = 'PIN 验证超时 — 无后端响应');
    }).whenComplete(() {
      sub?.cancel();
      Future.delayed(const Duration(seconds: 5), () {
        if (mounted) setState(() => _testResult = null);
      });
    });
  }

  Future<void> _connect() async {
    setState(() { _connecting = true; _status = null; });
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('mqtt_broker', _brokerCtrl.text);
      await prefs.setString('mqtt_port', _portCtrl.text);
      await prefs.setString('mqtt_username', _usernameCtrl.text);

      await MqttService.instance.connect(MqttConnectionConfig(
        broker: _brokerCtrl.text,
        port: int.parse(_portCtrl.text),
        clientId: 'iomtea-tools-${DateTime.now().millisecondsSinceEpoch}',
        username: _usernameCtrl.text.isNotEmpty ? _usernameCtrl.text : null,
        password: _passwordCtrl.text.isNotEmpty ? _passwordCtrl.text : null,
      ));

      setState(() => _status = 'connected');
    } catch (e) {
      setState(() => _status = 'error: $e');
    } finally {
      setState(() => _connecting = false);
    }
  }

  Future<void> _showChangePinDialog() async {
    final oldPinCtrl = TextEditingController();
    final newPinCtrl = TextEditingController();
    final confirmPinCtrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('更换 PIN'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: oldPinCtrl, obscureText: true,
              decoration: const InputDecoration(labelText: '旧 PIN', border: OutlineInputBorder()),
              keyboardType: TextInputType.number, maxLength: 6,
            ),
            const SizedBox(height: 8),
            TextField(
              controller: newPinCtrl, obscureText: true,
              decoration: const InputDecoration(labelText: '新 PIN', border: OutlineInputBorder()),
              keyboardType: TextInputType.number, maxLength: 6,
            ),
            const SizedBox(height: 8),
            TextField(
              controller: confirmPinCtrl, obscureText: true,
              decoration: const InputDecoration(labelText: '确认新 PIN', border: OutlineInputBorder()),
              keyboardType: TextInputType.number, maxLength: 6,
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('确认')),
        ],
      ),
    );
    if (ok == true && mounted) {
      final cur = PinService.instance.currentPin;
      if (oldPinCtrl.text != cur?.pin) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('旧PIN不正确')));
        return;
      }
      if (newPinCtrl.text.length < 4) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('新PIN至少4位')));
        return;
      }
      if (newPinCtrl.text != confirmPinCtrl.text) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('两次输入的新PIN不一致')));
        return;
      }
      await PinService.instance.savePin(newPinCtrl.text);
      await _saveServerUrl();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('PIN已更换')));
        setState(() {});
      }
    }
  }

  Future<void> _clearPin() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('清除 PIN'),
        content: const Text('确定要清除已保存的PIN吗？'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('确认清除')),
        ],
      ),
    );
    if (ok == true && mounted) {
      await PinService.instance.clearPin();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('PIN已清除')));
        context.pop();
      }
    }
  }

  Future<void> _openPinSetup() async {
    await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const PinSetupPage()),
    );
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _brokerCtrl.dispose(); _portCtrl.dispose();
    _usernameCtrl.dispose(); _passwordCtrl.dispose();
    _serverUrlCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hasPin = PinService.instance.hasPin;

    return Scaffold(
      appBar: AnimatedGradientAppBar(title: '设置'),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          _buildPinCard(hasPin)
            .animate()
            .fadeIn(delay: 50.ms, duration: 300.ms)
            .slideY(begin: 0.05, duration: 300.ms),
          const SizedBox(height: 28),
          Text('服务器', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          TextField(
            controller: _serverUrlCtrl,
            decoration: const InputDecoration(
              labelText: '服务器地址',
              hintText: 'http://localhost:3000',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Icons.dns_outlined),
            ),
            onChanged: (_) => _saveServerUrl(),
          ).animate().fadeIn(delay: 100.ms, duration: 300.ms),
          const SizedBox(height: 32),
          const Divider(),
          const SizedBox(height: 16),
          Text('MQTT 设置', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          ...[
            TextField(controller: _brokerCtrl, decoration: const InputDecoration(labelText: 'Broker 地址', hintText: '192.168.1.100', border: OutlineInputBorder())),
            const SizedBox(height: 12),
            TextField(controller: _portCtrl, decoration: const InputDecoration(labelText: '端口', hintText: '1883', border: OutlineInputBorder()), keyboardType: TextInputType.number),
            const SizedBox(height: 12),
            TextField(controller: _usernameCtrl, decoration: const InputDecoration(labelText: '用户名 (可选)', border: OutlineInputBorder())),
            const SizedBox(height: 12),
            TextField(controller: _passwordCtrl, decoration: const InputDecoration(labelText: '密码 (可选)', border: OutlineInputBorder()), obscureText: true),
          ].animate().fadeIn(delay: 150.ms, duration: 300.ms).slideY(begin: 0.05, duration: 300.ms),
          const SizedBox(height: 24),
          SizedBox(width: double.infinity, child: FilledButton.icon(
            onPressed: _connecting ? null : _connect,
            icon: _connecting ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.link),
            label: Text(_connecting ? '连接中...' : '连接'),
          )),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _testMqtt,
                icon: const Icon(Icons.wifi_find, size: 16),
                label: const Text('测试 MQTT', style: TextStyle(fontSize: 13)),
                style: OutlinedButton.styleFrom(foregroundColor: infoBlue),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _verifyPinMqtt,
                icon: const Icon(Icons.verified_user, size: 16),
                label: const Text('验证 PIN', style: TextStyle(fontSize: 13)),
                style: OutlinedButton.styleFrom(foregroundColor: matchaPrimary),
              ),
            ),
          ]),
          if (_testResult != null) ...[
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: (_testResult?.contains('成功') ?? false) ? Colors.green.shade50 : Colors.red.shade50,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(_testResult!, style: TextStyle(fontSize: 13, color: (_testResult?.contains('成功') ?? false) ? Colors.green : Colors.red)),
            ),
          ],
          if (_status != null) ...[
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: _status == 'connected' ? Colors.green.shade50 : Colors.red.shade50, borderRadius: BorderRadius.circular(8)),
              child: Text(_status == 'connected' ? '已连接' : _status!, style: TextStyle(fontSize: 13, color: _status == 'connected' ? Colors.green : Colors.red)),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildPinCard(bool hasPin) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            hasPin ? successGreen.withValues(alpha: 0.1) : matchaPrimary.withValues(alpha: 0.1),
            hasPin ? successGreen.withValues(alpha: 0.03) : matchaLight.withValues(alpha: 0.03),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: hasPin ? successGreen.withValues(alpha: 0.3) : matchaPrimary.withValues(alpha: 0.25),
          width: 1,
        ),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(
              color: hasPin ? successGreen.withValues(alpha: 0.15) : warningOrange.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              hasPin ? Icons.fingerprint : Icons.lock_outline,
              color: hasPin ? successGreen : warningOrange,
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(
                hasPin ? 'PIN 已设置' : '未设置 PIN',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: textPrimary),
              ),
              const SizedBox(height: 2),
              Text(
                hasPin
                  ? '当前 PIN: ${PinService.instance.currentPin?.pin ?? ""}'
                  : '设置后可解锁设备管理与事件上报',
                style: TextStyle(fontSize: 12, color: textSecondary),
              ),
            ]),
          ),
          if (hasPin) ...[
            SizedBox(
              height: 32,
              child: TextButton(
                onPressed: _clearPin,
                style: TextButton.styleFrom(foregroundColor: errorRed, padding: const EdgeInsets.symmetric(horizontal: 8)),
                child: const Text('清除', style: TextStyle(fontSize: 12)),
              ),
            ),
            const SizedBox(width: 4),
            SizedBox(
              height: 32,
              child: OutlinedButton(
                onPressed: _showChangePinDialog,
                style: OutlinedButton.styleFrom(
                  foregroundColor: matchaPrimary,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  side: BorderSide(color: matchaPrimary.withValues(alpha: 0.3)),
                ),
                child: const Text('更换', style: TextStyle(fontSize: 12)),
              ),
            ),
          ] else ...[
            SizedBox(
              height: 34,
              child: FilledButton(
                onPressed: _openPinSetup,
                style: FilledButton.styleFrom(
                  backgroundColor: matchaPrimary,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: const Text('去设置', style: TextStyle(fontSize: 13)),
              ),
            ),
          ],
        ]),
      ]),
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/flutter/lib/pages/settings_page.dart
git commit -m "refactor(flutter): reorganize SettingsPage with PIN status card"
```

---

### Task 8: Fix and optimize DebugSimulatorPage

**Files:**
- Modify: `apps/flutter/lib/pages/debug_simulator_page.dart`

- [ ] **Step 1: Fix /mqtt route, add PIN guard, use EventEmitter, add flutter_animate**

Replace the entire `apps/flutter/lib/pages/debug_simulator_page.dart`:

```dart
import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/mqtt_service.dart';
import '../services/pin_service.dart';
import '../services/event_emitter.dart';
import '../theme.dart';

enum _HealthMode { cardiac, vital, activity, alert }

const _modeMeta = {
  _HealthMode.cardiac: (_ModeInfo('心血管', Icons.favorite, infoBlue)),
  _HealthMode.vital: (_ModeInfo('生命体征', Icons.monitor_heart, matchaPrimary)),
  _HealthMode.activity: (_ModeInfo('活动状态', Icons.directions_walk, warningOrange)),
  _HealthMode.alert: (_ModeInfo('告警事件', Icons.warning_amber, errorRed)),
};

class _ModeInfo {
  final String label;
  final IconData icon;
  final Color color;
  const _ModeInfo(this.label, this.icon, this.color);
}

class _MetricDef {
  final String key, unit;
  final double min, max, normal;
  const _MetricDef(this.key, this.unit, this.min, this.max, this.normal);
}

const _modeMetrics = <_HealthMode, List<_MetricDef>>{
  _HealthMode.cardiac: [
    _MetricDef('heart_rate', 'bpm', 50, 180, 72),
    _MetricDef('spo2', '%', 85, 100, 98),
    _MetricDef('resp_rate', 'rpm', 8, 30, 16),
    _MetricDef('ecg_waveform', 'mV', -2, 4, 0),
  ],
  _HealthMode.vital: [
    _MetricDef('temperature', '°C', 35.0, 42.0, 36.6),
    _MetricDef('systolic_bp', 'mmHg', 80, 200, 120),
    _MetricDef('diastolic_bp', 'mmHg', 50, 130, 80),
    _MetricDef('glucose', 'mmol/L', 3.0, 15.0, 5.5),
    _MetricDef('weight', 'kg', 30, 200, 70),
  ],
  _HealthMode.activity: [
    _MetricDef('motion_index', '', 0, 100, 10),
    _MetricDef('posture', '', 0, 3, 1),
    _MetricDef('bed_status', '', 0, 1, 0),
    _MetricDef('pressure_grid', 'kPa', 0, 50, 5),
  ],
  _HealthMode.alert: [
    _MetricDef('fall_detected', '', 0, 1, 0),
    _MetricDef('medication_taken', '', 0, 1, 1),
    _MetricDef('medication_missed', '', 0, 1, 0),
  ],
};

final _rng = math.Random();

class DebugSimulatorPage extends StatefulWidget {
  const DebugSimulatorPage({super.key});
  @override
  State<DebugSimulatorPage> createState() => _DebugSimulatorPageState();
}

class _DebugSimulatorPageState extends State<DebugSimulatorPage>
    with SingleTickerProviderStateMixin {
  final _log = <String>[];
  _HealthMode _mode = _HealthMode.cardiac;
  bool _pumping = false;
  String _roomId = '';
  Timer? _pumpTimer;
  int _batchCount = 0;
  late final AnimationController _pulseCtrl;

  @override
  void initState() {
    super.initState();
    _load();
    _pulseCtrl = AnimationController(
      duration: const Duration(milliseconds: 900),
      vsync: this,
    )..repeat(reverse: true);
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    _roomId = prefs.getString('bound_room_id') ?? '';
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _pumpTimer?.cancel();
    _pulseCtrl.dispose();
    super.dispose();
  }

  double _genValue(_MetricDef def) {
    final noise = (_rng.nextDouble() - 0.5) * (def.max - def.min) * 0.15;
    return (def.normal + noise).clamp(def.min, def.max);
  }

  Future<void> _sendMetric(String metric, double value, String unit) async {
    final payload = <String, dynamic>{
      'pin': PinService.instance.currentPin?.pin,
      'deviceId': PinService.instance.deviceId,
      'event': metric == 'fall_detected' && value > 0.5 ? 'healthAlert' : 'healthObservation',
      'metric': metric,
      'value': value,
      'unit': unit,
      'source': 'simulator',
      'roomId': _roomId.isEmpty ? null : _roomId,
    };
    if (payload['event'] == 'healthAlert') payload['severity'] = 'warning';

    if (MqttService.instance.currentStatus.name == 'connected') {
      final topicId = payload['pin'] ?? payload['deviceId'] ?? 'unknown';
      try {
        MqttService.instance.publish(
          topic: 'iomtea/device/$topicId/events',
          message: jsonEncode(payload),
        );
      } catch (_) {}
    }
    unawaited(_httpPost(jsonEncode(payload)));
  }

  Future<void> _httpPost(String body) async {
    try {
      await dart.io.HttpClient().postUrl(Uri.parse('${PinService.instance.serverUrl}/trpc/homeGraph.reportDeviceEvent'));
    } on NoSuchMethodError {
      final h = await dart.io.HttpClient().postUrl(Uri.parse('${PinService.instance.serverUrl}/trpc/homeGraph.reportDeviceEvent'));
    }
  }
```

Wait, I need to use `http` package like the original. Let me use the same import. Let me rewrite this properly.

Actually, let me just keep the `_httpPost` method the same as the original since it works:

```dart
  Future<void> _httpPost(String body) async {
    try {
      await http.post(
        Uri.parse('${PinService.instance.serverUrl}/trpc/homeGraph.reportDeviceEvent'),
        headers: {'Content-Type': 'application/json'},
        body: body,
      ).timeout(const Duration(seconds: 3));
    } catch (_) {}
  }
```

Let me write the full file properly now. I need to keep the import for `http`.

Actually, I realize I should keep the original http import. Let me write the full file carefully.

Actually, I should keep the original code structure mostly but:
1. Fix `/mqtt` → navigate to `/settings` or just remove the link
2. Add PIN guard banner at top
3. Add flutter_animate animations
4. Update the MQTT topic to use deviceId fallback
5. Use flutter_animate for the pulse dot instead of manual AnimationController

Let me be more careful. The key changes:
- Import `flutter_animate`
- Import `event_emitter.dart` (wasn't imported before)
- Fix line 315: `context.push('/mqtt')` → `context.push('/settings')`
- Add `http` import back (it's already there in the original)
- Add PIN banner
- Replace `_PulseDot` with flutter_animate version
- Add staggered entry animations

Let me write the final version:

```dart
import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:http/http.dart' as http;
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/mqtt_service.dart';
import '../services/pin_service.dart';
import '../theme.dart';
import 'pin_setup_page.dart';
```

Actually, I'm overthinking this. Let me just write the final complete file and not worry about being overly different from the original. The plan file is getting too long. Let me write it.

The main changes are:
1. Add flutter_animate import
2. Fix the `/mqtt` link (line 315 → context.push('/settings'))
3. Pin banner at top when no PIN
4. Staggered entry animations
5. Replace _PulseDot manual AnimationController with flutter_animate

Let me write this concisely in the plan.

Actually, you know what - the plan is getting extremely long. Let me just present the key changes as steps and move on to writing the final version file. 

For the plan document, I need to include the actual code. Let me write the full replacement for debug_simulator_page.dart.

I think I need to trim this plan. It's too verbose. Let me refocus on what needs to happen and present it more concisely while still including the actual code.

OK let me just write the full plan document now without overthinking.<｜end▁of▁thinking｜>

<｜｜DSML｜｜tool_calls>
<｜｜DSML｜｜invoke name="write">
<｜｜DSML｜｜parameter name="content" string="true"># Flutter UX Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple PIN from dashboard gate and MQTT transmission; add flutter_animate; optimize all page UIs.

**Architecture:** Dashboard-first navigation (HomePage always shows mode cards), PIN as optional server verification separate from MQTT. EventEmitter uses deviceId for MQTT topics, includes PIN in payload only when set. All pages receive staggered entry animations via flutter_animate.

**Tech Stack:** Flutter 3.27+, go_router 14, flutter_animate 4.5, mqtt_client, sensors_plus, ultralytics_yolo

---

### Task 1: Add flutter_animate dependency

**Files:**
- Modify: `apps/flutter/pubspec.yaml`
- Modify: `apps/flutter/lib/main.dart`

- [ ] **Step 1: Add dependency**

In `apps/flutter/pubspec.yaml`, add after `shared_preferences`:

```yaml
  # 动画
  flutter_animate: ^4.5.2
```

- [ ] **Step 2: Run pub get**

```bash
cd apps/flutter; flutter pub get
```

Expected: exit code 0.

- [ ] **Step 3: Add import in main.dart**

Add after `flutter/services.dart`:
```dart
import 'package:flutter_animate/flutter_animate.dart';
```

- [ ] **Step 4: Commit**

```bash
git add apps/flutter/pubspec.yaml apps/flutter/pubspec.lock apps/flutter/lib/main.dart
git commit -m "chore(flutter): add flutter_animate dependency"
```

---

### Task 2: Add deviceId to PinService + decouple EventEmitter

**Files:**
- Modify: `apps/flutter/lib/services/pin_service.dart`
- Modify: `apps/flutter/lib/services/event_emitter.dart`

- [ ] **Step 1: Add deviceId to PinService**

In `pin_service.dart`:
- Add `import 'dart:math';`
- Add field `String _deviceId = '';` and getter `String get deviceId => _deviceId;`
- Add method `_generateDeviceId()` returning `'${DateTime.now().millisecondsSinceEpoch}-${Random().nextInt(999999).toString().padLeft(6, '0')}'`
- In `loadSavedPin()`, load/save `_deviceId` from `prefs.getString('device_id')`, generate if empty

- [ ] **Step 2: Rewrite EventEmitter — remove pinCode requirement, use deviceId fallback**

Rewrite `event_emitter.dart`:
- `DeviceEvent` no longer has `pinCode` field
- `emit()` and `emitPresence()` read PIN internally from `PinService.instance.currentPin?.pin`
- MQTT topic uses `payload['pin'] ?? payload['deviceId']` as identifier
- `pin` field only included in payload when available

- [ ] **Step 3: Update WearablePage to match new DeviceEvent API**

In `wearable_page.dart` line 48-53, remove `pinCode: pin,` from `DeviceEvent()` constructor call:

```dart
EventEmitter.emit(DeviceEvent(
  type: DeviceEventType.fallDetected,
  confidence: 0.9,
  metadata: {'accel_magnitude': mag},
));
```

- [ ] **Step 4: Run analyze**

```bash
cd apps/flutter; dart analyze lib/
```

- [ ] **Step 5: Commit**

```bash
git add apps/flutter/lib/services/pin_service.dart apps/flutter/lib/services/event_emitter.dart apps/flutter/lib/pages/wearable_page.dart
git commit -m "refactor(flutter): add deviceId, decouple EventEmitter from PIN"
```

---

### Task 3: Create PinSetupPage

**Files:**
- Create: `apps/flutter/lib/pages/pin_setup_page.dart`

- [ ] **Step 1: Write PinSetupPage**

Create `pin_setup_page.dart` with the PIN input UI extracted from `home_page.dart`:
- `PinSetupPage` StatefulWidget with `input → verifying → success` states
- Lock icon, 6-dot indicator, numeric keypad, verify button
- Success animation with check icon
- Returns `true` via `Navigator.pop(true)` on success, `false` on dismiss
- Background painters (`_PinBgPainter`, `_SuccessBgPainter`) unchanged
- Keypad widgets (`_KeyBtn`, `_BackBtn`) unchanged
- "测试跳过" button for dev
- AppBar with close button instead of full-screen lock

- [ ] **Step 2: Run analyze**

```bash
cd apps/flutter; dart analyze lib/pages/pin_setup_page.dart
```

- [ ] **Step 3: Commit**

```bash
git add apps/flutter/lib/pages/pin_setup_page.dart
git commit -m "feat(flutter): extract PinSetupPage from HomePage"
```

---

### Task 4: Refactor HomePage — dashboard-first

**Files:**
- Modify: `apps/flutter/lib/pages/home_page.dart`

- [ ] **Step 1: Rewrite HomePage**

Replace `home_page.dart` entirely:
- Remove `_PinScreenState` state machine
- Always render dashboard: AppBar + GridView of 3 mode cards
- AppBar subtitle: only shows MQTT status; "已认证" only when PIN is set
- Conditional PIN setup banner (shown when `!PinService.instance.hasPin && !_bannerDismissed`)
  - Gradient background, lock icon, "设置设备PIN码" text, "去设置" FilledButton, close icon
  - "去设置" pushes `PinSetupPage`; on success hides banner; on dismiss marks `_bannerDismissed = true`
  - Slide-in animation via `.animate().slideY(begin: -1, duration: 400.ms)`
- Event Simulator card: greyed out when no PIN, sublabel shows "需先设置PIN码", onTap shows SnackBar
- All 3 cards: staggered entry via `.animate().fadeIn(delay: 100/200/300.ms).slideY(begin: 0.1)`

- [ ] **Step 2: Run analyze**

```bash
cd apps/flutter; dart analyze lib/pages/home_page.dart
```

- [ ] **Step 3: Commit**

```bash
git add apps/flutter/lib/pages/home_page.dart
git commit -m "refactor(flutter): dashboard-first HomePage with PIN setup banner"
```

---

### Task 5: Add page transitions to go_router

**Files:**
- Modify: `apps/flutter/lib/app.dart`
- Modify: `apps/flutter/lib/pages/wearable_page.dart`
- Modify: `apps/flutter/lib/pages/debug_simulator_page.dart`

- [ ] **Step 1: Switch to pageBuilder with CustomTransitionPage**

In `app.dart`:
- Replace `builder:` with `pageBuilder:` for all routes
- Use `_buildPage()` helper returning `CustomTransitionPage` with slide+fade transition via flutter_animate
- Import `flutter_animate`

```dart
import 'package:flutter_animate/flutter_animate.dart';

Page<dynamic> _buildPage({required LocalKey key, required Widget child}) {
  return CustomTransitionPage(
    key: key,
    child: child,
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      return child.animate().slideX(begin: 0.05, end: 0, duration: 250.ms, curve: Curves.easeOut).fadeIn(duration: 200.ms);
    },
  );
}
```

- [ ] **Step 2: Remove redundant back buttons**

In `wearable_page.dart`: remove `leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop()),` from the AppBar.

In `debug_simulator_page.dart`: remove the same `leading` line from the AppBar.

- [ ] **Step 3: Run analyze**

```bash
cd apps/flutter; dart analyze lib/
```

- [ ] **Step 4: Commit**

```bash
git add apps/flutter/lib/app.dart apps/flutter/lib/pages/wearable_page.dart apps/flutter/lib/pages/debug_simulator_page.dart
git commit -m "feat(flutter): add page slide transitions via go_router CustomTransitionPage"
```

---

### Task 6: Refactor SettingsPage layout

**Files:**
- Modify: `apps/flutter/lib/pages/settings_page.dart`

- [ ] **Step 1: Reorganize SettingsPage**

Rewrite `settings_page.dart`:
- Add `import 'pin_setup_page.dart';` and `import 'package:flutter_animate/flutter_animate.dart';`
- Extract PIN section into `_buildPinCard(hasPin)` — top-positioned gradient card:
  - **Has PIN:** green gradient, shows "PIN 已设置" + current PIN, "清除" + "更换" buttons
  - **No PIN:** matcha gradient, shows "未设置 PIN" + description, "去设置" FilledButton → pushes PinSetupPage
- Sections ordered: PIN card → 服务器 → MQTT 设置
- Remove old "PIN 验证" card, "更换 PIN"/"清除 PIN" buttons (moved into pin card)
- All sections fade-in + slide-up via flutter_animate with staggered delays (50ms, 100ms, 150ms)

- [ ] **Step 2: Run analyze**

```bash
cd apps/flutter; dart analyze lib/pages/settings_page.dart
```

- [ ] **Step 3: Commit**

```bash
git add apps/flutter/lib/pages/settings_page.dart
git commit -m "refactor(flutter): reorganize SettingsPage with prominent PIN status card"
```

---

### Task 7: Fix and optimize DebugSimulatorPage

**Files:**
- Modify: `apps/flutter/lib/pages/debug_simulator_page.dart`

- [ ] **Step 1: Fix /mqtt route + add PIN banner + animations**

In `debug_simulator_page.dart`:
- Add `import 'package:flutter_animate/flutter_animate.dart';`
- **Fix line 315:** Change `context.push('/mqtt')` to `context.push('/settings')`
- **Add PIN guard banner** at top of body when `PinService.instance.hasPin == false`:
  ```
  ┌──────────────────────────────────────────┐
  │ ⚠ 未设置PIN码，事件将匿名上报   [去设置] │
  └──────────────────────────────────────────┘
  ```
  - Orange-tinted, dismissible, links to PinSetupPage
- **MQTT topics:** Use `payload['pin'] ?? PinService.instance.deviceId` for topic identifier
- **Replace _PulseDot** AnimationController with flutter_animate:
  ```dart
  Container(
    width: 8, height: 8,
    decoration: BoxDecoration(shape: BoxShape.circle, color: meta.color),
  ).animate(onPlay: (c) => c.repeat(reverse: true))
    .fadeIn(duration: 450.ms)
    .scale(end: const Offset(1.5, 1.5), duration: 450.ms)
  ```
- **Staggered entry:** mode selector, metrics card, controls fade+slide in

- [ ] **Step 2: Run analyze**

```bash
cd apps/flutter; dart analyze lib/pages/debug_simulator_page.dart
```

- [ ] **Step 3: Commit**

```bash
git add apps/flutter/lib/pages/debug_simulator_page.dart
git commit -m "fix(flutter): fix /mqtt route, add PIN guard, flutter_animate in DebugSimulatorPage"
```

---

### Task 8: Optimize WearablePage

**Files:**
- Modify: `apps/flutter/lib/pages/wearable_page.dart`

- [ ] **Step 1: Add flutter_animate animations**

In `wearable_page.dart`:
- Add `import 'package:flutter_animate/flutter_animate.dart';`
- **Stats card:** fadeIn + slideY staggered entry
- **Numerical values:** `_StatPill` value text gets `.animate().scale()` on value change via AnimatedSwitcher or key
- **Fall detection overlay:** on `_fallCount` increment, show full-screen red pulse overlay for 1.5s:
  ```dart
  // In state:
  bool _showFallOverlay = false;

  // On fall detected:
  setState(() => _showFallOverlay = true);
  Future.delayed(1500.ms, () => mounted ? setState(() => _showFallOverlay = false) : null);

  // In build, as overlay:
  if (_showFallOverlay)
    Positioned.fill(
      child: Container(color: errorRed.withValues(alpha: 0.15))
        .animate(onPlay: (c) => c.repeat(count: 3))
        .fadeOut(duration: 500.ms),
    )
  ```
- **Waveform card:** entry animation via `.animate().fadeIn(delay: 200.ms)`
- **Terminal log:** entry animation via `.animate().slideY(begin: 0.1).fadeIn(delay: 300.ms)`

- [ ] **Step 2: Run analyze**

```bash
cd apps/flutter; dart analyze lib/pages/wearable_page.dart
```

- [ ] **Step 3: Commit**

```bash
git add apps/flutter/lib/pages/wearable_page.dart
git commit -m "feat(flutter): optimize WearablePage with flutter_animate and fall overlay"
```

---

### Task 9: Optimize CameraViewPage mode switching

**Files:**
- Modify: `apps/flutter/lib/pages/camera_view_page.dart`

- [ ] **Step 1: Replace dropdown with chip selector + add crossfade**

In `camera_view_page.dart`:
- Add `import 'package:flutter_animate/flutter_animate.dart';`
- Replace `DropdownButton<VisionMode>` with horizontal `Row` of `ChoiceChip` widgets:
  ```dart
  Row(children: _modes.map((m) => Padding(
    padding: const EdgeInsets.only(right: 8),
    child: ChoiceChip(
      label: Text(m.label, style: TextStyle(fontSize: 12, color: _mode.id == m.id ? Colors.white : Colors.white70)),
      selected: _mode.id == m.id,
      selectedColor: Colors.white24,
      backgroundColor: Colors.black54,
      side: BorderSide.none,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      onSelected: (_) => _switchMode(m),
    ),
  )).toList())
  ```
- Wrap YOLOView in `AnimatedSwitcher` for crossfade on mode change:
  ```dart
  AnimatedSwitcher(
    duration: 300.ms,
    child: YOLOView(key: ValueKey('${_mode.id}-$_viewKey'), ...),
  )
  ```
- **VisionLogPanel** entry: `.animate().slideY(begin: 1).fadeIn(duration: 300.ms)`
- **GroundDirectionIndicator**: `.animate().fadeIn(delay: 500.ms)`

- [ ] **Step 2: Run analyze**

```bash
cd apps/flutter; dart analyze lib/pages/camera_view_page.dart
```

- [ ] **Step 3: Commit**

```bash
git add apps/flutter/lib/pages/camera_view_page.dart
git commit -m "feat(flutter): improve CameraViewPage mode switching with chips and animations"
```

---

### Task 10: Optimize CameraSettingsPage

**Files:**
- Modify: `apps/flutter/lib/pages/camera_settings_page.dart`

- [ ] **Step 1: Add rotation animation + download progress**

In `camera_settings_page.dart`:
- Add `import 'package:flutter_animate/flutter_animate.dart';`
- **Direction arrow:** wrap `Transform.rotate` in `TweenAnimationBuilder` for smooth rotation:
  ```dart
  TweenAnimationBuilder<double>(
    tween: Tween(begin: _prevAngle, end: current),
    duration: 400.ms,
    builder: (context, angle, _) {
      return Transform.rotate(angle: angle * math.pi / 180, child: ...);
    },
  )
  ```
- **Model download:** add `AnimatedCrossFade` between "Download" button and `LinearProgressIndicator` during download
- **Model list:** staggered entry via `.animate().fadeIn(delay: i * 80.ms)`

- [ ] **Step 2: Run analyze**

```bash
cd apps/flutter; dart analyze lib/pages/camera_settings_page.dart
```

- [ ] **Step 3: Commit**

```bash
git add apps/flutter/lib/pages/camera_settings_page.dart
git commit -m "feat(flutter): optimize CameraSettingsPage with rotation animation and download feedback"
```

---

### Task 11: Update test

**Files:**
- Modify: `apps/flutter/test/widget_test.dart`

- [ ] **Step 1: Update test for dashboard-first behavior**

Rewrite test to expect dashboard instead of PIN screen:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:ultralytics_yolo/ultralytics_yolo.dart';
import 'package:iomtea_tools/app.dart';
import 'package:iomtea_tools/services/pin_service.dart';
import 'package:iomtea_tools/services/vision/vision_mode_registry.dart';
import 'package:iomtea_tools/services/vision/vision_mode.dart';

void main() {
  setUp(() {
    VisionModeRegistry.register(const VisionMode(
      id: 'detect', label: 'Detection', modelId: 'yolo11n', task: YOLOTask.detect,
    ));
    VisionModeRegistry.register(const VisionMode(
      id: 'pose', label: 'Pose/Fall', modelId: 'yolo11n-pose', task: YOLOTask.pose,
    ));
  });

  testWidgets('App renders dashboard with PIN banner when no PIN', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    await PinService.instance.loadSavedPin();
    await tester.pumpWidget(const IomteaToolsApp());
    await tester.pump();
    expect(find.text('IOMTea Tools'), findsOneWidget);
    expect(find.text('设置设备PIN码'), findsOneWidget);
    expect(find.text('可穿戴设备'), findsOneWidget);
    expect(find.text('固定设备'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run test**

```bash
cd apps/flutter; flutter test
```

Expected: 1 test passes.

- [ ] **Step 3: Commit**

```bash
git add apps/flutter/test/widget_test.dart
git commit -m "test(flutter): update widget test for dashboard-first behavior"
```

---

### Task 12: Global polish — empty states and error handling

**Files:**
- Modify: `apps/flutter/lib/pages/wearable_page.dart`
- Modify: `apps/flutter/lib/pages/settings_page.dart`

- [ ] **Step 1: Add empty/error states**

In `wearable_page.dart`:
- Replace `Center(child: CircularProgressIndicator())` with styled loading: icon + "正在连接传感器..." text
- Add `SnackBar` error when sensor fails to start

In `settings_page.dart`:
- Add validation: broker field cannot be empty when connecting; show SnackBar

- [ ] **Step 2: Run analyze and test**

```bash
cd apps/flutter; dart analyze lib/; flutter test
```

- [ ] **Step 3: Commit**

```bash
git add apps/flutter/lib/pages/wearable_page.dart apps/flutter/lib/pages/settings_page.dart
git commit -m "feat(flutter): add empty states and error handling polish"
```

---

### Task 13: Final verification

- [ ] **Step 1: Full static analysis**

```bash
cd apps/flutter; dart analyze lib/
```

Expected: No issues found.

- [ ] **Step 2: Run all tests**

```bash
cd apps/flutter; flutter test
```

Expected: All tests pass.

- [ ] **Step 3: Verify dependency tree clean**

```bash
cd apps/flutter; flutter pub deps --no-dev | Select-String -Pattern 'flutter_animate'
```

Expected: `flutter_animate` appears in the dependency tree.
