// ============================================================
// DB Client — singleton better-sqlite3 + drizzle
// Auto-migrates on first run (zero-config local dev)
// ============================================================
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import fs from 'node:fs';
import * as schema from './schema';

let _db: ReturnType<typeof drizzle> | null = null;
let _sqlite: Database.Database | null = null;

// Railway: mount a volume at /data for persistent SQLite storage
// Local dev: use ./dev.db in project root
const DB_PATH = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.resolve(process.cwd(), 'dev.db');
const MIGRATIONS_DIR = path.resolve(process.cwd(), 'lib', 'db', 'migrations');

export function getDB() {
  if (_db) return _db;

  _sqlite = new Database(DB_PATH);
  _sqlite.pragma('journal_mode = WAL');
  _sqlite.pragma('foreign_keys = ON');

  _db = drizzle(_sqlite, { schema });

  // Auto-create tables if migrations folder doesn't exist yet
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    bootstrapSchema(_sqlite);
  } else {
    try {
      migrate(_db, { migrationsFolder: MIGRATIONS_DIR });
    } catch (e) {
      console.warn('[db] migration skipped, bootstrapping instead:', (e as Error).message);
      bootstrapSchema(_sqlite);
    }
  }

  return _db;
}

export function closeDB() {
  if (_sqlite) {
    _sqlite.close();
    _sqlite = null;
    _db = null;
  }
}

// Fallback DDL — ensures the app runs even before `drizzle-kit push`
function bootstrapSchema(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_ref TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS code_analysis (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      languages TEXT NOT NULL,
      frameworks TEXT NOT NULL,
      project_type TEXT,
      arch_patterns TEXT,
      issues TEXT NOT NULL,
      file_count INTEGER NOT NULL,
      line_count INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS recommendations (
      id TEXT PRIMARY KEY,
      analysis_id TEXT NOT NULL REFERENCES code_analysis(id),
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      reason TEXT NOT NULL,
      severity TEXT NOT NULL,
      platform_targets TEXT,
      payload TEXT NOT NULL,
      accepted INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS loops (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      pattern TEXT NOT NULL,
      graph TEXT NOT NULL,
      targets TEXT NOT NULL,
      meta TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS code_samples (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES projects(id),
      source TEXT NOT NULL,
      file_path TEXT NOT NULL,
      content TEXT NOT NULL,
      ai_generated INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS metric_events (
      id TEXT PRIMARY KEY,
      sample_id TEXT NOT NULL REFERENCES code_samples(id),
      rule TEXT NOT NULL,
      passed INTEGER NOT NULL,
      severity TEXT NOT NULL,
      detail TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS score_history (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES projects(id),
      style_score REAL NOT NULL,
      security_score REAL NOT NULL,
      test_score REAL NOT NULL,
      arch_score REAL NOT NULL,
      overall REAL NOT NULL,
      top_contributors TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  // ---- Lightweight column migrations for existing databases ----
  // SQLite supports ADD COLUMN; introspect via pragma_table_info.
  ensureColumn(sqlite, 'loops', 'meta', 'TEXT');
}

function ensureColumn(sqlite: Database.Database, table: string, column: string, type: string) {
  const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type};`);
    console.info(`[db] added column ${table}.${column}`);
  }
}
