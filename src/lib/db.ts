import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "health.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("busy_timeout = 5000");
    initTables(_db);
  }
  return _db;
}

function initTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_log (
      day TEXT PRIMARY KEY,
      active_calories INTEGER,
      total_calories INTEGER,
      steps INTEGER,
      sleep_hours REAL,
      sleep_score INTEGER,
      readiness_score INTEGER,
      food_calories INTEGER,
      protein_g REAL,
      carbs_g REAL,
      fat_g REAL,
      workout_completed INTEGER DEFAULT 0,
      workout_calories INTEGER,
      workout_duration_min INTEGER,
      workout_name TEXT,
      oura_workout_calories INTEGER,
      weight_lbs REAL,
      water_oz REAL,
      oura_synced_at TEXT,
      chrono_synced_at TEXT,
      ladder_synced_at TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS oura_auth (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      access_token TEXT,
      refresh_token TEXT,
      expires_at INTEGER,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS weight_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day TEXT NOT NULL,
      weight_lbs REAL NOT NULL,
      logged_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blood_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      marker TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT NOT NULL,
      reference_low REAL,
      reference_high REAL,
      status TEXT,
      test_date TEXT NOT NULL,
      uploaded_at TEXT DEFAULT (datetime('now')),
      UNIQUE(marker, test_date)
    );
  `);
}
