import 'dart:convert';
import 'package:sqflite/sqflite.dart';
import 'database.dart';

class HealthEvent {
  final int? id;
  final int timestamp;
  final String type;
  final String? subtype;
  final double? confidence;
  final double? accelX;
  final double? accelY;
  final double? accelZ;
  final double? accelMag;
  final double? gyroX;
  final double? gyroY;
  final double? gyroZ;
  final Map<String, dynamic>? metadata;
  final int synced;

  const HealthEvent({
    this.id,
    required this.timestamp,
    required this.type,
    this.subtype,
    this.confidence,
    this.accelX,
    this.accelY,
    this.accelZ,
    this.accelMag,
    this.gyroX,
    this.gyroY,
    this.gyroZ,
    this.metadata,
    this.synced = 0,
  });

  Map<String, dynamic> toMap() => {
    if (id != null) 'id': id,
    'timestamp': timestamp,
    'type': type,
    'subtype': subtype,
    'confidence': confidence,
    'accel_x': accelX,
    'accel_y': accelY,
    'accel_z': accelZ,
    'accel_mag': accelMag,
    'gyro_x': gyroX,
    'gyro_y': gyroY,
    'gyro_z': gyroZ,
    'metadata': metadata != null ? jsonEncode(metadata) : null,
    'synced': synced,
  };

  factory HealthEvent.fromMap(Map<String, dynamic> map) => HealthEvent(
    id: map['id'] as int?,
    timestamp: map['timestamp'] as int,
    type: map['type'] as String,
    subtype: map['subtype'] as String?,
    confidence: (map['confidence'] as num?)?.toDouble(),
    accelX: (map['accel_x'] as num?)?.toDouble(),
    accelY: (map['accel_y'] as num?)?.toDouble(),
    accelZ: (map['accel_z'] as num?)?.toDouble(),
    accelMag: (map['accel_mag'] as num?)?.toDouble(),
    gyroX: (map['gyro_x'] as num?)?.toDouble(),
    gyroY: (map['gyro_y'] as num?)?.toDouble(),
    gyroZ: (map['gyro_z'] as num?)?.toDouble(),
    metadata: map['metadata'] != null ? jsonDecode(map['metadata'] as String) as Map<String, dynamic>? : null,
    synced: map['synced'] as int? ?? 0,
  );
}

class HealthEventRepo {
  final AppDatabase _db;
  HealthEventRepo(this._db);

  Future<int> insert(HealthEvent event) async {
    final db = await _db.database;
    return db.insert('health_events', event.toMap());
  }

  Future<List<HealthEvent>> getUnsynced({int limit = 50}) async {
    final db = await _db.database;
    final rows = await db.query(
      'health_events',
      where: 'synced = 0',
      orderBy: 'timestamp ASC',
      limit: limit,
    );
    return rows.map(HealthEvent.fromMap).toList();
  }

  Future<int> markSynced(int id) async {
    final db = await _db.database;
    return db.update('health_events', {'synced': 1}, where: 'id = ?', whereArgs: [id]);
  }

  Future<List<HealthEvent>> getRecent({int limit = 100, String? type}) async {
    final db = await _db.database;
    final where = type != null ? 'type = ?' : null;
    final whereArgs = type != null ? [type] : null;
    final rows = await db.query(
      'health_events',
      where: where,
      whereArgs: whereArgs,
      orderBy: 'timestamp DESC',
      limit: limit,
    );
    return rows.map(HealthEvent.fromMap).toList();
  }

  Future<int> count({String? type}) async {
    final db = await _db.database;
    final where = type != null ? 'type = ?' : null;
    final whereArgs = type != null ? [type] : null;
    final result = await db.rawQuery(
      'SELECT COUNT(*) as cnt FROM health_events${where != null ? ' WHERE $where' : ''}',
      whereArgs,
    );
    return Sqflite.firstIntValue(result) ?? 0;
  }

  Future<void> deleteAll() async {
    final db = await _db.database;
    await db.delete('health_events');
  }
}
