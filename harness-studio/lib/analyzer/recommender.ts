// ============================================================
// Recommender — turn detected issues into concrete config
// recommendations, each tied to a fixable problem.
// This is what makes Harness Studio not just "find issues" but
// "suggest the AI config that would have prevented them."
// ============================================================
import { Issue } from './detector';

export type RecKind = 'agent' | 'skill' | 'rule' | 'mcp' | 'loop';

export interface Recommendation {
  kind: RecKind;
  name: string;
  reason: string;
  severity: 'info' | 'warning' | 'critical';
  // Issue count that triggered this recommendation
  triggeredBy: number;
  // Concrete config payload (platform-agnostic, will be compiled later)
  payload: {
    description: string;
    // For agents: role + system prompt scaffold
    role?: string;
    systemPrompt?: string;
    // For skills: trigger conditions + steps
    triggers?: string[];
    steps?: string[];
    // For rules: globs + content
    globs?: string[];
    ruleContent?: string;
    // For mcp: server name
    mcpServer?: string;
    // For loops: pattern
    pattern?: 'pipeline' | 'parallel' | 'worker-leader' | 'specialist-router';
  };
  // Platforms this config should be exported to
  platforms: string[];
}

const PLATFORM_DEFAULTS = ['agents', 'claude', 'cursor', 'copilot', 'trae'];

// ---------- Recommendation templates ----------
const REC_TEMPLATES: Record<string, Omit<Recommendation, 'reason' | 'triggeredBy' | 'severity'>> = {
  'security-auditor': {
    kind: 'agent',
    name: 'security-auditor',
    platforms: PLATFORM_DEFAULTS,
    payload: {
      description: 'Reviews every PR for security issues: SQL injection, XSS, hardcoded secrets, insecure dependencies.',
      role: 'security-auditor',
      systemPrompt: `You are a security-auditor agent. Your job is to review code changes for security vulnerabilities.

Focus areas:
1. SQL injection — flag any string interpolation in queries
2. XSS — flag unescaped user input rendered as HTML
3. Hardcoded secrets — flag API keys, passwords, tokens in source
4. Insecure dependencies — flag known vulnerable packages
5. Auth/authorization — flag missing access control on sensitive endpoints

Output format:
- Severity: CRITICAL | HIGH | MEDIUM | LOW
- File:line
- Issue
- Suggested fix

Block PRs with CRITICAL or HIGH issues.`,
    },
  },
  'test-engineer': {
    kind: 'agent',
    name: 'test-engineer',
    platforms: PLATFORM_DEFAULTS,
    payload: {
      description: 'Generates and maintains tests. Flags functions without coverage. Suggests edge cases.',
      role: 'test-engineer',
      systemPrompt: `You are a test-engineer agent. Your job is to ensure code is well-tested.

Responsibilities:
1. For every new function, suggest unit tests covering happy path + 2 edge cases
2. For every API endpoint, suggest integration tests
3. Flag any source file without a corresponding test file
4. Track coverage trends and warn when coverage drops

Testing strategy:
- Pure functions → unit tests
- API routes → integration tests with mocked DB
- Critical user flows → E2E tests (Playwright)

Output: test file path + test cases when asked.`,
    },
  },
  'doc-writer': {
    kind: 'agent',
    name: 'doc-writer',
    platforms: PLATFORM_DEFAULTS,
    payload: {
      description: 'Scaffolds and maintains README, CONTRIBUTING, API docs, architecture decisions.',
      role: 'doc-writer',
      systemPrompt: `You are a doc-writer agent. Keep project documentation in sync with code.

Triggers:
- New directory created → suggest adding a README
- Public API changed → update API docs
- New architectural decision → suggest ADR
- README refers to outdated setup → flag it

Always write docs that match the code, not aspirational docs.`,
    },
  },
  'code-reviewer': {
    kind: 'agent',
    name: 'code-reviewer',
    platforms: PLATFORM_DEFAULTS,
    payload: {
      description: 'Reviews PRs for style, complexity, duplication, and best practices.',
      role: 'code-reviewer',
      systemPrompt: `You are a code-reviewer agent. Review every PR with these lenses:
1. Style consistency (naming, formatting, imports)
2. Complexity (cyclomatic, cognitive)
3. Duplication (DRY violations)
4. Best practices for the language/framework
5. Performance hotspots (N+1 queries, unnecessary re-renders)

Approve only when issues are addressed or explicitly waived.`,
    },
  },
  'typescript-strict-types': {
    kind: 'rule',
    name: 'typescript-strict-types',
    platforms: PLATFORM_DEFAULTS,
    payload: {
      description: 'Enforces strict TypeScript: no any, prefer unknown, exhaustive type checks.',
      globs: ['**/*.ts', '**/*.tsx'],
      ruleContent: `# TypeScript Strict Types

When writing TypeScript:

## Forbidden
- Never use \`any\` — use \`unknown\` if type is truly unknown
- Never use \`as any\` or \`@ts-ignore\` without a comment explaining why

## Required
- All function parameters and returns must be typed
- Use discriminated unions for state machines
- Use \`satisfies\` operator for type checking without widening
- Enable \`strict: true\` in tsconfig.json
- Prefer \`type\` for unions/intersections, \`interface\` for object shapes that may be extended

## Patterns
- Branded types for IDs: \`type UserId = string & { __brand: 'UserId' }\`
- Result type for operations that can fail: \`type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }\``,
    },
  },
  'react-hooks-best-practices': {
    kind: 'rule',
    name: 'react-hooks-best-practices',
    platforms: PLATFORM_DEFAULTS,
    payload: {
      description: 'Enforces React hooks best practices: cleanup, dependency array, custom hook extraction.',
      globs: ['**/*.tsx', '**/*.jsx'],
      ruleContent: `# React Hooks Best Practices

## useEffect cleanup
Every useEffect that sets up:
- Event listeners → must return removeEventListener
- setInterval/setTimeout → must return clearInterval/clearTimeout
- Subscriptions → must return unsubscribe
- Observers → must return disconnect

## Dependency array
- Always include all reactive dependencies
- If you intentionally omit, add an eslint-disable comment with reason
- Prefer useEvent/useCallback for stable references

## Custom hooks
- Extract complex effects into named hooks (useXxx)
- Hooks should return typed values, not any
- Hooks with side effects should accept a cleanup signal`,
    },
  },
  'no-console-in-production': {
    kind: 'rule',
    name: 'no-console-in-production',
    platforms: PLATFORM_DEFAULTS,
    payload: {
      description: 'Forbids console.log in production code; suggests structured logger.',
      globs: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
      ruleContent: `# No Console in Production

## Forbidden in src/** (except scripts/, tests/)
- console.log
- console.debug
- console.info

## Allowed
- console.warn (sparingly, for recoverable issues)
- console.error (for caught errors before rethrow)

## Use instead
A structured logger:
\`\`\`ts
import { logger } from '@/lib/logger';
logger.info('user.created', { userId });
logger.error('payment.failed', { orderId, reason });
\`\`\`

The logger routes to:
- dev → stdout
- prod → structured JSON to log aggregator`,
    },
  },
  'async-error-handling': {
    kind: 'rule',
    name: 'async-error-handling',
    platforms: PLATFORM_DEFAULTS,
    payload: {
      description: 'Requires try/catch around async I/O operations.',
      globs: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
      ruleContent: `# Async Error Handling

All async I/O operations (fetch, DB, filesystem, external APIs) must be wrapped in try/catch.

## Pattern
\`\`\`ts
async function fetchUser(id: string): Promise<Result<User, ApiError>> {
  try {
    const res = await fetch(\`/api/users/\${id}\`);
    if (!res.ok) return { ok: false, error: { code: res.status, message: res.statusText } };
    const user = await res.json();
    return { ok: true, value: user };
  } catch (e) {
    return { ok: false, error: { code: 'NETWORK', message: (e as Error).message } };
  }
}
\`\`\`

Never let unhandled promise rejections reach production.`,
    },
  },
  'pr-review-pipeline': {
    kind: 'loop',
    name: 'PR Review Pipeline',
    platforms: PLATFORM_DEFAULTS,
    payload: {
      description: 'Sequential pipeline: code-reviewer → security-auditor → test-engineer → doc-writer.',
      pattern: 'pipeline',
    },
  },
};

