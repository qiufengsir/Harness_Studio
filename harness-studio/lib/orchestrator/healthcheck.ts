// ============================================================
// Health Check — score a loop config across 4 dimensions
// Dimensions (per upgrade plan):
//   1. Completeness  — does each agent have a real system prompt?
//   2. Coverage      — are key domains (security/test/docs/review) covered?
//   3. Coherence     — does the pattern fit the agent roster?
//   4. Platform      — do compile targets each have content?
// Output: 0-100 per dimension + overall + findings list
// ============================================================
import type { LoopGraph } from './compiler';
import type { PatternId } from './patterns';

export type Severity = 'critical' | 'warning' | 'info';

export interface Finding {
  dimension: 'completeness' | 'coverage' | 'coherence' | 'platform';
  severity: Severity;
  message: string;
  agent?: string;
}

export interface HealthReport {
  scores: {
    completeness: number;
    coverage: number;
    coherence: number;
    platform: number;
    overall: number;
  };
  findings: Finding[];
  agentCount: number;
  edgeCount: number;
  passed: boolean;        // overall >= 60
}

const PROMPT_MIN_LEN = 80;       // < 80 chars = "empty shell"
const PROMPT_GOOD_LEN = 200;     // >= 200 chars = "substantial"
const COVERAGE_DOMAINS = ['security', 'tester', 'doc-writer', 'reviewer'] as const;

