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
