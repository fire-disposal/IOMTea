import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'theme.dart';
import 'pages/home_page.dart';
import 'pages/mode_select_page.dart';
import 'pages/wearable_page.dart';
import 'pages/room_binding_page.dart';
import 'pages/fixed_device_page.dart';
import 'pages/debug_simulator_page.dart';
import 'pages/settings_page.dart';
import 'pages/mqtt_console_page.dart';
import 'pages/vision_page.dart';
import 'pages/imu_page.dart';

final router = GoRouter(
  initialLocation: '/home',
  routes: [
    GoRoute(path: '/home', builder: (_, __) => const HomePage()),
    GoRoute(path: '/mode-select', builder: (_, __) => const ModeSelectPage()),
    GoRoute(path: '/wearable', builder: (_, __) => const WearablePage()),
    GoRoute(path: '/room-bind', builder: (_, __) => const RoomBindingPage()),
    GoRoute(path: '/fixed-device', builder: (_, state) {
      final fromRoomBind = state.extra == 'fromRoomBind';
      return FixedDevicePage(fromRoomBind: fromRoomBind);
    }),
    GoRoute(path: '/settings', builder: (_, __) => const SettingsPage()),
    GoRoute(path: '/mqtt', builder: (_, __) => const MqttConsolePage()),
    GoRoute(path: '/vision', builder: (_, __) => const VisionPage()),
    GoRoute(path: '/imu', builder: (_, __) => const ImuPage()),
    GoRoute(path: '/debug', builder: (_, __) => const DebugSimulatorPage()),
  ],
);

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
