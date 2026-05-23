import 'dart:convert';
import 'package:sqflite/sqflite.dart';
import 'database.dart';

class SyncQueueItem {
  final int? id;
  final String payload;
  final String? topic;
  final int createdAt;
  final int retries;

  const SyncQueueItem({
    this.id,
    required this.payload,
    this.topic,
    required this.createdAt,
    this.retries = 0,
  });

  Map<String, dynamic> toMap() => {
    if (id != null) 'id': id,
    'payload': payload,
    'topic': topic,
    'created_at': createdAt,
    'retries': retries,
  };

  factory SyncQueueItem.fromMap(Map<String, dynamic> map) => SyncQueueItem(
    id: map['id'] as int?,
    payload: map['payload'] as String,
    topic: map['topic'] as String?,
    createdAt: map['created_at'] as int,
    retries: map['retries'] as int? ?? 0,
  );
}

class SyncQueueRepo {
  final AppDatabase _db;
  SyncQueueRepo(this._db);

  Future<int> enqueue(Map<String, dynamic> data, {String? topic}) async {
    final db = await _db.database;
    return db.insert('sync_queue', SyncQueueItem(
      payload: jsonEncode(data),
      topic: topic,
      createdAt: DateTime.now().millisecondsSinceEpoch,
    ).toMap());
  }

  Future<List<SyncQueueItem>> getPending({int limit = 50}) async {
    final db = await _db.database;
    final rows = await db.query(
      'sync_queue',
      where: 'retries < 5',
      orderBy: 'created_at ASC',
      limit: limit,
    );
    return rows.map(SyncQueueItem.fromMap).toList();
  }

  Future<void> remove(int id) async {
    final db = await _db.database;
    await db.delete('sync_queue', where: 'id = ?', whereArgs: [id]);
  }

  Future<void> incrementRetries(int id) async {
    final db = await _db.database;
    await db.rawUpdate(
      'UPDATE sync_queue SET retries = retries + 1 WHERE id = ?',
      [id],
    );
  }

  Future<int> pendingCount() async {
    final db = await _db.database;
    final result = await db.rawQuery('SELECT COUNT(*) as cnt FROM sync_queue WHERE retries < 5');
    return Sqflite.firstIntValue(result) ?? 0;
  }
}
