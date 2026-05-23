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

const double kPagePadding = 20;
const double kCardMarginH = 16;
const double kCardMarginV = 6;
const double kCardRadius = 14;
const double kChipRadius = 8;
const double kBtnRadius = 10;
const double kItemGap = 12;
const double kSectionGap = 24;

class AppText {
  static const TextStyle _base = TextStyle(fontFamily: 'system', letterSpacing: -0.2);
  static TextStyle headlineLarge({Color? color}) => _base.copyWith(fontSize: 20, fontWeight: FontWeight.w700, color: color ?? textPrimary, height: 1.2);
  static TextStyle headlineMedium({Color? color}) => _base.copyWith(fontSize: 16, fontWeight: FontWeight.w600, color: color ?? textPrimary);
  static TextStyle body({Color? color}) => _base.copyWith(fontSize: 13, fontWeight: FontWeight.w400, color: color ?? textPrimary);
  static TextStyle caption({Color? color}) => _base.copyWith(fontSize: 11, fontWeight: FontWeight.w400, color: color ?? textSecondary);
  static TextStyle label({Color? color}) => _base.copyWith(fontSize: 12, fontWeight: FontWeight.w500, color: color ?? textPrimary);
  static TextStyle mono({Color? color, double? fontSize}) => _base.copyWith(fontSize: fontSize ?? 12, fontWeight: FontWeight.w600, fontFamily: 'monospace', color: color ?? textPrimary);
}

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
  final String? header;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;

  const AppSectionCard({
    super.key,
    required this.child,
    this.header,
    this.padding,
    this.margin,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      color: Colors.white,
      elevation: 0.5,
      shadowColor: Colors.black12,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(kCardRadius)),
      margin: margin ?? const EdgeInsets.symmetric(horizontal: kCardMarginH, vertical: kCardMarginV),
      child: Padding(
        padding: padding ?? EdgeInsets.only(
          left: 16, right: 16,
          top: header != null ? 14 : 16,
          bottom: 16,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (header != null) ...[
              Text(header!, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: textSecondary, letterSpacing: 0.5)),
              const SizedBox(height: 10),
            ],
            child,
          ],
        ),
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
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(kBtnRadius)),
    ),
  ),
  filledButtonTheme: FilledButtonThemeData(
    style: FilledButton.styleFrom(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(kBtnRadius)),
    ),
  ),
  outlinedButtonTheme: OutlinedButtonThemeData(
    style: OutlinedButton.styleFrom(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(kBtnRadius)),
    ),
  ),
  cardTheme: CardThemeData(
    color: Colors.white,
    elevation: 0.5,
    shadowColor: Colors.black12,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(kCardRadius)),
    margin: const EdgeInsets.symmetric(horizontal: kCardMarginH, vertical: kCardMarginV),
  ),
);
