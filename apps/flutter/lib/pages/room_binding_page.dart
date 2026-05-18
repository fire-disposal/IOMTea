import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../services/pin_service.dart';
import '../theme.dart';

class RoomBindingPage extends StatefulWidget {
  const RoomBindingPage({super.key});
  @override
  State<RoomBindingPage> createState() => _RoomBindingPageState();
}

class _RoomBindingPageState extends State<RoomBindingPage> {
  List<Map<String, dynamic>> _rooms = [];
  String? _selectedRoomId;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final pin = PinService.instance.currentPin;
    if (pin == null) { setState(() => _loading = false); return; }

    try {
      final url = '${PinService.instance.serverUrl}/trpc/homeMap.roomsByPin?input=${Uri.encodeComponent(jsonEncode({"pin": pin.pin}))}';
      final res = await http.get(Uri.parse(url)).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final rooms = (data['result']?['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        setState(() { _rooms = rooms; _loading = false; });
      } else {
        setState(() => _loading = false);
      }
    } catch (_) {
      final prefs = await SharedPreferences.getInstance();
      setState(() { _selectedRoomId = prefs.getString('bound_room_id'); _loading = false; });
    }
  }

  Future<void> _confirm() async {
    if (_selectedRoomId == null) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('bound_room_id', _selectedRoomId!);
    final room = _rooms.firstWhere((r) => r['id'] == _selectedRoomId);
    await prefs.setString('bound_room_name', (room['name'] ?? room['id']) as String);
    if (mounted) context.push('/fixed-device');
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: creamBg,
    appBar: AppBar(title: const Text('绑定安装位置')),
    body: _loading
      ? const Center(child: CircularProgressIndicator())
      : _rooms.isEmpty
        ? Center(child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.cloud_off, size: 48, color: textSecondary),
              const SizedBox(height: 12),
              Text('暂无可选房间', style: TextStyle(fontSize: 16, color: textPrimary)),
              Text('请先在 Web 端创建居家地图', style: TextStyle(fontSize: 13, color: textSecondary)),
              const SizedBox(height: 24),
              if (_selectedRoomId != null)
                FilledButton(onPressed: _confirm, child: const Text('使用已绑定的房间')),
            ]),
          ))
        : Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('选择此设备所在房间', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: textPrimary)),
              const SizedBox(height: 16),
              Expanded(
                child: ListView.builder(
                  itemCount: _rooms.length,
                  itemBuilder: (ctx, i) {
                    final room = _rooms[i];
                    final isSelected = _selectedRoomId == room['id'];
                    return Card(
                      color: isSelected ? matchaPrimary.withValues(alpha: 0.06) : Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: BorderSide(color: isSelected ? matchaPrimary : Colors.transparent, width: 1.5),
                      ),
                      child: ListTile(
                        leading: Icon(Icons.meeting_room, color: isSelected ? matchaPrimary : textSecondary),
                        title: Text(room['name'] ?? room['id'] ?? '', style: TextStyle(fontWeight: FontWeight.w500)),
                        onTap: () => setState(() => _selectedRoomId = room['id'] as String),
                      ),
                    );
                  },
                ),
              ),
              SizedBox(width: double.infinity, child: FilledButton(
                onPressed: _selectedRoomId != null ? _confirm : null,
                child: const Text('确认绑定'),
              )),
            ]),
          ),
  );
}