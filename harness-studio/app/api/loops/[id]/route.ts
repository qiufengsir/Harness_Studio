// ============================================================
// Loop by id — GET / PUT / DELETE
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db/client';
import { loops } from '@/lib/db/schema';
import { eq } from '@/lib/db/query-helpers';
import { compileLoop, LoopGraph } from '@/lib/orchestrator/compiler';
import { validateLoop } from '@/lib/orchestrator/validator';
import { PatternId } from '@/lib/orchestrator/patterns';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDB();
  const row = db.select().from(loops).where(eq(loops.id, id)).get();
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({
    ...row,
    graph: JSON.parse(row.graph),
    targets: JSON.parse(row.targets),
    meta: row.meta ? JSON.parse(row.meta) : null,
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDB();
  const body = await req.json();
  const now = Date.now();

  const updates: Record<string, unknown> = { updatedAt: now };
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.pattern !== undefined) updates.pattern = body.pattern;
  if (body.graph !== undefined) updates.graph = JSON.stringify(body.graph);
  if (body.targets !== undefined) updates.targets = JSON.stringify(body.targets);
  if (body.meta !== undefined) updates.meta = body.meta ? JSON.stringify(body.meta) : null;

  db.update(loops).set(updates).where(eq(loops.id, id)).run();

  return NextResponse.json({ ok: true, id });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDB();
  db.delete(loops).where(eq(loops.id, id)).run();
  return NextResponse.json({ ok: true });
}
