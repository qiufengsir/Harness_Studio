// ============================================================
// Metrics API — submit AI code samples, get scores + history
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db/client';
import { codeSamples, metricEvents, scoreHistory, projects, CodeSample, MetricEvent, ScoreHistory } from '@/lib/db/schema';
import { scoreCode, scoreCodeBatch } from '@/lib/metrics/scorer';
import { uuid } from '@/lib/utils/uuid';
import { eq, desc } from '@/lib/db/query-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — dashboard data
export async function GET(req: NextRequest) {
  const db = getDB();
  const url = new URL(req.url);
  const projectId = url.searchParams.get('projectId');

  // Recent samples
  const samples = projectId
    ? db.select().from(codeSamples).where(eq(codeSamples.projectId, projectId)).orderBy(desc(codeSamples.createdAt)).limit(50).all()
    : db.select().from(codeSamples).orderBy(desc(codeSamples.createdAt)).limit(50).all();

  // Score history
  const history = projectId
    ? db.select().from(scoreHistory).where(eq(scoreHistory.projectId, projectId)).orderBy(desc(scoreHistory.createdAt)).limit(20).all()
    : db.select().from(scoreHistory).orderBy(desc(scoreHistory.createdAt)).limit(20).all();

  // Aggregate events for top-failing rules
  const allEvents = db.select().from(metricEvents).all();
  const ruleStats = new Map<string, { total: number; passed: number; failed: number; dimension: string }>();
  for (const ev of allEvents) {
    const key = ev.rule;
    if (!ruleStats.has(key)) ruleStats.set(key, { total: 0, passed: 0, failed: 0, dimension: '' });
    const s = ruleStats.get(key)!;
    s.total++;
    if (ev.passed) s.passed++;
    else s.failed++;
  }

  // Recent events for sample detail
  const recentEvents = db.select().from(metricEvents).orderBy(desc(metricEvents.createdAt)).limit(200).all();

  return NextResponse.json({
    samples: samples.map((s: CodeSample) => ({
      ...s,
      events: recentEvents.filter((e: MetricEvent) => e.sampleId === s.id).map((e: MetricEvent) => ({
        rule: e.rule,
        passed: !!e.passed,
        severity: e.severity,
        detail: e.detail,
        dimension: inferDimension(e.rule),
      })),
    })),
    history: history.map((h: ScoreHistory) => ({
      ...h,
      topContributors: h.topContributors ? JSON.parse(h.topContributors) : [],
    })),
    ruleStats: Array.from(ruleStats.entries())
      .map(([name, s]) => ({ name, ...s, passRate: s.total > 0 ? s.passed / s.total : 0 }))
      .sort((a, b) => b.failed - a.failed),
    projects: db.select().from(projects).all().slice(-20).reverse(),
  });
}

function inferDimension(rule: string): string {
  const map: Record<string, string> = {
    'no-explicit-any': 'style', 'no-console-log': 'style', 'consistent-naming': 'style', 'imports-sorted': 'style',
    'no-hardcoded-secrets': 'security', 'no-sql-injection': 'security', 'no-eval': 'security', 'https-only': 'security',
    'has-error-handling': 'test', 'has-input-validation': 'test', 'has-return-types': 'test',
    'no-circular-deps': 'arch', 'single-responsibility': 'arch', 'no-deep-nesting': 'arch', 'uses-type-safety': 'arch',
  };
  return map[rule] ?? 'style';
}

// POST — submit a code sample for scoring
export async function POST(req: NextRequest) {
  const db = getDB();
  const body = await req.json();
  const { filePath, content, projectId, source, aiGenerated } = body as {
    filePath: string;
    content: string;
    projectId?: string;
    source?: string;
    aiGenerated?: boolean;
  };

  if (!content || !filePath) {
    return NextResponse.json({ error: 'filePath and content required' }, { status: 400 });
  }

  const sampleId = uuid();
  const now = Date.now();

  // 1. Save sample
  db.insert(codeSamples).values({
    id: sampleId,
    projectId: projectId ?? null,
    source: source ?? 'paste',
    filePath,
    content,
    aiGenerated: aiGenerated ?? true,
    createdAt: now,
  }).run();

  // 2. Score it
  const result = scoreCode(content, filePath);

  // 3. Save events
  for (const ev of result.events) {
    db.insert(metricEvents).values({
      id: uuid(),
      sampleId,
      rule: ev.rule,
      passed: ev.passed,
      severity: ev.severity,
      detail: ev.detail ?? null,
      createdAt: now,
    }).run();
  }

  // 4. Save score history (per-project)
  db.insert(scoreHistory).values({
    id: uuid(),
    projectId: projectId ?? null,
    styleScore: result.style,
    securityScore: result.security,
    testScore: result.test,
    archScore: result.arch,
    overall: result.overall,
    topContributors: JSON.stringify(result.topContributors),
    createdAt: now,
  }).run();

  return NextResponse.json({
    sampleId,
    score: result,
  });
}

// POST /api/metrics?batch=true — submit multiple files for project-level scoring
export async function PUT(req: NextRequest) {
  const db = getDB();
  const body = await req.json();
  const { files, projectId, source } = body as {
    files: { filePath: string; content: string }[];
    projectId?: string;
    source?: string;
  };

  if (!files || !Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ error: 'files array required' }, { status: 400 });
  }

  const now = Date.now();
  const batchResult = scoreCodeBatch(files);

  // Save each file as a sample + events
  for (const f of batchResult.files) {
    const sampleId = uuid();
    db.insert(codeSamples).values({
      id: sampleId,
      projectId: projectId ?? null,
      source: source ?? 'batch',
      filePath: f.filePath,
      content: f.result.events.length > 0 ? files.find((x) => x.filePath === f.filePath)?.content ?? '' : '',
      aiGenerated: true,
      createdAt: now,
    }).run();

    for (const ev of f.result.events) {
      db.insert(metricEvents).values({
        id: uuid(),
        sampleId,
        rule: ev.rule,
        passed: ev.passed,
        severity: ev.severity,
        detail: ev.detail ?? null,
        createdAt: now,
      }).run();
    }
  }

  // Save aggregated score history
  db.insert(scoreHistory).values({
    id: uuid(),
    projectId: projectId ?? null,
    styleScore: batchResult.style,
    securityScore: batchResult.security,
    testScore: batchResult.test,
    archScore: batchResult.arch,
    overall: batchResult.overall,
    topContributors: JSON.stringify(batchResult.topContributors),
    createdAt: now,
  }).run();

  return NextResponse.json({
    fileCount: batchResult.fileCount,
    totalLines: batchResult.totalLines,
    scores: {
      style: batchResult.style,
      security: batchResult.security,
      test: batchResult.test,
      arch: batchResult.arch,
      overall: batchResult.overall,
    },
    files: batchResult.files.map((f) => ({
      filePath: f.filePath,
      lineCount: f.lineCount,
      overall: f.result.overall,
      style: f.result.style,
      security: f.result.security,
      test: f.result.test,
      arch: f.result.arch,
      failedRules: f.result.events.filter((e) => !e.passed).map((e) => ({ rule: e.rule, detail: e.detail })),
    })),
    ruleStats: batchResult.ruleStats,
    topContributors: batchResult.topContributors,
  });
}
