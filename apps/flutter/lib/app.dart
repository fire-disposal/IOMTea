import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'theme.dart';
import 'pages/home_page.dart';
import 'pages/settings_page.dart';
import 'pages/mqtt_console_page.dart';
import 'pages/vision_page.dart';
import 'pages/imu_page.dart';
import 'pages/binding_page.dart';
import 'pages/collection_panel.dart';

final router = GoRouter(
  initialLocation: '/',
  redirect: (context, state) async {
    final prefs = await SharedPreferences.getInstance();
    final bound = prefs.getBool('bound') ?? false;
    if (state.matchedLocation == '/') {
      return bound ? '/panel' : '/bind';
    }
    return null;
  },
  routes: [
    GoRoute(path: '/', builder: (_, __) => const SizedBox.shrink()), // Redirect only
    GoRoute(path: '/bind', builder: (_, __) => const BindingPage()),
    GoRoute(path: '/panel', builder: (_, __) => const CollectionPanel()),
    GoRoute(path: '/home', builder: (_, __) => const HomePage()), // Legacy, keep
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
    theme: matchaTheme,
    routerConfig: router,
  );
}
