import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../theme.dart';

class BindingPage extends StatefulWidget {
  const BindingPage({super.key});

  @override
  State<BindingPage> createState() => _BindingPageState();
}

class _BindingPageState extends State<BindingPage> {
  final _pinController = TextEditingController();
  bool _loading = false;
  String? _error;

  Future<void> _bindWithPin() async {
    final pin = _pinController.text.trim();
    if (pin.length != 6) {
      setState(() => _error = '请输入6位PIN码');
      return;
    }
    setState(() { _loading = true; _error = null; });

    // TODO: Call tRPC or REST endpoint to verify PIN and get patient info
    await Future.delayed(const Duration(seconds: 1));

    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('bound', true);
    await prefs.setString('patientId', pin);
    await prefs.setString('patientName', '已绑定患者');

    if (mounted) {
      Navigator.of(context).pushReplacementNamed('/panel');
    }
  }

  Future<void> _scanQR() async {
    // TODO: Integrate QR scanner package (qr_code_scanner or mobile_scanner)
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('QR扫描功能即将上线')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: creamBg,
      appBar: AppBar(title: const Text('设备绑定')),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.bluetooth_connected, size: 64, color: matchaPrimary),
              const SizedBox(height: 16),
              const Text(
                '绑定患者设备',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.w600, color: textPrimary),
              ),
              const SizedBox(height: 8),
              const Text(
                '输入患者PIN码或扫描二维码完成绑定',
                style: TextStyle(color: textSecondary),
              ),
              const SizedBox(height: 32),

              // PIN Input
              TextField(
                controller: _pinController,
                keyboardType: TextInputType.number,
                maxLength: 6,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 32, letterSpacing: 12, fontWeight: FontWeight.bold),
                decoration: InputDecoration(
                  hintText: '000000',
                  counterText: '',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: matchaLight),
                  ),
                  filled: true,
                  fillColor: Colors.white,
                ),
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(_error!, style: const TextStyle(color: errorRed)),
                ),
              const SizedBox(height: 24),

              // Bind Button
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: _loading ? null : _bindWithPin,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: matchaPrimary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _loading
                    ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('绑定', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
                ),
              ),
              const SizedBox(height: 16),
              const Text('— 或 —', style: TextStyle(color: textSecondary)),
              const SizedBox(height: 16),

              // QR Button
              SizedBox(
                width: double.infinity,
                height: 52,
                child: OutlinedButton.icon(
                  onPressed: _scanQR,
                  icon: const Icon(Icons.qr_code_scanner),
                  label: const Text('扫描二维码'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: matchaPrimary,
                    side: const BorderSide(color: matchaPrimary),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),

              const SizedBox(height: 32),
              // Offline mode: skip binding
              TextButton(
                onPressed: () => Navigator.of(context).pushNamed('/panel'),
                child: const Text('跳过绑定（离线模式）', style: TextStyle(color: textSecondary)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _pinController.dispose();
    super.dispose();
  }
}
