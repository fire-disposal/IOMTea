import 'dart:typed_data';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class NotificationService {
  static final NotificationService instance = NotificationService._();
  NotificationService._();

  final _plugin = FlutterLocalNotificationsPlugin();
  bool _initialized = false;

  static const fallChannelId = 'fall_alert';
  static const summaryChannelId = 'health_summary';
  static const statusChannelId = 'service_status';

  Future<void> init() async {
    if (_initialized) return;

    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );
    const settings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _plugin.initialize(settings: settings);
    _initialized = true;
  }

  Future<void> showFallAlert({String? name}) async {
    await _plugin.show(
      id: 1,
      title: '\u26A0 跌倒检测',
      body: name != null ? '$name 可能发生跌倒' : '检测到可能的跌倒事件',
      notificationDetails: NotificationDetails(
        android: AndroidNotificationDetails(
          fallChannelId,
          '跌倒告警',
          channelDescription: '跌倒检测紧急通知',
          importance: Importance.max,
          priority: Priority.max,
          enableVibration: true,
          vibrationPattern: Int64List.fromList([0, 300, 100, 300, 100, 300]),
          playSound: true,
        ),
      ),
    );
  }

  Future<void> showSummary({
    required int fallCount,
    required int stepCount,
    required String activity,
    required String posture,
  }) async {
    await _plugin.show(
      id: 2,
      title: 'IOMTea 健康摘要',
      body: '步数 $stepCount | $activity | $posture | 跌倒 $fallCount',
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          summaryChannelId,
          '健康摘要',
          channelDescription: '定期健康状态摘要',
          importance: Importance.low,
          priority: Priority.low,
          ongoing: false,
          autoCancel: true,
        ),
      ),
    );
  }

  Future<void> showServiceStatus() async {
    await _plugin.show(
      id: 0,
      title: 'IOMTea',
      body: '后台守护运行中',
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          statusChannelId,
          '服务状态',
          channelDescription: '后台服务运行状态',
          importance: Importance.low,
          priority: Priority.low,
          ongoing: true,
          autoCancel: false,
          showWhen: false,
        ),
      ),
    );
  }

  Future<void> cancelAll() async {
    await _plugin.cancelAll();
  }
}
