import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'pages/home_page.dart';
import 'pages/settings_page.dart';
import 'pages/mqtt_console_page.dart';
import 'pages/vision_page.dart';
import 'pages/imu_page.dart';

final router = GoRouter(
  initialLocation: '/home',
  routes: [
    GoRoute(path: '/home', builder: (_, __) => const HomePage()),
    GoRoute(path: '/settings', builder: (_, __) => const SettingsPage()),
    GoRoute(path: '/mqtt', builder: (_, __) => const MqttConsolePage()),
    GoRoute(path: '/vision', builder: (_, __) => const VisionPage()),
    GoRoute(path: '/imu', builder: (_, __) => const ImuPage()),
  ],
);

class IomteaToolsApp extends StatelessWidget {
  const IomteaToolsApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp.router(
    title: 'IOMTea Tools',
    debugShowCheckedModeBanner: false,
    theme: ThemeData(
      useMaterial3: true,
      colorSchemeSeed: const Color(0xFF1565C0),
      brightness: Brightness.light,
      appBarTheme: const AppBarTheme(centerTitle: false, elevation: 0, scrolledUnderElevation: 1),
    ),
    routerConfig: router,
  );
}
