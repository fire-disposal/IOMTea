import 'dart:math' as math;
import 'package:flutter/material.dart';

const Color matchaPrimary = Color(0xFF43A047);
const Color matchaDark = Color(0xFF2E7D32);
const Color matchaLight = Color(0xFF81C784);
const Color creamBg = Color(0xFFFAFAF5);
const Color textPrimary = Color(0xFF3C3C3C);
const Color textSecondary = Color(0xFF8C8C7E);
const Color errorRed = Color(0xFFD32F2F);
const Color warningOrange = Color(0xFFED6C02);
const Color successGreen = Color(0xFF4A8C3F);
const Color infoBlue = Color(0xFF1976D2);

class AnimatedGradientAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final List<Widget>? actions;
  final Widget? leading;
  final Widget? subtitle;

  const AnimatedGradientAppBar({
    super.key,
    required this.title,
    this.actions,
    this.leading,
    this.subtitle,
  });

  @override
  Size get preferredSize => Size.fromHeight(subtitle != null ? 64 : 56);

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 2 * math.pi),
      duration: const Duration(seconds: 6),
      builder: (context, v, _) {
        final s = 0.40 + math.sin(v) * 0.06;
        final l = 0.28 + math.sin(v * 1.3) * 0.05;
        return AppBar(
          title: subtitle != null
            ? Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title),
                  subtitle!,
                ],
              )
            : Text(title),
          leading: leading,
          actions: actions,
          flexibleSpace: Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  HSLColor.fromAHSL(1, 115, s, l).toColor(),
                  HSLColor.fromAHSL(1, 125, s + 0.03, l - 0.04).toColor(),
                ],
              ),
            ),
          ),
          foregroundColor: Colors.white,
          elevation: 0,
          scrolledUnderElevation: 1,
          shadowColor: Colors.black26,
          surfaceTintColor: Colors.transparent,
        );
      },
    );
  }
}

class AppSectionCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;

  const AppSectionCard({
    super.key,
    required this.child,
    this.padding,
    this.margin,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      color: Colors.white,
      elevation: 0.5,
      shadowColor: Colors.black12,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      margin: margin ?? const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Padding(
        padding: padding ?? const EdgeInsets.all(16),
        child: child,
      ),
    );
  }
}

final ThemeData matchaTheme = ThemeData(
  useMaterial3: true,
  colorSchemeSeed: matchaPrimary,
  brightness: Brightness.light,
  scaffoldBackgroundColor: creamBg,
  appBarTheme: const AppBarTheme(
    backgroundColor: matchaDark,
    foregroundColor: Colors.white,
    centerTitle: false,
    elevation: 0,
    scrolledUnderElevation: 1,
    surfaceTintColor: Colors.transparent,
  ),
  elevatedButtonTheme: ElevatedButtonThemeData(
    style: ElevatedButton.styleFrom(
      backgroundColor: matchaPrimary,
      foregroundColor: Colors.white,
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
  ),
  filledButtonTheme: FilledButtonThemeData(
    style: FilledButton.styleFrom(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
  ),
  outlinedButtonTheme: OutlinedButtonThemeData(
    style: OutlinedButton.styleFrom(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
  ),
  cardTheme: CardThemeData(
    color: Colors.white,
    elevation: 0.5,
    shadowColor: Colors.black12,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
  ),
);
