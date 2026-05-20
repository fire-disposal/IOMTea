import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'app.dart';
import 'services/pin_service.dart';
import 'services/vision/vision_mode_registry.dart';
import 'services/vision/modes/pose_mode.dart';
import 'services/vision/modes/detect_mode.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await PinService.instance.loadSavedPin();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);

  VisionModeRegistry.register(PoseMode());
  VisionModeRegistry.register(DetectMode());

  runApp(const IomteaToolsApp());
}
