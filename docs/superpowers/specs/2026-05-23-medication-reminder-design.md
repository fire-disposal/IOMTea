# Medication Reminder — 用药提醒功能设计

> 2026-05-23

---

## 数据模型

```dart
class Medication {
  int? id;
  String name;           // 药品名
  String dosage;         // 剂量 "1片 / 5ml"
  String unit;           // 单位 "片/粒/包/ml"
  int timesPerDay;       // 每日次数 1-6
  List<MedicationTime> schedule; // 具体时间点
  List<int> weekdays;    // 生效星期 (1-7, 空=每天)
  String? note;          // 备注 "饭后服用"
  bool enabled;          // 是否启用
  DateTime createdAt;
}

class MedicationTime {
  int hour;              // 8-22
  int minute;            // 0/15/30/45
  bool taken;            // 今日是否已服
}
```

## SQLite 表

```sql
CREATE TABLE medications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT '片',
  schedule TEXT NOT NULL,     -- JSON: [{"hour":8,"minute":0},...]
  weekdays TEXT,              -- JSON: [1,2,3,4,5,6,7]
  note TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE medication_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medication_id INTEGER NOT NULL,
  taken_at INTEGER NOT NULL,  -- Unix ms
  skipped INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (medication_id) REFERENCES medications(id)
);
```

## 提醒触发

1. BackgroundHealthService 每 60s 扫描 medications 表
2. 当前时间匹配 schedule 中的某个时间点 → 触发 `NotificationService`（medication channel）
3. 记录到 medication_logs（taken=false，等待用户确认）
4. 用户点击通知或进入用药页面确认"已服"

## UI 设计

`MedicationPage`:
- 列表展示所有用药计划（卡片式）
- 每条显示：药品名、剂量、今日剩余未服时间点
- FAB "+" 添加新药
- 点击条目进入 `MedicationEditPage`

`MedicationEditPage`:
- 药品名 TextField
- 剂量 + 单位 选择器
- 每日次数 → 动态生成时间选择器
- 生效星期 Chip 多选（Mon-Sun）
- 备注 TextField（可选）
- 开关启用/暂停
- 保存按钮
