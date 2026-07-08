// ============================================================
// Loop Compiler — turn a visual graph into platform configs
// Supports: AGENTS.md, Claude Code, Cursor, GitHub Copilot, TRAE,
//           Cline/Roo Code, Windsurf, Aider
// ============================================================
import { PatternId } from './patterns';

export interface LoopNodeData {
  id: string;
  role: string;
  label: string;
  agent: string;
  description: string;
  systemPrompt?: string;
}

export interface LoopGraph {
  nodes: LoopNodeData[];
  edges: { id: string; source: string; target: string; label?: string }[];
}

export interface CompileTarget {
  platform: string;
  files: { path: string; content: string }[];
}

// ---------- AGENTS.md (cross-IDE standard, pure markdown) ----------
function compileAgentsMd(name: string, pattern: PatternId, graph: LoopGraph): string {
  const lines: string[] = [];
  lines.push(`# ${name}`);
  lines.push('');
  lines.push('## Multi-Agent Loop');
  lines.push('');
  lines.push(`**Pattern:** ${pattern}`);
  lines.push('');
  lines.push('This project uses a multi-agent loop orchestrated by Harness Studio.');
  lines.push('Agents should coordinate as follows:');
  lines.push('');
  lines.push('### Agents');
  for (const n of graph.nodes) {
    lines.push(`#### ${n.label}`);
    lines.push(`- Role: ${n.role}`);
    lines.push(`- Agent: ${n.agent}`);
    lines.push(`- Description: ${n.description}`);
    if (n.systemPrompt) {
      lines.push('- System prompt:');
      lines.push('```');
      lines.push(n.systemPrompt);
      lines.push('```');
    }
    lines.push('');
  }
  lines.push('### Control Flow');
  for (const e of graph.edges) {
    const src = graph.nodes.find((n) => n.id === e.source);
    const tgt = graph.nodes.find((n) => n.id === e.target);
    lines.push(`- ${src?.label} → ${tgt?.label}${e.label ? ` (${e.label})` : ''}`);
  }
  lines.push('');
  return lines.join('\n');
}

// ---------- Claude Code: .claude/ directory ----------
function compileClaude(name: string, pattern: PatternId, graph: LoopGraph): CompileTarget['files'] {
  const files: CompileTarget['files'] = [];

  // CLAUDE.md
  files.push({
    path: '.claude/CLAUDE.md',
    content: `# ${name}\n\n## Multi-Agent Orchestration\n\nThis project uses a **${pattern}** loop. See \`subagents/\` for agent definitions.\n\n## Coordination Rules\n${graph.edges.map((e) => {
      const s = graph.nodes.find((n) => n.id === e.source);
      const t = graph.nodes.find((n) => n.id === e.target);
      return `- ${s?.label} hands off to ${t?.label}${e.label ? ` when ${e.label}` : ''}`;
    }).join('\n')}\n`,
  });

  // subagents/*.md (YAML frontmatter + markdown body)
  for (const n of graph.nodes) {
    const fm = [
      '---',
      `name: ${n.agent}`,
      `description: ${n.description}`,
      `tools: Read, Write, Edit, Bash, Grep`, // sensible defaults
      '---',
      '',
    ].join('\n');
    const body = n.systemPrompt ?? `You are the ${n.label} agent.\n\nRole: ${n.role}\nDescription: ${n.description}\n\nWhen invoked, perform your specialized task and hand off to the next agent in the loop.`;
    files.push({
      path: `.claude/subagents/${n.agent}.md`,
      content: fm + body,
    });
  }

  // hooks/settings.json — wire up the orchestration
  files.push({
    path: '.claude/settings.json',
    content: JSON.stringify({
      hooks: {
        PostToolUse: graph.edges.map((e) => {
          const s = graph.nodes.find((n) => n.id === e.source);
          const t = graph.nodes.find((n) => n.id === e.target);
          return {
            matcher: s?.agent,
            command: `echo "Hand-off: ${s?.label} → ${t?.label}${e.label ? ` (${e.label})` : ''}"`,
          };
        }),
      },
    }, null, 2),
  });

  return files;
}

