// ============================================================
// Loop Patterns — 4 canonical multi-agent orchestration patterns
// Each pattern defines:
//   - node template (roles + suggested agents)
//   - edge template (control flow)
//   - description of when to use it
// ============================================================

export type PatternId = 'pipeline' | 'parallel' | 'worker-leader' | 'specialist-router';

export interface PatternNode {
  id: string;
  role: string;             // 'reviewer' | 'security' | 'tester' | 'leader' | 'worker' | 'router' | 'doc-writer'
  label: string;
  agent: string;            // suggested agent name
  description: string;
  // Position on canvas (initial layout)
  x: number;
  y: number;
}

export interface PatternEdge {
  id: string;
  source: string;
  target: string;
  label?: string;           // condition or message type
}

export interface PatternDef {
  id: PatternId;
  name: string;
  tagline: string;
  description: string;
  whenToUse: string[];
  // Pre-populated graph
  nodes: PatternNode[];
  edges: PatternEdge[];
}

// ---------- Pipeline ----------
const PIPELINE: PatternDef = {
  id: 'pipeline',
  name: 'Pipeline',
  tagline: 'Sequential stages, each hands off to the next.',
  description: 'A linear chain where each agent processes the output of the previous one. Best for code review workflows where each stage has a single responsibility.',
  whenToUse: [
    'PR review with multiple lenses (style → security → tests)',
    'Release workflow (build → test → deploy → verify)',
    'Bug fixing (reproduce → diagnose → patch → verify)',
  ],
  nodes: [
    { id: 'n1', role: 'reviewer',  label: 'Code Reviewer',  agent: 'code-reviewer',  description: 'Style, complexity, duplication', x: 80,  y: 200 },
    { id: 'n2', role: 'security',  label: 'Security Auditor', agent: 'security-auditor', description: 'Vulnerabilities, secrets, auth', x: 320, y: 200 },
    { id: 'n3', role: 'tester',    label: 'Test Engineer',   agent: 'test-engineer',  description: 'Coverage, edge cases, integration', x: 560, y: 200 },
    { id: 'n4', role: 'doc-writer', label: 'Doc Writer',     agent: 'doc-writer',     description: 'Update README, ADR, API docs', x: 800, y: 200 },
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n2', label: 'approved' },
    { id: 'e2', source: 'n2', target: 'n3', label: 'passed' },
    { id: 'e3', source: 'n3', target: 'n4', label: 'covered' },
  ],
};

// ---------- Parallel ----------
const PARALLEL: PatternDef = {
  id: 'parallel',
  name: 'Parallel',
  tagline: 'Multiple specialists run at once, then merge.',
  description: 'All agents work on the same input simultaneously. The merge step aggregates their findings. Best when dimensions are independent and speed matters.',
  whenToUse: [
    'Holistic PR review (security + style + perf + tests at once)',
    'Initial codebase audit (multiple lenses simultaneously)',
    'Design exploration (frontend + backend + data architects)',
  ],
  nodes: [
    { id: 'n1', role: 'reviewer',  label: 'Code Reviewer',   agent: 'code-reviewer',   description: 'Style + complexity', x: 320, y: 80 },
    { id: 'n2', role: 'security',  label: 'Security Auditor', agent: 'security-auditor', description: 'Vulns + secrets', x: 560, y: 80 },
    { id: 'n3', role: 'tester',    label: 'Test Engineer',    agent: 'test-engineer',   description: 'Coverage + edge cases', x: 320, y: 320 },
    { id: 'n4', role: 'doc-writer', label: 'Doc Writer',      agent: 'doc-writer',      description: 'Docs sync', x: 560, y: 320 },
    { id: 'merge', role: 'merge', label: 'Merge Results',    agent: 'orchestrator',    description: 'Aggregate, dedupe, prioritize', x: 800, y: 200 },
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'merge' },
    { id: 'e2', source: 'n2', target: 'merge' },
    { id: 'e3', source: 'n3', target: 'merge' },
    { id: 'e4', source: 'n4', target: 'merge' },
  ],
};

