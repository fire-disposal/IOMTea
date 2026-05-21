import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:ultralytics_yolo/ultralytics_yolo.dart';
import 'app.dart';
import 'services/pin_service.dart';
import 'services/vision/vision_mode_registry.dart';
import 'services/vision/vision_mode.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await PinService.instance.loadSavedPin();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);

  VisionModeRegistry.register(const VisionMode(
    id: 'detect', label: 'Detection', modelId: 'yolo11n', task: YOLOTask.detect,
  ));
  VisionModeRegistry.register(const VisionMode(
    id: 'pose', label: 'Pose/Fall', modelId: 'yolo11n-pose', task: YOLOTask.pose,
  ));

  runApp(const IomteaToolsApp());
}
