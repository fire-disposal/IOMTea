import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:iomtea_tools/app.dart';
import 'package:iomtea_tools/services/pin_service.dart';
import 'package:iomtea_tools/services/vision/vision_mode_registry.dart';
import 'package:iomtea_tools/services/vision/modes/pose_mode.dart';
import 'package:iomtea_tools/services/vision/modes/detect_mode.dart';

void main() {
  setUp(() {
    VisionModeRegistry.register(PoseMode());
    VisionModeRegistry.register(DetectMode());
  });

  testWidgets('App renders PIN screen by default', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    await PinService.instance.loadSavedPin();
    await tester.pumpWidget(const IomteaToolsApp());
    await tester.pump();
    expect(find.text('设备验证'), findsOneWidget);
  });
}