// ---------- Cursor: .cursor/rules/*.mdc ----------
function compileCursor(name: string, pattern: PatternId, graph: LoopGraph): CompileTarget['files'] {
  const files: CompileTarget['files'] = [];

  // Top-level orchestration rule (always applied)
  files.push({
    path: '.cursor/rules/orchestration.mdc',
    content: `---
description: Multi-agent ${pattern} orchestration for ${name}
alwaysApply: true
globs: ["**/*"]
---

# Multi-Agent Loop: ${name}

Pattern: **${pattern}**

## Agents in this loop
${graph.nodes.map((n) => `- **${n.label}** (${n.agent}): ${n.description}`).join('\n')}

## Control flow
${graph.edges.map((e) => {
  const s = graph.nodes.find((n) => n.id === e.source);
  const t = graph.nodes.find((n) => n.id === e.target);
  return `1. ${s?.label} → ${t?.label}${e.label ? ` (${e.label})` : ''}`;
}).join('\n')}

When working on a task, identify which agent role matches and follow its specialization.
`,
  });

  // Per-agent rule with glob matchers
  for (const n of graph.nodes) {
    const globs = roleGlobs(n.role, n.agent);
    files.push({
      path: `.cursor/rules/agent-${n.agent}.mdc`,
      content: `---
description: ${n.description}
alwaysApply: false
globs: ${JSON.stringify(globs)}
---

# ${n.label}

${n.systemPrompt ?? `You are the ${n.label} agent. Role: ${n.role}.`}

When editing files matching ${globs.join(', ')}, apply this agent's perspective and standards.
`,
    });
  }

  return files;
}

// ---------- GitHub Copilot: .github/copilot-instructions.md + instructions/*.md ----------
function compileCopilot(name: string, pattern: PatternId, graph: LoopGraph): CompileTarget['files'] {
  const files: CompileTarget['files'] = [];
  files.push({
    path: '.github/copilot-instructions.md',
    content: `# ${name} — AI Coordination\n\nThis project uses a **${pattern}** multi-agent loop.\n\n## Agents\n${graph.nodes.map((n) => `- **${n.label}** (${n.role}): ${n.description}`).join('\n')}\n\n## Flow\n${graph.edges.map((e) => { const s = graph.nodes.find((n) => n.id === e.source); const t = graph.nodes.find((n) => n.id === e.target); return `- ${s?.label} → ${t?.label}${e.label ? ` if ${e.label}` : ''}`; }).join('\n')}\n`,
  });
  for (const n of graph.nodes) {
    files.push({
      path: `.github/instructions/${n.agent}.instructions.md`,
      content: `---\napplyTo: ${JSON.stringify(roleGlobs(n.role, n.agent))}\n---\n\n# ${n.label}\n\n${n.systemPrompt ?? `Role: ${n.role}. ${n.description}`}\n`,
    });
  }
  return files;
}

// ---------- TRAE IDE: .trae/ ----------
function compileTrae(name: string, pattern: PatternId, graph: LoopGraph): CompileTarget['files'] {
  const files: CompileTarget['files'] = [];
  files.push({
    path: '.trae/project_rules.md',
    content: `# ${name}\n\n## Multi-Agent Loop (${pattern})\n\n${graph.nodes.map((n) => `### ${n.label}\n- Role: ${n.role}\n- Description: ${n.description}`).join('\n\n')}\n\n## Coordination\n${graph.edges.map((e) => { const s = graph.nodes.find((n) => n.id === e.source); const t = graph.nodes.find((n) => n.id === e.target); return `- ${s?.label} → ${t?.label}${e.label ? ` (${e.label})` : ''}`; }).join('\n')}\n`,
  });
  for (const n of graph.nodes) {
    files.push({
      path: `.trae/skills/${n.agent}/SKILL.md`,
      content: `---\nname: ${n.agent}\ndescription: ${n.description}\n---\n\n# ${n.label}\n\n## When to use\n- When the task involves: ${n.description.toLowerCase()}\n\n## Steps\n1. Identify the task scope\n2. Apply ${n.role} perspective\n3. Produce output and signal hand-off\n\n${n.systemPrompt ?? ''}\n`,
    });
  }
  files.push({
    path: '.trae/mcp.json',
    content: JSON.stringify({
      mcpServers: {
        'harness-orchestrator': {
          command: 'npx',
          args: ['-y', '@harness-studio/orchestrator'],
          env: { LOOP_PATTERN: pattern },
        },
      },
    }, null, 2),
  });
  // Also drop an AGENTS.md at root for cross-IDE compat
  files.push({ path: 'AGENTS.md', content: compileAgentsMd(name, pattern, graph) });
  return files;
}

