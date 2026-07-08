// ============================================================
// POST /api/analyze
// Body: { files: {path, content}[], projectName }
// Returns: { projectId, analysisId, stats, issues, recommendations }
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db/client';
import { projects, codeAnalysis, recommendations } from '@/lib/db/schema';
import { parseFiles, extractDependencies } from '@/lib/analyzer/parser';
import { runAllDetectors } from '@/lib/analyzer/detector';
import { recommendFromIssues, maybeAddPipelineLoop } from '@/lib/analyzer/recommender';
import { decodeFiles } from '@/lib/analyzer/file-decoder';
import { uuid } from '@/lib/utils/uuid';
import { checkRateLimit, getClientIP } from '@/lib/middleware/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Rate limit check
    const ip = getClientIP(req);
    const rate = checkRateLimit(ip);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a minute and try again.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rate.resetAt - Date.now()) / 1000)) } }
      );
    }

    const body = await req.json();
    const { files, projectName, source, sourceRef } = body as {
      files: { path: string; content: string }[];
      projectName: string;
      source?: string;
      sourceRef?: string;
    };

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    // 解码 Base64 编码的二进制文件（PDF/Word）
    const decodedFiles = await decodeFiles(files);

    const db = getDB();
    const now = Date.now();
    const projectId = uuid();
    const analysisId = uuid();

    // 1. Create project
    db.insert(projects).values({
      id: projectId,
      name: projectName || 'untitled-project',
      source: source || 'upload',
      sourceRef: sourceRef || null,
      createdAt: now,
    }).run();

    // 2. Parse files
    const { files: parsed, stats } = parseFiles(decodedFiles);
    const { languages, frameworks, projectType } = extractDependencies(parsed);

    // 3. Run detectors
    const issues = runAllDetectors(parsed);

    // 4. Build recommendations
    let recs = recommendFromIssues(issues);
    recs = maybeAddPipelineLoop(recs, issues);

    // 5. Persist analysis
    db.insert(codeAnalysis).values({
      id: analysisId,
      projectId,
      languages: JSON.stringify(languages),
      frameworks: JSON.stringify(frameworks),
      projectType: projectType ?? null,
      archPatterns: JSON.stringify([]),
      issues: JSON.stringify(issues),
      fileCount: stats.fileCount,
      lineCount: stats.lineCount,
      createdAt: now,
    }).run();

    // 6. Persist recommendations
    for (const rec of recs) {
      db.insert(recommendations).values({
        id: uuid(),
        analysisId,
        kind: rec.kind,
        name: rec.name,
        reason: rec.reason,
        severity: rec.severity,
        platformTargets: JSON.stringify(rec.platforms),
        payload: JSON.stringify(rec.payload),
        accepted: false,
        createdAt: now,
      }).run();
    }

    return NextResponse.json({
      projectId,
      analysisId,
      stats: {
        ...stats,
        languages,
        frameworks,
        projectType,
      },
      issues: issues.slice(0, 100), // cap for client
      recommendations: recs,
      summary: {
        totalIssues: issues.length,
        critical: issues.filter((i) => i.severity === 'critical').length,
        warning: issues.filter((i) => i.severity === 'warning').length,
        info: issues.filter((i) => i.severity === 'info').length,
        totalRecs: recs.length,
      },
    });
  } catch (e) {
    console.error('[analyze] error:', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET() {
  // List recent analyses
  const db = getDB();
  const rows = db.select().from(codeAnalysis).all();
  return NextResponse.json({ analyses: rows.slice(-20).reverse() });
}
