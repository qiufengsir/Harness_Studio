// ============================================================
// Loop client cache — sessionStorage fallback for ephemeral DB
// (Cloudflare Workers / in-memory mode where isolates don't share state)
// ============================================================
import { getPattern, type PatternId } from '@/lib/orchestrator/patterns';
import type { LoopGraph } from '@/lib/orchestrator/compiler';

export const DEFAULT_LOOP_TARGETS = ['agents', 'claude', 'cursor', 'copilot', 'trae'];

export interface LoopCacheData {
  id: string;
  name: string;
  description?: string | null;
  pattern: string;
  graph: LoopGraph;
  targets: string[];
  meta?: { freeText?: string; uploadedFiles?: string[] } | null;
  updatedAt: number;
}

/** Scaffold a graph from a pattern template, optionally filling agent prompts. */
export function scaffoldLoopGraph(
  pattern: string,
  graph?: LoopGraph | null,
  agentPrompts?: Record<string, string> | null,
): LoopGraph {
  let finalGraph: LoopGraph;
  if (graph?.nodes?.length && graph.edges) {
    finalGraph = {
      nodes: graph.nodes.map((n) => ({ ...n })),
      edges: graph.edges.map((e) => ({ ...e })),
    };
  } else {
    const tmpl = getPattern(pattern as PatternId);
    finalGraph = {
      nodes: (tmpl?.nodes ?? []).map((n) => ({ ...n })),
      edges: (tmpl?.edges ?? []).map((e) => ({ ...e })),
    };
  }

  if (agentPrompts && typeof agentPrompts === 'object') {
    for (const node of finalGraph.nodes) {
      const prompt = agentPrompts[node.agent];
      if (prompt && typeof prompt === 'string' && prompt.length > 0 && !prompt.startsWith('{')) {
        node.systemPrompt = prompt;
      }
    }
  }

  return finalGraph;
}

export function cacheLoop(data: LoopCacheData): void {
  try {
    sessionStorage.setItem(`loop_${data.id}`, JSON.stringify(data));
  } catch {
    // private mode / quota — ignore
  }
}

export function getCachedLoop(id: string): LoopCacheData | null {
  try {
    const raw = sessionStorage.getItem(`loop_${id}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.graph?.nodes) return null;
    return parsed as LoopCacheData;
  } catch {
    return null;
  }
}
