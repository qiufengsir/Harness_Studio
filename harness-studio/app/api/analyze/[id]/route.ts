// ============================================================
// GET /api/analyze/[id] — fetch a saved analysis + recommendations
// POST /api/analyze/[id]/accept — accept a recommendation
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db/client';
import { codeAnalysis, recommendations, projects, Recommendation } from '@/lib/db/schema';
import { eq } from '@/lib/db/query-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDB();
  const analysis = db.select().from(codeAnalysis).where(eq(codeAnalysis.id, id)).get();
  if (!analysis) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const project = db.select().from(projects).where(eq(projects.id, analysis.projectId)).get();
  const recs = db.select().from(recommendations).where(eq(recommendations.analysisId, id)).all();

  return NextResponse.json({
    project,
    analysis: {
      ...analysis,
      languages: JSON.parse(analysis.languages),
      frameworks: JSON.parse(analysis.frameworks),
      archPatterns: analysis.archPatterns ? JSON.parse(analysis.archPatterns) : [],
      issues: JSON.parse(analysis.issues),
    },
    recommendations: recs.map((r: Recommendation) => ({
      ...r,
      platformTargets: r.platformTargets ? JSON.parse(r.platformTargets) : [],
      payload: JSON.parse(r.payload),
    })),
  });
}
