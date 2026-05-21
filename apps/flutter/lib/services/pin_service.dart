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