export function healthCheck(
  name: string,
  pattern: PatternId,
  graph: LoopGraph,
  targets: string[],
): HealthReport {
  const findings: Finding[] = [];
  const nodes = graph.nodes;
  const edges = graph.edges;

  // ---- 1. Completeness ----
  let completeAgents = 0;
  for (const n of nodes) {
    const sp = (n.systemPrompt ?? '').trim();
    if (sp.length === 0) {
      findings.push({
        dimension: 'completeness',
        severity: 'critical',
        message: `Agent "${n.label}" has no system prompt — it's an empty shell.`,
        agent: n.agent,
      });
    } else if (sp.length < PROMPT_MIN_LEN) {
      findings.push({
        dimension: 'completeness',
        severity: 'warning',
        message: `Agent "${n.label}" system prompt is too short (${sp.length} chars) — add concrete instructions.`,
        agent: n.agent,
      });
    } else {
      completeAgents++;
      if (sp.length < PROMPT_GOOD_LEN) {
        findings.push({
          dimension: 'completeness',
          severity: 'info',
          message: `Agent "${n.label}" prompt is thin (${sp.length} chars) — consider expanding with file scope + hand-off rules.`,
          agent: n.agent,
        });
      }
    }
  }
  // Completeness score: % of agents with substantive prompts
  const completeness = nodes.length > 0 ? Math.round((completeAgents / nodes.length) * 100) : 0;

  // ---- 2. Coverage ----
  const roles = new Set(nodes.map((n) => n.role));
  const missingDomains = COVERAGE_DOMAINS.filter((d) => {
    // accept either role match or agent-name hint
    return !nodes.some(
      (n) => n.role === d || (n.agent + n.label).toLowerCase().includes(d.replace('-writer', '').replace('tester', 'test')),
    );
  });
  for (const d of missingDomains) {
    findings.push({
      dimension: 'coverage',
      severity: d === 'security' ? 'critical' : 'warning',
      message: `No ${d} agent in the loop — ${d} concerns won't be caught.`,
    });
  }
  const coverage = Math.round(
    ((COVERAGE_DOMAINS.length - missingDomains.length) / COVERAGE_DOMAINS.length) * 100,
  );

  // Too few or too many agents?
  if (nodes.length < 3) {
    findings.push({
      dimension: 'coverage',
      severity: 'warning',
      message: `Only ${nodes.length} agents — most loops benefit from 4-8 specialists.`,
    });
  }
  if (nodes.length > 10) {
    findings.push({
      dimension: 'coverage',
      severity: 'info',
      message: `${nodes.length} agents is a lot — consider splitting into multiple loops.`,
    });
  }

  // ---- 3. Coherence ----
  let coherence = 100;
  // Pattern-specific structural checks
  if (pattern === 'worker-leader' || pattern === 'hierarchical') {
    const leaders = nodes.filter((n) => n.role === 'leader');
    if (leaders.length === 0) {
      findings.push({ dimension: 'coherence', severity: 'critical', message: `${pattern} requires a leader node.` });
      coherence -= 40;
    } else if (leaders.length > 1 && pattern === 'worker-leader') {
      findings.push({ dimension: 'coherence', severity: 'warning', message: `worker-leader usually has 1 leader, found ${leaders.length}.` });
      coherence -= 15;
    }
    const workers = nodes.filter((n) => n.role === 'worker');
    if (workers.length === 0) {
      findings.push({ dimension: 'coherence', severity: 'warning', message: `${pattern} has no worker nodes.` });
      coherence -= 20;
    }
  }
  if (pattern === 'specialist-router') {
    const routers = nodes.filter((n) => n.role === 'router');
    if (routers.length === 0) {
      findings.push({ dimension: 'coherence', severity: 'critical', message: `specialist-router requires a router node.` });
      coherence -= 40;
    }
  }
  if (pattern === 'pipeline') {
    // Pipeline should be roughly linear: each node (except last) has an outgoing edge
    const nodeOutDeg: Record<string, number> = {};
    for (const e of edges) nodeOutDeg[e.source] = (nodeOutDeg[e.source] ?? 0) + 1;
    const endpoints = nodes.filter((n) => (nodeOutDeg[n.id] ?? 0) === 0);
    if (endpoints.length > 1) {
      findings.push({
        dimension: 'coherence',
        severity: 'warning',
        message: `Pipeline has ${endpoints.length} terminal nodes — should be 1 for a clean line.`,
      });
      coherence -= 15;
    }
  }
  if (pattern === 'parallel') {
    const merge = nodes.filter((n) => n.role === 'merge');
    if (merge.length === 0) {
      findings.push({ dimension: 'coherence', severity: 'critical', message: `Parallel pattern needs a merge node.` });
      coherence -= 30;
    }
  }
  if (pattern === 'peer-to-peer') {
    // Each node should have at least one bidirectional connection
    for (const n of nodes) {
      const hasOut = edges.some((e) => e.source === n.id);
      const hasIn = edges.some((e) => e.target === n.id);
      if (!hasOut || !hasIn) {
        findings.push({
          dimension: 'coherence',
          severity: 'info',
          message: `Peer "${n.label}" is missing in/out edges — peers should be bidirectionally connected.`,
          agent: n.agent,
        });
        coherence -= 5;
      }
    }
  }
  coherence = Math.max(0, coherence);

  // ---- 4. Platform ----
  let platform = 100;
  if (targets.length === 0) {
    findings.push({ dimension: 'platform', severity: 'critical', message: `No compile targets selected.` });
    platform = 0;
  } else if (targets.length < 3) {
    findings.push({
      dimension: 'platform',
      severity: 'info',
      message: `Only ${targets.length} platform(s) selected — compiling to more increases portability.`,
    });
    platform -= 10;
  }
  // Check for AGENTS.md conflict (Trae + Aider + Agents all write AGENTS.md)
  const writesAgentsMd = targets.filter((t) => ['agents', 'trae', 'aider'].includes(t));
  if (writesAgentsMd.length > 1) {
    findings.push({
      dimension: 'platform',
      severity: 'warning',
      message: `${writesAgentsMd.length} targets (${writesAgentsMd.join(', ')}) all write AGENTS.md — last one wins. Pick one.`,
    });
    platform -= 15;
  }
  platform = Math.max(0, platform);

  // ---- Overall ----
  const overall = Math.round(
    completeness * 0.35 + coverage * 0.25 + coherence * 0.25 + platform * 0.15,
  );

  return {
    scores: { completeness, coverage, coherence, platform, overall },
    findings: findings.sort((a, b) => {
      const order: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    }),
    agentCount: nodes.length,
    edgeCount: edges.length,
    passed: overall >= 60,
  };
}
