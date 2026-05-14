import 'package:flutter/material.dart';

const Color matchaPrimary = Color(0xFF6BA539);
const Color matchaDark = Color(0xFF416323);
const Color matchaLight = Color(0xFFAAD184);
const Color creamBg = Color(0xFFFAFAF5);
const Color textPrimary = Color(0xFF3C3C3C);
const Color textSecondary = Color(0xFF8C8C7E);
const Color errorRed = Color(0xFFD32F2F);
const Color warningOrange = Color(0xFFED6C02);
const Color successGreen = Color(0xFF4A8C3F);
const Color infoBlue = Color(0xFF2E7D9F);

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
  ),
  elevatedButtonTheme: ElevatedButtonThemeData(
    style: ElevatedButton.styleFrom(
      backgroundColor: matchaPrimary,
      foregroundColor: Colors.white,
    ),
  ),
  cardTheme: const CardThemeData(
    color: Colors.white,
    elevation: 1,
    margin: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
  ),
);