// ---------- Cline / Roo Code: .clinerules/ + .roomodes ----------
function compileCline(name: string, pattern: PatternId, graph: LoopGraph): CompileTarget['files'] {
  const files: CompileTarget['files'] = [];
  for (const n of graph.nodes) {
    files.push({
      path: `.clinerules/${n.agent}.md`,
      content: `# ${n.label}\n\nRole: ${n.role}\nDescription: ${n.description}\n\n${n.systemPrompt ?? ''}\n`,
    });
  }
  files.push({
    path: '.roomodes',
    content: JSON.stringify({
      modes: graph.nodes.map((n) => ({
        slug: n.agent,
        name: n.label,
        roleDefinition: n.systemPrompt ?? `You are the ${n.label} agent. ${n.description}`,
        groups: ['read', 'edit', 'browser'],
      })),
      orchestration: { pattern, name },
    }, null, 2),
  });
  return files;
}

// ---------- Windsurf: .windsurf/rules/*.md ----------
function compileWindsurf(name: string, pattern: PatternId, graph: LoopGraph): CompileTarget['files'] {
  const files: CompileTarget['files'] = [];
  for (const n of graph.nodes) {
    files.push({
      path: `.windsurf/rules/agent-${n.agent}.md`,
      content: `---\ntrigger: ${n.role === 'leader' || n.role === 'router' ? 'always_on' : 'glob'}\nglobs: ${JSON.stringify(roleGlobs(n.role, n.agent))}\n---\n\n# ${n.label}\n\n${n.systemPrompt ?? `Role: ${n.role}. ${n.description}`}\n`,
    });
  }
  files.push({
    path: '.windsurf/rules/orchestration.md',
    content: `---\ntrigger: always_on\n---\n\n# Multi-Agent Loop: ${name} (${pattern})\n\n${graph.edges.map((e) => { const s = graph.nodes.find((n) => n.id === e.source); const t = graph.nodes.find((n) => n.id === e.target); return `- ${s?.label} → ${t?.label}${e.label ? ` (${e.label})` : ''}`; }).join('\n')}\n`,
  });
  return files;
}

// ---------- Aider: .aider.conf.yml + CONVENTIONS.md ----------
function compileAider(name: string, pattern: PatternId, graph: LoopGraph): CompileTarget['files'] {
  const files: CompileTarget['files'] = [];
  files.push({
    path: '.aider.conf.yml',
    content: `# ${name} — Aider config\nmodel: claude-3-5-sonnet\nauto-commits: false\nread:\n  - CONVENTIONS.md\n  - AGENTS.md\n`,
  });
  files.push({
    path: 'CONVENTIONS.md',
    content: compileAgentsMd(name, pattern, graph),
  });
  return files;
}

// ---------- CodeBuddy: .codebuddy/rules/ + project_rules.md ----------
function compileCodeBuddy(name: string, pattern: PatternId, graph: LoopGraph): CompileTarget['files'] {
  const files: CompileTarget['files'] = [];
  // 项目级规则文件
  files.push({
    path: '.codebuddy/project_rules.md',
    content: `# ${name}\n\n## Multi-Agent Loop (${pattern})\n\nThis project uses a multi-agent loop orchestrated by Harness Studio.\nAgents should coordinate as follows:\n\n### Agents\n${graph.nodes.map((n) => `- **${n.label}** (${n.role}): ${n.description}`).join('\n')}\n\n### Coordination\n${graph.edges.map((e) => { const s = graph.nodes.find((n) => n.id === e.source); const t = graph.nodes.find((n) => n.id === e.target); return `- ${s?.label} → ${t?.label}${e.label ? ` (${e.label})` : ''}`; }).join('\n')}\n`,
  });
  // 每个 Agent 的独立规则文件，带 glob 匹配
  for (const n of graph.nodes) {
    const globs = roleGlobs(n.role, n.agent);
    files.push({
      path: `.codebuddy/rules/${n.agent}.md`,
      content: `---\nname: ${n.label}\nrole: ${n.role}\nglobs: ${JSON.stringify(globs)}\n---\n\n# ${n.label}\n\n## Description\n${n.description}\n\n## Instructions\n${n.systemPrompt ?? `You are the ${n.label} agent. Role: ${n.role}. Focus on: ${n.description.toLowerCase()}. Produce output and signal hand-off to the next agent.`}\n`,
    });
  }
  // 根目录 AGENTS.md 保持跨 IDE 兼容
  files.push({ path: 'AGENTS.md', content: compileAgentsMd(name, pattern, graph) });
  return files;
}

