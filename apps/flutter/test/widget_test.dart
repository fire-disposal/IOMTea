import 'package:flutter_test/flutter_test.dart';
import 'package:iomtea_tools/app.dart';

void main() {
  testWidgets('App renders without error', (WidgetTester tester) async {
    await tester.pumpWidget(const IomteaToolsApp());
    expect(find.text('IOMTea Tools'), findsOneWidget);
  });
}
