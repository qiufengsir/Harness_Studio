// ============================================================
// In-Memory Database — Drizzle-compatible API for Cloudflare Pages
// Replaces better-sqlite3 when native modules are unavailable.
// Data is ephemeral (resets on cold start), sufficient for demos.
// ============================================================
import * as schema from './schema';

// ---- Column mapping: column object -> JS property name ----
const columnToKey = new WeakMap<object, string>();

function registerTable(table: any) {
  if (!table || typeof table !== 'object') return;
  for (const key of Object.keys(table)) {
    const col = table[key];
    if (col && typeof col === 'object') {
      columnToKey.set(col, key);
    }
  }
}

// Register all schema tables
for (const tableName of Object.keys(schema)) {
  registerTable((schema as any)[tableName]);
}

export function getColumnKey(column: any): string {
  return columnToKey.get(column) ?? '';
}

// ---- Query builders ----
type Row = Record<string, any>;

class SelectQuery {
  private table: any;
  private conditions: { columnKey: string; value: any }[] = [];
  private orderColumn: string | null = null;
  private orderDir: 'asc' | 'desc' = 'asc';
  private limitCount: number | null = null;

  constructor(private db: MemoryDB) {}

  from(table: any) {
    this.table = table;
    return this;
  }

  where(condition: any) {
    // Extract condition from our custom eq() or Drizzle's eq()
    const ck = condition?.__memoryColumnKey;
    const val = condition?.__memoryValue;
    if (ck) {
      this.conditions.push({ columnKey: ck, value: val });
    }
    return this;
  }

  orderBy(order: any) {
    const ck = order?.__memoryColumnKey;
    if (ck) {
      this.orderColumn = ck;
      this.orderDir = order?.__memoryDirection ?? 'asc';
    }
    return this;
  }

  limit(n: number) {
    this.limitCount = n;
    return this;
  }

  all(): Row[] {
    let rows = this.db.getTableData(this.table);
    // Apply conditions
    for (const cond of this.conditions) {
      rows = rows.filter((r) => r[cond.columnKey] === cond.value);
    }
    // Apply ordering
    if (this.orderColumn) {
      const col = this.orderColumn;
      const dir = this.orderDir === 'desc' ? -1 : 1;
      rows = [...rows].sort((a, b) => {
        if (a[col] < b[col]) return -1 * dir;
        if (a[col] > b[col]) return 1 * dir;
        return 0;
      });
    }
    // Apply limit
    if (this.limitCount !== null) {
      rows = rows.slice(0, this.limitCount);
    }
    // Return deep copies to prevent mutation
    return rows.map((r) => ({ ...r }));
  }

  get(): Row | undefined {
    const rows = this.all();
    return rows[0];
  }
}

class InsertQuery {
  private data: Row = {};

  constructor(private db: MemoryDB, private table: any) {}

  values(data: Row) {
    this.data = data;
    return this;
  }

  run() {
    this.db.getTableData(this.table).push({ ...this.data });
    return { changes: 1 };
  }
}

class UpdateQuery {
  private data: Row = {};
  private conditions: { columnKey: string; value: any }[] = [];

  constructor(private db: MemoryDB, private table: any) {}

  set(data: Row) {
    this.data = data;
    return this;
  }

  where(condition: any) {
    const ck = condition?.__memoryColumnKey;
    const val = condition?.__memoryValue;
    if (ck) {
      this.conditions.push({ columnKey: ck, value: val });
    }
    return this;
  }

  run() {
    const rows = this.db.getTableData(this.table);
    let changes = 0;
    for (let i = 0; i < rows.length; i++) {
      const matches = this.conditions.every((c) => rows[i][c.columnKey] === c.value);
      if (matches) {
        rows[i] = { ...rows[i], ...this.data };
        changes++;
      }
    }
    return { changes };
  }
}

class DeleteQuery {
  private conditions: { columnKey: string; value: any }[] = [];

  constructor(private db: MemoryDB, private table: any) {}

  where(condition: any) {
    const ck = condition?.__memoryColumnKey;
    const val = condition?.__memoryValue;
    if (ck) {
      this.conditions.push({ columnKey: ck, value: val });
    }
    return this;
  }

  run() {
    const rows = this.db.getTableData(this.table);
    const before = rows.length;
    const filtered = rows.filter(
      (r) => !this.conditions.every((c) => r[c.columnKey] === c.value)
    );
    this.db.setTableData(this.table, filtered);
    return { changes: before - filtered.length };
  }
}

// ---- Main memory database class ----
class MemoryDB {
  private tables = new Map<object, Row[]>();

  getTableData(table: any): Row[] {
    if (!this.tables.has(table)) {
      this.tables.set(table, []);
    }
    return this.tables.get(table)!;
  }

  setTableData(table: any, data: Row[]) {
    this.tables.set(table, data);
  }

  select() {
    return new SelectQuery(this);
  }

  insert(table: any) {
    return new InsertQuery(this, table);
  }

  update(table: any) {
    return new UpdateQuery(this, table);
  }

  delete(table: any) {
    return new DeleteQuery(this, table);
  }
}

// Singleton
let _memoryDB: MemoryDB | null = null;

export function getMemoryDB() {
  if (!_memoryDB) {
    _memoryDB = new MemoryDB();
  }
  return _memoryDB;
}