// ---------- Helpers ----------

/**
 * Smart glob matcher — uses BOTH role and agent name to pick file globs.
 * P3 upgrade: instead of all workers getting a catch-all glob,
 * frontend workers get src globs, backend workers get server globs,
 * etc. Falls back to role-based defaults.
 */
function roleGlobs(role: string, agent?: string): string[] {
  const a = (agent ?? '').toLowerCase();

  // 1. Agent-name-based specific matches (highest priority)
  if (/frontend|frontend-architect|ui-|css-|react-|vue-|svelte/.test(a)) {
    return ['src/**/*.{tsx,jsx,ts,js,css,scss,vue,svelte}', 'app/**/*.{tsx,ts}', 'components/**/*.{tsx,ts}'];
  }
  if (/backend-?api|api-?engineer|server-/.test(a)) {
    return ['server/**/*.{go,py,ts,js,rs,java}', 'api/**/*.{ts,js,py,go}', 'src/server/**/*'];
  }
  if (/\bdb-|database|sql-/.test(a)) {
    return ['**/migrations/**', '**/*.sql', '**/schema/**', '**/prisma/**', '**/drizzle/**'];
  }
  if (/devops|ci-|deploy-|infra-/.test(a)) {
    return ['**/Dockerfile*', '**/docker-compose*', '.github/workflows/**', '**/k8s/**', '**/.gitlab-ci*', 'Makefile'];
  }
  if (/security|audit/.test(a)) {
    return ['**/auth/**', '**/api/**', '**/*.{ts,tsx,js,jsx,py,go,rs,java}', '**/secrets*', '**/.env*'];
  }
  if (/test-|tester|qa-/.test(a)) {
    return ['**/*.{test,spec}.{ts,tsx,js,jsx,py,go,rs,java}', '**/__tests__/**', '**/e2e/**', '**/tests/**'];
  }
  if (/doc-|writer|doc-?writer/.test(a)) {
    return ['**/*.md', '**/README*', '**/docs/**', '**/CHANGELOG*', '**/*.mdx'];
  }
  if (/perf-|performance/.test(a)) {
    return ['**/*.{ts,tsx,js,jsx,py,go}', '**/bench/**'];
  }
  if (/data-|etl-|pipeline-|ml-/.test(a)) {
    return ['**/pipelines/**', '**/etl/**', '**/dag/**', '**/models/**', '**/*.{ipynb,py}'];
  }
  if (/inventory|catalog|checkout|cart/.test(a)) {
    return ['**/inventory/**', '**/catalog/**', '**/checkout/**', '**/cart/**', '**/order*/**'];
  }
  if (/compliance|hipaa|pci|audit-/.test(a)) {
    return ['**/*.{ts,tsx,js,jsx,py,go,rs,java}', '**/audit*/**', '**/compliance/**'];
  }

  // 2. Role-based defaults
  const map: Record<string, string[]> = {
    reviewer: ['**/*.{ts,tsx,js,jsx,py,go,rs,java}'],
    security: ['**/auth/**', '**/api/**', '**/*.{ts,tsx,js,jsx,py,go,rs,java}'],
    tester: ['**/*.{test,spec}.{ts,tsx,js,jsx,py,go,rs,java}', '**/__tests__/**', '**/tests/**'],
    'doc-writer': ['**/*.md', '**/README*', '**/docs/**'],
    leader: ['**/*'],
    router: ['**/*'],
    worker: ['**/*'],
    specialist: ['**/*'],
    merge: ['**/*'],
  };
  return map[role] ?? ['**/*'];
}

// ---------- Main compile dispatcher ----------
const COMPILERS: Record<string, (name: string, p: PatternId, g: LoopGraph) => CompileTarget['files']> = {
  agents: (n, p, g) => [{ path: 'AGENTS.md', content: compileAgentsMd(n, p, g) }],
  claude: compileClaude,
  cursor: compileCursor,
  copilot: compileCopilot,
  trae: compileTrae,
  cline: compileCline,
  windsurf: compileWindsurf,
  aider: compileAider,
  codebuddy: compileCodeBuddy,
};