// ---------- Build recommendations from issues ----------
export function recommendFromIssues(issues: Issue[]): Recommendation[] {
  const byFix = new Map<string, Issue[]>();
  for (const iss of issues) {
    const key = iss.fixName;
    if (!byFix.has(key)) byFix.set(key, []);
    byFix.get(key)!.push(iss);
  }

  const recs: Recommendation[] = [];
  for (const [fixName, issList] of byFix) {
    const tmpl = REC_TEMPLATES[fixName];
    if (!tmpl) continue;

    // Compose reason from issue details
    const sampleFiles = Array.from(new Set(issList.slice(0, 3).map((i) => i.file)));
    const severity = issList.reduce((s, i) => {
      const order = { critical: 0, warning: 1, info: 2 } as const;
      return order[i.severity] < order[s] ? i.severity : s;
    }, 'info' as 'info' | 'warning' | 'critical');

    recs.push({
      ...tmpl,
      reason: `Found ${issList.length} issue${issList.length === 1 ? '' : 's'} this config would fix. Sample: ${issList[0].detail} (${sampleFiles.join(', ')})`,
      severity,
      triggeredBy: issList.length,
    });
  }

  // Sort by triggered count desc — most impactful first
  return recs.sort((a, b) => b.triggeredBy - a.triggeredBy);
}

// ---------- Add a default PR pipeline loop if there are critical issues ----------
export function maybeAddPipelineLoop(recs: Recommendation[], issues: Issue[]): Recommendation[] {
  const hasCritical = issues.some((i) => i.severity === 'critical');
  const hasPipeline = recs.some((r) => r.kind === 'loop');
  if (hasCritical && !hasPipeline) {
    recs.push({
      ...REC_TEMPLATES['pr-review-pipeline'],
      reason: 'Critical issues detected. Recommend a PR review pipeline that runs security + test + doc agents sequentially before merge.',
      severity: 'critical',
      triggeredBy: issues.filter((i) => i.severity === 'critical').length,
    });
  }
  return recs;
}
