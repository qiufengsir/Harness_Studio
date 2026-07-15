// ============================================================
// Loop Patterns — 4 canonical multi-agent orchestration patterns
// Each pattern defines:
//   - node template (roles + suggested agents)
//   - edge template (control flow)
//   - description of when to use it
// ============================================================

export type PatternId =
  | 'pipeline'
  | 'parallel'
  | 'worker-leader'
  | 'specialist-router'
  | 'peer-to-peer'
  | 'hierarchical';

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
  nameZh: string;
  tagline: string;
  taglineZh: string;
  description: string;
  descriptionZh: string;
  whenToUse: string[];
  whenToUseZh: string[];
  // Pre-populated graph
  nodes: PatternNode[];
  edges: PatternEdge[];
}

/** Helper: get localized text from a pattern definition */
export function patternText(p: PatternDef, lang: string) {
  return {
    name: lang === 'zh' ? p.nameZh : p.name,
    tagline: lang === 'zh' ? p.taglineZh : p.tagline,
    description: lang === 'zh' ? p.descriptionZh : p.description,
    whenToUse: lang === 'zh' ? p.whenToUseZh : p.whenToUse,
  };
}

// ---------- Pipeline ----------
const PIPELINE: PatternDef = {
  id: 'pipeline',
  name: 'Pipeline',
  nameZh: '流水线',
  tagline: 'Sequential stages, each hands off to the next.',
  taglineZh: '顺序执行，每个阶段将结果传递给下一个。',
  description: 'A linear chain where each agent processes the output of the previous one. Best for code review workflows where each stage has a single responsibility.',
  descriptionZh: '线性链式结构，每个 Agent 处理上一个 Agent 的输出。适合代码审查等每阶段单一职责的工作流。',
  whenToUse: [
    'PR review with multiple lenses (style → security → tests)',
    'Release workflow (build → test → deploy → verify)',
    'Bug fixing (reproduce → diagnose → patch → verify)',
  ],
  whenToUseZh: [
    '多视角 PR 审查（风格 → 安全 → 测试）',
    '发布流程（构建 → 测试 → 部署 → 验证）',
    'Bug 修复（复现 → 诊断 → 修补 → 验证）',
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
  nameZh: '并行',
  tagline: 'Multiple specialists run at once, then merge.',
  taglineZh: '多个专家同时运行，最后合并结果。',
  description: 'All agents work on the same input simultaneously. The merge step aggregates their findings. Best when dimensions are independent and speed matters.',
  descriptionZh: '所有 Agent 同时处理相同输入，合并步骤聚合它们的发现。适合各维度独立且需要速度的场景。',
  whenToUse: [
    'Holistic PR review (security + style + perf + tests at once)',
    'Initial codebase audit (multiple lenses simultaneously)',
    'Design exploration (frontend + backend + data architects)',
  ],
  whenToUseZh: [
    '全面 PR 审查（安全 + 风格 + 性能 + 测试同时进行）',
    '初始代码库审计（多视角同时进行）',
    '设计探索（前端 + 后端 + 数据架构师并行）',
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
  nameZh: '主从模式',
  tagline: 'Leader splits task, workers execute, leader assembles.',
  taglineZh: '领导者拆分任务，工作者执行，领导者汇总。',
  description: 'An orchestrator agent decomposes a complex task into subtasks, dispatches them to specialist workers, then synthesizes the results. Best for large features spanning multiple domains.',
  descriptionZh: '编排 Agent 将复杂任务分解为子任务，分派给专家工作者执行，然后综合结果。适合跨多个领域的大型功能开发。',
  whenToUse: [
    'Building a feature requiring frontend + backend + tests + docs',
    'Large refactor across multiple modules',
    'Migrating a service (schema + code + deploy + monitor)',
  ],
  whenToUseZh: [
    '构建需要前端 + 后端 + 测试 + 文档的功能',
    '跨多个模块的大型重构',
    '迁移服务（数据库 + 代码 + 部署 + 监控）',
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
  nameZh: '专家路由',
  tagline: 'Router classifies task, dispatches to one specialist.',
  taglineZh: '路由器分类任务，分派给单个专家处理。',
  description: 'A single router agent reads the incoming task and routes it to exactly one specialist based on task type. Best for triage and intent-based dispatch.',
  descriptionZh: '单个路由 Agent 读取传入任务，根据任务类型将其路由到恰好一个专家。适合分流和基于意图的分派。',
  whenToUse: [
    'Helpdesk / triage bot (bug vs feature vs question)',
    'Ad-hoc code help (frontend vs backend vs devops)',
    'Single-message assistants with specialized outputs',
  ],
  whenToUseZh: [
    '客服 / 分流机器人（Bug vs 功能 vs 提问）',
    '临时代码帮助（前端 vs 后端 vs 运维）',
    '单消息助手，输出专业化结果',
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

// ---------- Peer-to-Peer ----------
const PEER_TO_PEER: PatternDef = {
  id: 'peer-to-peer',
  name: 'Peer-to-Peer',
  nameZh: '对等协作',
  tagline: 'Equal agents collaborate, no central leader.',
  taglineZh: '平等的 Agent 互相协作，没有中心领导者。',
  description: 'All agents are peers — each can request help from any other. Best for code review, pair programming, and exploratory work where no single agent should own control.',
  descriptionZh: '所有 Agent 地位平等 — 每个都可以向任何其他 Agent 请求帮助。适合代码审查、结对编程和探索性工作，不需要单一 Agent 控制全局。',
  whenToUse: [
    'Multi-perspective code review (architecture + security + perf peers)',
    'Pair programming on hard problems',
    'Exploratory design (peers challenge each other)',
  ],
  whenToUseZh: [
    '多视角代码审查（架构 + 安全 + 性能同伴）',
    '难题结对编程',
    '探索性设计（同伴互相质疑）',
  ],
  nodes: [
    { id: 'p1', role: 'reviewer',   label: 'Architecture Peer',  agent: 'arch-reviewer',   description: 'Design + structure', x: 200, y: 80 },
    { id: 'p2', role: 'security',   label: 'Security Peer',      agent: 'security-auditor', description: 'Vulns + threats', x: 560, y: 80 },
    { id: 'p3', role: 'tester',     label: 'Test Peer',          agent: 'test-engineer',   description: 'Coverage + edge cases', x: 200, y: 320 },
    { id: 'p4', role: 'reviewer',   label: 'Performance Peer',   agent: 'perf-reviewer',   description: 'Latency + memory', x: 560, y: 320 },
  ],
  edges: [
    { id: 'e1', source: 'p1', target: 'p2', label: 'consult' },
    { id: 'e2', source: 'p2', target: 'p1', label: 'reply' },
    { id: 'e3', source: 'p1', target: 'p3', label: 'consult' },
    { id: 'e4', source: 'p3', target: 'p1', label: 'reply' },
    { id: 'e5', source: 'p2', target: 'p4', label: 'consult' },
    { id: 'e6', source: 'p4', target: 'p2', label: 'reply' },
    { id: 'e7', source: 'p3', target: 'p4', label: 'consult' },
    { id: 'e8', source: 'p4', target: 'p3', label: 'reply' },
  ],
};

// ---------- Hierarchical ----------
const HIERARCHICAL: PatternDef = {
  id: 'hierarchical',
  name: 'Hierarchical',
  nameZh: '层级树',
  tagline: 'Multi-level tree: top leader → mid leads → workers.',
  taglineZh: '多层级树：顶层领导 → 中层主管 → 基层工作者。',
  description: 'A tree structure where a top-level leader dispatches to mid-level team leads, who each manage their own workers. Best for large enterprise projects with multiple teams.',
  descriptionZh: '树形结构，顶层领导分派给中层团队主管，每个主管管理自己的工作者。适合有多个团队的大型企业项目。',
  whenToUse: [
    'Enterprise project with frontend + backend + infra teams',
    'Monorepo with multiple packages, each with its own lead',
    'Migration involving org-wide coordinated changes',
  ],
  whenToUseZh: [
    '企业级项目，含前端 + 后端 + 基础设施团队',
    'Monorepo 多包项目，每个包有自己的负责人',
    '涉及全组织协调的迁移',
  ],
  nodes: [
    { id: 'root', role: 'leader', label: 'Project Lead',     agent: 'orchestrator',     description: 'Top-level plan + cross-team coordination', x: 440, y: 40 },
    { id: 'fe-lead', role: 'leader', label: 'Frontend Lead', agent: 'frontend-lead',   description: 'Owns frontend team', x: 160, y: 200 },
    { id: 'be-lead', role: 'leader', label: 'Backend Lead',  agent: 'backend-lead',    description: 'Owns backend team', x: 440, y: 200 },
    { id: 'ops-lead', role: 'leader', label: 'DevOps Lead',  agent: 'devops-lead',     description: 'Owns infra team', x: 720, y: 200 },
    { id: 'fe-w1', role: 'worker', label: 'UI Engineer',     agent: 'frontend-architect', description: 'Components + state', x: 80,  y: 380 },
    { id: 'fe-w2', role: 'worker', label: 'Styling Engineer', agent: 'css-engineer',    description: 'CSS + design system', x: 240, y: 380 },
    { id: 'be-w1', role: 'worker', label: 'API Engineer',    agent: 'backend-api',     description: 'Routes + handlers', x: 360, y: 380 },
    { id: 'be-w2', role: 'worker', label: 'DB Engineer',     agent: 'db-engineer',     description: 'Schema + queries', x: 520, y: 380 },
    { id: 'ops-w1', role: 'worker', label: 'CI Engineer',    agent: 'ci-engineer',     description: 'Pipelines + tests', x: 640, y: 380 },
    { id: 'ops-w2', role: 'worker', label: 'Deploy Engineer', agent: 'deploy-engineer', description: 'Releases + rollback', x: 800, y: 380 },
  ],
  edges: [
    { id: 'e1', source: 'root', target: 'fe-lead', label: 'frontend goals' },
    { id: 'e2', source: 'root', target: 'be-lead', label: 'backend goals' },
    { id: 'e3', source: 'root', target: 'ops-lead', label: 'infra goals' },
    { id: 'e4', source: 'fe-lead', target: 'fe-w1', label: 'task' },
    { id: 'e5', source: 'fe-lead', target: 'fe-w2', label: 'task' },
    { id: 'e6', source: 'be-lead', target: 'be-w1', label: 'task' },
    { id: 'e7', source: 'be-lead', target: 'be-w2', label: 'task' },
    { id: 'e8', source: 'ops-lead', target: 'ops-w1', label: 'task' },
    { id: 'e9', source: 'ops-lead', target: 'ops-w2', label: 'task' },
    // Results bubble back up
    { id: 'e10', source: 'fe-w1', target: 'fe-lead', label: 'result' },
    { id: 'e11', source: 'fe-w2', target: 'fe-lead', label: 'result' },
    { id: 'e12', source: 'be-w1', target: 'be-lead', label: 'result' },
    { id: 'e13', source: 'be-w2', target: 'be-lead', label: 'result' },
    { id: 'e14', source: 'ops-w1', target: 'ops-lead', label: 'result' },
    { id: 'e15', source: 'ops-w2', target: 'ops-lead', label: 'result' },
    { id: 'e16', source: 'fe-lead', target: 'root', label: 'team result' },
    { id: 'e17', source: 'be-lead', target: 'root', label: 'team result' },
    { id: 'e18', source: 'ops-lead', target: 'root', label: 'team result' },
  ],
};

export const PATTERNS: Record<PatternId, PatternDef> = {
  pipeline: PIPELINE,
  parallel: PARALLEL,
  'worker-leader': WORKER_LEADER,
  'specialist-router': SPECIALIST_ROUTER,
  'peer-to-peer': PEER_TO_PEER,
  hierarchical: HIERARCHICAL,
};

export const PATTERN_LIST = Object.values(PATTERNS);

export function getPattern(id: PatternId): PatternDef {
  return PATTERNS[id] ?? PATTERNS.pipeline;
}
