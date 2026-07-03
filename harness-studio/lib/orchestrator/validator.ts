// ============================================================
// Loop Validator — sanity-checks a graph before compilation
// ============================================================
import { LoopGraph } from './compiler';
import { PatternId, PATTERNS } from './patterns';

export interface ValidationIssue {
  level: 'error' | 'warning';
  message: string;
}

export function validateLoop(
  pattern: PatternId,
  graph: LoopGraph
): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const nodeIds = new Set(graph.nodes.map((n) => n.id));

  // All edge endpoints must exist
  for (const e of graph.edges) {
    if (!nodeIds.has(e.source)) out.push({ level: 'error', message: `Edge ${e.id} references missing source ${e.source}` });
    if (!nodeIds.has(e.target)) out.push({ level: 'error', message: `Edge ${e.id} references missing target ${e.target}` });
  }

  // Pattern-specific checks
  const def = PATTERNS[pattern];
  if (pattern === 'pipeline') {
    // Pipeline should be roughly linear — warn if not
    const sources = new Set(graph.edges.map((e) => e.source));
    const targets = new Set(graph.edges.map((e) => e.target));
    const starts = graph.nodes.filter((n) => !targets.has(n.id));
    const ends = graph.nodes.filter((n) => !sources.has(n.id));
    if (starts.length !== 1) out.push({ level: 'warning', message: `Pipeline should have 1 start node, found ${starts.length}` });
    if (ends.length !== 1) out.push({ level: 'warning', message: `Pipeline should have 1 end node, found ${ends.length}` });
  }
  if (pattern === 'parallel') {
    // All nodes should connect to the merge
    const mergeNode = graph.nodes.find((n) => n.role === 'merge');
    if (!mergeNode) out.push({ level: 'warning', message: 'Parallel pattern recommends a merge node' });
  }
  if (pattern === 'worker-leader') {
    const leader = graph.nodes.find((n) => n.role === 'leader');
    if (!leader) out.push({ level: 'error', message: 'Worker-leader pattern requires a leader node' });
  }
  if (pattern === 'specialist-router') {
    const router = graph.nodes.find((n) => n.role === 'router');
    if (!router) out.push({ level: 'error', message: 'Specialist-router pattern requires a router node' });
  }

  // Each node should have an agent assigned
  for (const n of graph.nodes) {
    if (!n.agent || n.agent.length === 0) {
      out.push({ level: 'error', message: `Node ${n.label} has no agent assigned` });
    }
  }

  return out;
}
