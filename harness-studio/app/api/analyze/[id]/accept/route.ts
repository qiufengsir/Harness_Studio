// ============================================================
// POST /api/analyze/[id]/accept — toggle accept state of a recommendation
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db/client';
import { recommendations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDB();
  const body = await req.json();
  const accept = !!body.accept;

  db.update(recommendations)
    .set({ accepted: accept })
    .where(eq(recommendations.id, id))
    .run();

  return NextResponse.json({ ok: true, id, accepted: accept });
}
