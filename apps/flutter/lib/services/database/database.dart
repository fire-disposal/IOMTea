import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

class AppDatabase {
  static AppDatabase? _instance;
  static Database? _db;

  static AppDatabase get instance => _instance ??= AppDatabase._();

  AppDatabase._();

  Future<Database> get database async {
    if (_db != null) return _db!;
    _db = await _init();
    return _db!;
  }

  Future<Database> _init() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, 'iomtea.db');

    return openDatabase(
      path,
      version: 1,
      onCreate: _onCreate,
    );
  }

  Future<void> _onCreate(Database db, int version) async {
    await db.execute('''
      CREATE TABLE health_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        type TEXT NOT NULL,
        subtype TEXT,
        confidence REAL,
        accel_x REAL, accel_y REAL, accel_z REAL,
        accel_mag REAL,
        gyro_x REAL, gyro_y REAL, gyro_z REAL,
        metadata TEXT,
        synced INTEGER NOT NULL DEFAULT 0
      )
    ''');

    await db.execute('''
      CREATE TABLE imu_samples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        accel_x REAL, accel_y REAL, accel_z REAL,
        accel_mag REAL,
        gyro_x REAL, gyro_y REAL, gyro_z REAL
      )
    ''');

    await db.execute('''
      CREATE TABLE sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payload TEXT NOT NULL,
        topic TEXT,
        created_at INTEGER NOT NULL,
        retries INTEGER NOT NULL DEFAULT 0
      )
    ''');
  }

  Future<void> close() async {
    await _db?.close();
    _db = null;
  }
}
