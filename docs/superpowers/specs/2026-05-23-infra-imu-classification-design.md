# 2026-05-23 Infrastructure & IMU Classification Design

## Scope
1. SQLite local persistence layer
2. Background service for IMU + health monitoring
3. Notification system for fall alerts / health summaries
4. IMU activity classifier (walking/running/stationary)
5. IMU posture classifier (standing/sitting/lying)
6. Enhanced fall detection (merge existing + tilt-based)
7. Step counter

## Architecture
```
lib/services/
├── database/
│   ├── database.dart             # SQLite bootstrap + migrations
│   ├── health_event_repo.dart    # CRUD for health events
│   └── sync_queue_repo.dart      # Offline sync queue
├── imu/
│   ├── imu_activity_classifier.dart  # Windowed feature extraction + decision tree
│   ├── imu_posture_classifier.dart   # Tilt-angle based
│   ├── imu_step_counter.dart         # Peak detection on accel magnitude
│   └── fall_detector.dart            # Enhanced (SVM + orientation + impact)
├── background_service.dart       # flutter_background_service entry
└── notification_service.dart     # flutter_local_notifications channels
```

## Design
- All classifiers operate on `ImuData` stream, output typed events
- SQLite schema: health_events, imu_samples, sync_queue
- Background service: IMU continuous + classify + persist + notify
- Notification channels: fall_alert (high), health_summary (low)
