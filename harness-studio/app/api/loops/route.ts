// ============================================================
// Loops API — CRUD + compile-to-platforms
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db/client';
import { loops } from '@/lib/db/schema';
import { randomUUID } from 'node:crypto';
import { PatternId, PATTERN_LIST, getPattern } from '@/lib/orchestrator/patterns';
import { compileLoop, LoopGraph } from '@/lib/orchestrator/compiler';
import { validateLoop } from '@/lib/orchestrator/validator';
import { healthCheck } from '@/lib/orchestrator/healthcheck';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — list all loops
export async function GET() {
  const db = getDB();
  const rows = db.select().from(loops).all().sort((a, b) => b.updatedAt - a.updatedAt);
  return NextResponse.json({
    loops: rows.map((r) => ({
      ...r,
      graph: JSON.parse(r.graph),
      targets: JSON.parse(r.targets),
    })),
    patterns: PATTERN_LIST.map((p) => ({ id: p.id, name: p.name, tagline: p.tagline })),
  });
}

// POST — create or compile
export async function POST(req: NextRequest) {
  const db = getDB();
  const body = await req.json();
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
  const { name, description, pattern, graph, targets, agentPrompts, meta } = body as {
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
  if (graph) {
    finalGraph = graph;
  } else {
    const tmpl = getPattern(pattern);
    finalGraph = {
      nodes: tmpl.nodes.map((n) => ({ ...n })),
      edges: tmpl.edges.map((e) => ({ ...e })),
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

  const id = randomUUID();
  const now = Date.now();
  db.insert(loops).values({
    id,
    name: name || 'Untitled Loop',
    description: description ?? null,
    pattern,
    graph: JSON.stringify(finalGraph),
    targets: JSON.stringify(targets ?? ['agents', 'claude', 'cursor', 'copilot', 'trae']),
    meta: meta ? JSON.stringify(meta) : null,
    createdAt: now,
    updatedAt: now,
  }).run();

  return NextResponse.json({ id, name, pattern, graph: finalGraph });
}
