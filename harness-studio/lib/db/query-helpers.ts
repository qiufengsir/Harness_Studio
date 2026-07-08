// ============================================================
// Query helpers — dual-mode eq() and desc()
// Works with both Drizzle ORM (better-sqlite3) and Memory DB.
// Adds __memory* metadata that Memory DB reads; Drizzle ignores it.
// ============================================================
import { eq as drizzleEq, desc as drizzleDesc } from 'drizzle-orm';
import { getColumnKey } from './memory-client';

export function eq(column: any, value: any) {
  const original = drizzleEq(column, value);
  // Attach metadata for in-memory DB; Drizzle ORM ignores unknown props
  try {
    (original as any).__memoryColumnKey = getColumnKey(column);
    (original as any).__memoryValue = value;
  } catch {
    // If object is frozen, we can't add props — in-memory DB will skip this condition
  }
  return original;
}

export function desc(column: any) {
  const original = drizzleDesc(column);
  try {
    (original as any).__memoryColumnKey = getColumnKey(column);
    (original as any).__memoryDirection = 'desc';
  } catch {}
  return original;
}
