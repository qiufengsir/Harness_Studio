// ============================================================
// Loops API — CRUD + compile-to-platforms
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db/client';
import { loops, Loop } from '@/lib/db/schema';
import { uuid } from '@/lib/utils/uuid';
import { PatternId, PATTERN_LIST, getPattern } from '@/lib/orchestrator/patterns';
import { compileLoop, LoopGraph } from '@/lib/orchestrator/compiler';
import { validateLoop } from '@/lib/orchestrator/validator';
import { healthCheck } from '@/lib/orchestrator/healthcheck';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — list all loops
export async function GET() {
  const db = getDB();
  const rows = db.select().from(loops).all().sort((a: Loop, b: Loop) => b.updatedAt - a.updatedAt);
  return NextResponse.json({
    loops: rows.map((r: Loop) => ({
      ...r,
      graph: JSON.parse(r.graph),
      targets: JSON.parse(r.targets),
    })),
    patterns: PATTERN_LIST.map((p) => ({ id: p.id, name: p.name, tagline: p.tagline })),
  });
}

// POST — create or compile
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  let db: ReturnType<typeof getDB>;
  try {
    db = getDB();
  } catch (e) {
    return NextResponse.json(
      { error: `Database unavailable: ${(e as Error).message}` },
      { status: 503 },
    );
  }

  const action = body.action ?? 'create';

  if (action === 'compile') {
    // Compile a loop to platform configs
    const { name, pattern, graph, targets } = body as {
      name: string;
      pattern: PatternId;
      graph: LoopGraph;
      targets: string[];
    };
    const issues = validateLoop(pattern, graph);
    if (issues.some((i) => i.level === 'error')) {
      return NextResponse.json({ error: 'Validation failed', issues }, { status: 400 });
    }
    const compiled = compileLoop(name, pattern, graph, targets);
    const health = healthCheck(name, pattern, graph, targets);
    return NextResponse.json({ compiled, validation: issues, health });
  }

  // Default: create new loop
  const { id: clientId, name, description, pattern, graph, targets, agentPrompts, meta } = body as {
    id?: string;
    name: string;
    description?: string;
    pattern: PatternId;
    graph?: LoopGraph;
    targets?: string[];
    agentPrompts?: Record<string, string>; // agent name -> system prompt
    meta?: { freeText?: string; uploadedFiles?: string[] } | null;
  };

  // If no graph provided, scaffold from pattern template
  let finalGraph: LoopGraph;
  if (graph && graph.nodes && graph.edges) {
    finalGraph = graph;
  } else {
    const tmpl = getPattern(pattern);
    finalGraph = {
      nodes: (tmpl?.nodes ?? []).map((n) => ({ ...n })),
      edges: (tmpl?.edges ?? []).map((e) => ({ ...e })),
    };
  }

  // If agentPrompts provided, fill systemPrompt on matching nodes
  if (agentPrompts && typeof agentPrompts === 'object') {
    for (const node of finalGraph.nodes) {
      const prompt = agentPrompts[node.agent];
      if (prompt && typeof prompt === 'string' && prompt.length > 0 && !prompt.startsWith('{')) {
        node.systemPrompt = prompt;
      }
    }
  }

  const id =
    typeof clientId === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(clientId) ? clientId : uuid();
  const now = Date.now();
  const loopName = name || 'Untitled Loop';
  const loopTargets = targets ?? ['agents', 'claude', 'cursor', 'copilot', 'trae'];
  let persisted = true;

  try {
    db.insert(loops).values({
      id,
      name: loopName,
      description: description ?? null,
      pattern,
      graph: JSON.stringify(finalGraph),
      targets: JSON.stringify(loopTargets),
      meta: meta ? JSON.stringify(meta) : null,
      createdAt: now,
      updatedAt: now,
    }).run();
  } catch (e) {
    // Cloudflare / in-memory DB 偶发失败时仍返回可打开画布的 payload，由前端 sessionStorage 兜底
    persisted = false;
    console.warn('[loops] persist failed, returning ephemeral loop:', (e as Error).message);
  }

  return NextResponse.json({
    id,
    name: loopName,
    pattern,
    graph: finalGraph,
    targets: loopTargets,
    meta: meta ?? null,
    ephemeral: !persisted,
  });
}
