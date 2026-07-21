// ============================================================
// DB Client — dual mode: better-sqlite3 (local/Railway) or
// in-memory (Cloudflare Workers where native modules are unavailable)
//
// Key: ESM static imports for memory-client and schema so Cloudflare
// Workers do not 500 on unavailable require(). better-sqlite3 stays
// dynamically required (Node-only path). If native sqlite init fails,
// fall back to the in-memory DB.
// ============================================================
import { getMemoryDB } from './memory-client';
import * as schema from './schema';

let _db: any = null;
let _memoryMode: boolean | null = null;

/**
 * Detect whether to use in-memory DB mode.
 * - Cloudflare Workers: require unavailable or better-sqlite3 unloadable -> memory
 * - Node.js (local/Railway): better-sqlite3 loads -> real DB
 *
 * Note: `require` is a CJS module-local (not on globalThis). In ESM/Workers
 * it is undeclared; `typeof` is safe and does not throw ReferenceError.
 */
function detectMemoryMode(): boolean {
  if (_memoryMode !== null) return _memoryMode;

  if (process.env.OPEN_NEXT_FORCE_MEMORY_DB === '1') {
    _memoryMode = true;
    return true;
  }
  if (process.env.USE_MEMORY_DB === '1') {
    _memoryMode = true;
    return true;
  }
  if (process.env.CF_PAGES === '1' || process.env.CLOUDFLARE_WORKERS === '1') {
    _memoryMode = true;
    return true;
  }

  try {
    // `typeof require` is 'undefined' in ESM/Workers, 'function' in CJS
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    if (typeof require !== 'function') {
      _memoryMode = true;
      return true;
    }
    // Resolve better-sqlite3 without instantiating (avoid side effects)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require.resolve('better-sqlite3');
    _memoryMode = false;
    return false;
  } catch {
    _memoryMode = true;
    console.info('[db] better-sqlite3 not available, using in-memory database');
    return true;
  }
}

function initMemoryDB() {
  _db = getMemoryDB();
  _memoryMode = true;
  return _db;
}

function initSqliteDB() {
  // better-sqlite3 + Drizzle for local / Railway (Node-only; require is safe here)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require('drizzle-orm/better-sqlite3');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { migrate } = require('drizzle-orm/better-sqlite3/migrator');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('node:path');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs');

  const DB_PATH = process.env.DATABASE_PATH
    ? path.resolve(process.env.DATABASE_PATH)
    : path.resolve(process.cwd(), 'dev.db');
  const MIGRATIONS_DIR = path.resolve(process.cwd(), 'lib', 'db', 'migrations');

  const _sqlite = new Database(DB_PATH);
  _sqlite.pragma('journal_mode = WAL');
  _sqlite.pragma('foreign_keys = ON');

  _db = drizzle(_sqlite, { schema });

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

export function getDB() {
  if (_db) return _db;

  if (detectMemoryMode()) {
    return initMemoryDB();
  }

  // On Cloudflare, better-sqlite3 may resolve but crash on new Database()
  // (native binding). Always fall back to memory.
  try {
    return initSqliteDB();
  } catch (e) {
    console.warn('[db] sqlite init failed, falling back to memory:', (e as Error).message);
    return initMemoryDB();
  }
}

export function closeDB() {
  // No-op for in-memory mode
}

export function isMemoryDB(): boolean {
  return _memoryMode === true;
}

// Fallback DDL — ensures the app runs even before `drizzle-kit push`
function bootstrapSchema(sqlite: any) {
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

  ensureColumn(sqlite, 'loops', 'meta', 'TEXT');
}

function ensureColumn(sqlite: any, table: string, column: string, type: string) {
  const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type};`);
    console.info(`[db] added column ${table}.${column}`);
  }
}