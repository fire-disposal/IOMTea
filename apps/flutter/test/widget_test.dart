import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:iomtea_tools/app.dart';
import 'package:iomtea_tools/services/pin_service.dart';
import 'package:iomtea_tools/services/vision/vision_mode_registry.dart';
import 'package:iomtea_tools/services/vision/modes/detect_mode.dart';
import 'package:iomtea_tools/services/vision/modes/pose_mode.dart';

void main() {
  setUp(() {
    VisionModeRegistry.register(DetectMode());
    VisionModeRegistry.register(PoseMode());
  });

  testWidgets('App renders dashboard with PIN banner when no PIN set', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    await PinService.instance.loadSavedPin();
    await tester.pumpWidget(const IomteaToolsApp());
    await tester.pumpAndSettle();
    expect(find.text('IOMTea Tools'), findsOneWidget);
    expect(find.text('设置设备PIN码'), findsOneWidget);
    expect(find.text('可穿戴设备'), findsOneWidget);
    expect(find.text('固定设备'), findsOneWidget);
  });
}
