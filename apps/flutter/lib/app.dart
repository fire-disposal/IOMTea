import 'package:flutter/material.dart';
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
    GoRoute(path: '/home', builder: (_, __) => const HomePage()),
    GoRoute(path: '/wearable', builder: (_, __) => const WearablePage()),
    GoRoute(path: '/fixed-device', builder: (_, __) => const CameraViewPage()),
    GoRoute(path: '/settings', builder: (_, __) => const SettingsPage()),
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