// ---------- Worker-Leader ----------
const WORKER_LEADER: PatternDef = {
  id: 'worker-leader',
  name: 'Worker-Leader',
  tagline: 'Leader splits task, workers execute, leader assembles.',
  description: 'An orchestrator agent decomposes a complex task into subtasks, dispatches them to specialist workers, then synthesizes the results. Best for large features spanning multiple domains.',
  whenToUse: [
    'Building a feature requiring frontend + backend + tests + docs',
    'Large refactor across multiple modules',
    'Migrating a service (schema + code + deploy + monitor)',
  ],
  nodes: [
    { id: 'leader', role: 'leader', label: 'Orchestrator',   agent: 'orchestrator', description: 'Plan + dispatch + assemble', x: 400, y: 80 },
    { id: 'w1', role: 'worker', label: 'Frontend Worker',  agent: 'frontend-architect', description: 'UI components + state', x: 120, y: 320 },
    { id: 'w2', role: 'worker', label: 'Backend Worker',   agent: 'backend-api',       description: 'API routes + data layer', x: 340, y: 320 },
    { id: 'w3', role: 'worker', label: 'Test Worker',      agent: 'test-engineer',     description: 'Test plan + execution', x: 560, y: 320 },
    { id: 'w4', role: 'worker', label: 'Docs Worker',      agent: 'doc-writer',        description: 'API + user docs', x: 780, y: 320 },
  ],
  edges: [
    { id: 'e1', source: 'leader', target: 'w1', label: 'subtask: UI' },
    { id: 'e2', source: 'leader', target: 'w2', label: 'subtask: API' },
    { id: 'e3', source: 'leader', target: 'w3', label: 'subtask: tests' },
    { id: 'e4', source: 'leader', target: 'w4', label: 'subtask: docs' },
    { id: 'e5', source: 'w1', target: 'leader', label: 'result' },
    { id: 'e6', source: 'w2', target: 'leader', label: 'result' },
    { id: 'e7', source: 'w3', target: 'leader', label: 'result' },
    { id: 'e8', source: 'w4', target: 'leader', label: 'result' },
  ],
};

// ---------- Specialist Router ----------
const SPECIALIST_ROUTER: PatternDef = {
  id: 'specialist-router',
  name: 'Specialist Router',
  tagline: 'Router classifies task, dispatches to one specialist.',
  description: 'A single router agent reads the incoming task and routes it to exactly one specialist based on task type. Best for triage and intent-based dispatch.',
  whenToUse: [
    'Helpdesk / triage bot (bug vs feature vs question)',
    'Ad-hoc code help (frontend vs backend vs devops)',
    'Single-message assistants with specialized outputs',
  ],
  nodes: [
    { id: 'router', role: 'router', label: 'Router',         agent: 'orchestrator',      description: 'Classify intent', x: 80,  y: 200 },
    { id: 's1', role: 'specialist', label: 'Frontend Expert', agent: 'frontend-architect', description: 'UI / React / CSS', x: 400, y: 80 },
    { id: 's2', role: 'specialist', label: 'Backend Expert',  agent: 'backend-api',       description: 'API / DB / services', x: 400, y: 200 },
    { id: 's3', role: 'specialist', label: 'DevOps Expert',   agent: 'devops-architect',  description: 'CI / CD / infra', x: 400, y: 320 },
    { id: 's4', role: 'specialist', label: 'Security Expert', agent: 'security-auditor',  description: 'Audit / vulns', x: 400, y: 440 },
  ],
  edges: [
    { id: 'e1', source: 'router', target: 's1', label: 'if frontend' },
    { id: 'e2', source: 'router', target: 's2', label: 'if backend' },
    { id: 'e3', source: 'router', target: 's3', label: 'if devops' },
    { id: 'e4', source: 'router', target: 's4', label: 'if security' },
  ],
};

export const PATTERNS: Record<PatternId, PatternDef> = {
  pipeline: PIPELINE,
  parallel: PARALLEL,
  'worker-leader': WORKER_LEADER,
  'specialist-router': SPECIALIST_ROUTER,
};

export const PATTERN_LIST = Object.values(PATTERNS);

export function getPattern(id: PatternId): PatternDef {
  return PATTERNS[id];
}
