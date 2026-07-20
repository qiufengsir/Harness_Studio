// ============================================================
// DB Client — dual mode: better-sqlite3 (local/Railway) or
// in-memory (Cloudflare Workers where native modules are unavailable)
//
// 关键：使用 ESM 静态 import 引入 memory-client 与 schema，
// 避免 Cloudflare Workers 运行时里 `require()` 不可用导致的 500。
// better-sqlite3 仍用 require 动态加载（仅 Node 分支会走到）。
// ============================================================
import { getMemoryDB } from './memory-client';
import * as schema from './schema';

let _db: any = null;
let _memoryMode: boolean | null = null;

/**
 * 检测当前是否需要走内存数据库模式。
 * - Cloudflare Workers：require 不可用或 better-sqlite3 无法加载 → 内存模式
 * - Node.js (本地/Railway)：better-sqlite3 可正常加载 → 真实数据库模式
 *
 * 注意：`require` 在 CJS 里是模块级局部变量（不在 globalThis 上），
 * 在 ESM/Workers 运行时则未定义。`typeof` 对未声明标识符安全（不抛 ReferenceError）。
 */
function detectMemoryMode(): boolean {
  if (_memoryMode !== null) return _memoryMode;
  try {
    // `typeof require` 在 ESM/Workers 下返回 'undefined'，在 CJS 下返回 'function'
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    if (typeof require !== 'function') {
      _memoryMode = true;
      return true;
    }
    // 尝试解析 better-sqlite3（不实际实例化，避免副作用）
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

export function getDB() {
  if (_db) return _db;

  if (detectMemoryMode()) {
    _db = getMemoryDB();
    return _db;
  }

  // Use better-sqlite3 + Drizzle ORM for local dev / Railway
  // 此分支仅在 Node.js 环境下走到，require 安全可用
  const Database = require('better-sqlite3');
  const { drizzle } = require('drizzle-orm/better-sqlite3');
  const { migrate } = require('drizzle-orm/better-sqlite3/migrator');
  const path = require('node:path');
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

export function closeDB() {
  // No-op for in-memory mode
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