export function compileLoop(
  name: string,
  pattern: PatternId,
  graph: LoopGraph,
  targets: string[]
): CompileTarget[] {
  const out: CompileTarget[] = [];
  for (const t of targets) {
    const fn = COMPILERS[t];
    if (fn) {
      out.push({ platform: t, files: fn(name, pattern, graph) });
    }
  }
  return out;
}

export const ALL_PLATFORMS = Object.keys(COMPILERS);

// ---------- Platform metadata for UI guidance ----------
export interface PlatformInfo {
  id: string;
  label: string;
  labelZh: string;
  desc: string;
  descZh: string;
  category: 'ide' | 'cli' | 'standard';
  outputHint: string;
}

export const PLATFORM_INFO: Record<string, PlatformInfo> = {
  agents: {
    id: 'agents',
    label: 'AGENTS.md',
    labelZh: 'AGENTS.md',
    desc: 'Cross-IDE standard. A single markdown file any AI tool can read.',
    descZh: '跨 IDE 通用标准。一个 Markdown 文件，所有 AI 工具均可读取。',
    category: 'standard',
    outputHint: 'AGENTS.md',
  },
  claude: {
    id: 'claude',
    label: 'Claude Code',
    labelZh: 'Claude Code',
    desc: 'Anthropic official CLI. Uses CLAUDE.md and per-agent subagents.',
    descZh: 'Anthropic 官方 CLI 工具。生成 CLAUDE.md 和子代理配置。',
    category: 'cli',
    outputHint: 'CLAUDE.md + .claude/agents/',
  },
  cursor: {
    id: 'cursor',
    label: 'Cursor',
    labelZh: 'Cursor',
    desc: 'AI-first IDE. Generates .cursor/rules with glob-based file matching.',
    descZh: 'AI 优先 IDE。生成 .cursor/rules，支持按文件类型匹配规则。',
    category: 'ide',
    outputHint: '.cursor/rules/*.mdc',
  },
  copilot: {
    id: 'copilot',
    label: 'GitHub Copilot',
    labelZh: 'GitHub Copilot',
    desc: 'GitHub coding assistant. Uses .github/copilot-instructions.md.',
    descZh: 'GitHub 编程助手。生成 .github/copilot-instructions.md。',
    category: 'ide',
    outputHint: '.github/copilot-instructions.md',
  },
  trae: {
    id: 'trae',
    label: 'TRAE',
    labelZh: 'TRAE',
    desc: 'ByteDance AI IDE. Generates .trae/project_rules and skills.',
    descZh: '字节跳动 AI IDE。生成 .trae/project_rules 和技能文件。',
    category: 'ide',
    outputHint: '.trae/project_rules.md + skills/',
  },
  cline: {
    id: 'cline',
    label: 'Cline / Roo Code',
    labelZh: 'Cline / Roo Code',
    desc: 'VS Code extension. Uses .clinerules and .roomodes.',
    descZh: 'VS Code 插件。生成 .clinerules 和 .roomodes 配置。',
    category: 'ide',
    outputHint: '.clinerules/ + .roomodes',
  },
  windsurf: {
    id: 'windsurf',
    label: 'Windsurf',
    labelZh: 'Windsurf',
    desc: 'Codeium AI IDE. Uses .windsurf/rules with glob triggers.',
    descZh: 'Codeium AI IDE。生成 .windsurf/rules，支持 glob 触发。',
    category: 'ide',
    outputHint: '.windsurf/rules/*.md',
  },
  aider: {
    id: 'aider',
    label: 'Aider',
    labelZh: 'Aider',
    desc: 'Terminal AI pair programmer. Uses .aider.conf.yml + CONVENTIONS.md.',
    descZh: '终端 AI 结对编程工具。生成 .aider.conf.yml 和 CONVENTIONS.md。',
    category: 'cli',
    outputHint: '.aider.conf.yml + CONVENTIONS.md',
  },
  codebuddy: {
    id: 'codebuddy',
    label: 'CodeBuddy',
    labelZh: 'CodeBuddy 腾讯云',
    desc: 'Tencent Cloud AI assistant. Uses .codebuddy/rules with glob matching.',
    descZh: '腾讯云 AI 编程助手。生成 .codebuddy/rules，支持 glob 匹配。',
    category: 'ide',
    outputHint: '.codebuddy/rules/*.md',
  },
};
