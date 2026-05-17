import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'app.dart';
import 'services/pin_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await PinService.instance.loadSavedPin();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  runApp(const IomteaToolsApp());
}
