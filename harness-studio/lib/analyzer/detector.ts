// ============================================================
// Issue Detectors — the heart of reverse engineering
// Each detector finds a real, fixable problem in the codebase
// and tags it with the config that would prevent it.
// ============================================================
import { ParsedFile } from './parser';

export type IssueSeverity = 'info' | 'warning' | 'critical';

export interface Issue {
  rule: string;
  severity: IssueSeverity;
  file: string;
  line: number;
  detail: string;
  // What kind of config would fix this
  fixKind: 'agent' | 'skill' | 'rule' | 'mcp' | 'loop';
  fixName: string;
  fixDescription: string;
}

export type Detector = (files: ParsedFile[]) => Issue[];

// ---------- Detector: TypeScript `any` usage ----------
export const detectAnyType: Detector = (files) => {
  const issues: Issue[] = [];
  for (const f of files) {
    if (f.language !== 'TypeScript') continue;
    const lines = f.content.split('\n');
    lines.forEach((line, i) => {
      // Skip comments and strings
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      // Match : any or <any> or as any
      if (/:\s*any\b|<any>|as\s+any\b/.test(line)) {
        issues.push({
          rule: 'no-explicit-any',
          severity: 'warning',
          file: f.path,
          line: i + 1,
          detail: 'Explicit `any` breaks type safety. Use `unknown` or a proper type.',
          fixKind: 'rule',
          fixName: 'typescript-strict-types',
          fixDescription: 'Add a Cursor/Copilot rule enforcing no-explicit-any with auto-fix suggestions.',
        });
      }
    });
  }
  return issues;
};

// ---------- Detector: React useEffect without cleanup ----------
export const detectEffectCleanup: Detector = (files) => {
  const issues: Issue[] = [];
  for (const f of files) {
    if (!['TypeScript', 'JavaScript'].includes(f.language ?? '')) continue;
    if (!/\.(tsx|jsx)$/.test(f.path)) continue;
    const lines = f.content.split('\n');
    let inEffect = false;
    let effectStart = -1;
    let hasReturn = false;
    let braceDepth = 0;
    lines.forEach((line, i) => {
      const effectMatch = line.match(/useEffect\s*\(/);
      if (effectMatch && !inEffect) {
        inEffect = true;
        effectStart = i;
        hasReturn = false;
        braceDepth = 0;
      }
      if (inEffect) {
        braceDepth += (line.match(/\{/g) ?? []).length;
        braceDepth -= (line.match(/\}/g) ?? []).length;
        if (/return\s/.test(line) && !/return\s*\{/.test(line)) hasReturn = true;
        if (braceDepth <= 0 && i > effectStart) {
          // Effect ended. Check if it had a return cleanup
          // Heuristic: if effect sets up listener/interval/timeout without return
          const effectBlock = lines.slice(effectStart, i + 1).join('\n');
          const hasSideEffect = /(addEventListener|setInterval|setTimeout|subscribe|new\s+(WebSocket|MutationObserver))/.test(effectBlock);
          if (hasSideEffect && !hasReturn) {
            issues.push({
              rule: 'react-effect-cleanup',
              severity: 'critical',
              file: f.path,
              line: effectStart + 1,
              detail: 'useEffect sets up a subscription/timer but has no cleanup function. Will leak.',
              fixKind: 'rule',
              fixName: 'react-hooks-best-practices',
              fixDescription: 'Rule enforcing useEffect cleanup for subscriptions, timers, and observers.',
            });
          }
          inEffect = false;
        }
      }
    });
  }
  return issues;
};

// ---------- Detector: Missing tests ----------
export const detectMissingTests: Detector = (files) => {
  const issues: Issue[] = [];
  const testFiles = new Set(
    files
      .filter((f) => /\.(test|spec)\.(ts|tsx|js|jsx|py|go|rs)$/.test(f.path) || f.path.includes('/__tests__/'))
      .map((f) => f.path)
  );
  const srcFiles = files.filter(
    (f) =>
      ['TypeScript', 'JavaScript', 'Python', 'Go', 'Rust'].includes(f.language ?? '') &&
      !/\.(test|spec)\./.test(f.path) &&
      !f.path.includes('/__tests__/') &&
      !f.path.includes('node_modules') &&
      !/\.(d\.ts|config|stories)\./.test(f.path) &&
      !['package.json', 'tsconfig.json'].includes(f.path.split('/').pop() ?? '')
  );
  const ratio = srcFiles.length === 0 ? 1 : testFiles.size / srcFiles.length;
  if (ratio < 0.2 && srcFiles.length > 5) {
    issues.push({
      rule: 'low-test-coverage',
      severity: 'critical',
      file: '(project-wide)',
      line: 0,
      detail: `Only ${testFiles.size} test files for ${srcFiles.length} source files (${(ratio * 100).toFixed(0)}% ratio). Recommend >20%.`,
      fixKind: 'agent',
      fixName: 'test-engineer',
      fixDescription: 'A test-engineer subagent that proactively generates tests for new functions and reminds on missing coverage.',
    });
  }
  return issues;
};

// ---------- Detector: Hardcoded secrets ----------
export const detectHardcodedSecrets: Detector = (files) => {
  const issues: Issue[] = [];
  const patterns: { re: RegExp; name: string }[] = [
    { re: /(sk-[a-zA-Z0-9]{20,})/, name: 'OpenAI API key' },
    { re: /(AKIA[0-9A-Z]{16})/, name: 'AWS Access Key' },
    { re: /(ghp_[a-zA-Z0-9]{36})/, name: 'GitHub PAT' },
    { re: /(password\s*[:=]\s*["'][^"']{6,}["'])/i, name: 'Hardcoded password' },
    { re: /(api[_-]?key\s*[:=]\s*["'][^"']{10,}["'])/i, name: 'Hardcoded API key' },
    { re: /(mongodb(\+srv)?:\/\/[^\s"']+:[^\s"']+@)/i, name: 'MongoDB connection with credentials' },
  ];
  for (const f of files) {
    if (/\.(env|key|pem|cert)$/i.test(f.path)) continue;
    const lines = f.content.split('\n');
    lines.forEach((line, i) => {
      for (const { re, name } of patterns) {
        if (re.test(line)) {
          issues.push({
            rule: 'hardcoded-secret',
            severity: 'critical',
            file: f.path,
            line: i + 1,
            detail: `Possible ${name} hardcoded in source. Move to environment variables.`,
            fixKind: 'agent',
            fixName: 'security-auditor',
            fixDescription: 'security-auditor agent that scans diffs for secrets before PR merge.',
          });
          break;
        }
      }
    });
  }
  return issues;
};

// ---------- Detector: console.log left in production code ----------
export const detectConsoleLog: Detector = (files) => {
  const issues: Issue[] = [];
  for (const f of files) {
    if (!['TypeScript', 'JavaScript'].includes(f.language ?? '')) continue;
    if (/\.(test|spec)\./.test(f.path)) continue;
    if (f.path.includes('scripts/') || f.path.includes('dev-only')) continue;
    const lines = f.content.split('\n');
    let count = 0;
    let firstLine = -1;
    lines.forEach((line, i) => {
      if (/console\.(log|debug|info)\s*\(/.test(line) && !/^\s*(\/\/|\*)/.test(line)) {
        count++;
        if (firstLine === -1) firstLine = i + 1;
      }
    });
    if (count > 3) {
      issues.push({
        rule: 'console-log-pollution',
        severity: 'info',
        file: f.path,
        line: firstLine,
        detail: `${count} console.log statements in production code. Use a logger.`,
        fixKind: 'rule',
        fixName: 'no-console-in-production',
        fixDescription: 'Rule that flags console.log in non-dev files and suggests a structured logger.',
      });
    }
  }
  return issues;
};

// ---------- Detector: SQL injection risk ----------
export const detectSqlInjection: Detector = (files) => {
  const issues: Issue[] = [];
  for (const f of files) {
    const lang = f.language;
    if (!['TypeScript', 'JavaScript', 'Python', 'Java', 'PHP'].includes(lang ?? '')) continue;
    const lines = f.content.split('\n');
    lines.forEach((line, i) => {
      // String concatenation in SQL query
      if (/(execute|query)\s*\(\s*["'`].*(SELECT|INSERT|UPDATE|DELETE).*["'`]\s*\+/i.test(line) ||
          /(["'`].*(SELECT|INSERT|UPDATE|DELETE).*["'`]).*\$\{/i.test(line) ||
          /f["'].*\b(SELECT|INSERT|UPDATE|DELETE)\b.*\{/.test(line)) {
        issues.push({
          rule: 'sql-injection-risk',
          severity: 'critical',
          file: f.path,
          line: i + 1,
          detail: 'SQL query built with string interpolation/concatenation. Use parameterized queries.',
          fixKind: 'agent',
          fixName: 'security-auditor',
          fixDescription: 'security-auditor agent flagging unsafe SQL construction in code review.',
        });
      }
    });
  }
  return issues;
};

// ---------- Detector: Missing error handling ----------
export const detectMissingErrorHandling: Detector = (files) => {
  const issues: Issue[] = [];
  for (const f of files) {
    const lang = f.language;
    if (!['TypeScript', 'JavaScript'].includes(lang ?? '')) continue;
    const lines = f.content.split('\n');
    lines.forEach((line, i) => {
      // await without try/catch (heuristic: line has await but no try nearby)
      if (/\bawait\s+\w/.test(line) && !/try\s*\{/.test(line)) {
        // Look back 5 lines for try
        const ctx = lines.slice(Math.max(0, i - 5), i).join('\n');
        if (!/try\s*\{/.test(ctx)) {
          // Only flag async operations that can fail (fetch, db, etc.)
          if (/(fetch|axios|prisma|drizzle|mongoose|query|insert|update|delete|create|findMany|findUnique)/i.test(line)) {
            issues.push({
              rule: 'missing-error-handling',
              severity: 'warning',
              file: f.path,
              line: i + 1,
              detail: 'Async operation without try/catch. Errors will propagate as unhandled rejections.',
              fixKind: 'rule',
              fixName: 'async-error-handling',
              fixDescription: 'Rule enforcing try/catch around async I/O operations.',
            });
          }
        }
      }
    });
  }
  // Cap to avoid noise
  return issues.slice(0, 20);
};

// ---------- Detector: Missing README / docs ----------
export const detectMissingDocs: Detector = (files) => {
  const issues: Issue[] = [];
  const hasReadme = files.some((f) => /^readme\./i.test(f.path.split('/').pop() ?? ''));
  const hasContributing = files.some((f) => /contributing\./i.test(f.path.split('/').pop() ?? ''));
  if (!hasReadme && files.length > 5) {
    issues.push({
      rule: 'missing-readme',
      severity: 'warning',
      file: '(project root)',
      line: 0,
      detail: 'No README.md found. New team members and AI agents have no project context.',
      fixKind: 'agent',
      fixName: 'doc-writer',
      fixDescription: 'doc-writer agent that scaffolds README, CONTRIBUTING, and architecture docs.',
    });
  }
  if (!hasContributing && files.length > 20) {
    issues.push({
      rule: 'missing-contributing',
      severity: 'info',
      file: '(project root)',
      line: 0,
      detail: 'No CONTRIBUTING.md. Standards for PRs and commits are not codified.',
      fixKind: 'agent',
      fixName: 'doc-writer',
      fixDescription: 'doc-writer agent that generates CONTRIBUTING.md from team conventions.',
    });
  }
  return issues;
};

// ---------- Detector: Architecture patterns ----------
export const detectArchPatterns: Detector = (files) => {
  const issues: Issue[] = [];
  const paths = files.map((f) => f.path.toLowerCase());
  const patterns: { test: RegExp; name: string; fixName: string }[] = [
    { test: /\/components\/|\/pages\/|\/app\//, name: 'component-based', fixName: '' },
    { test: /\/controllers\/|\/views\/|\/models\//, name: 'mvc', fixName: '' },
    { test: /\/services\/|\/repositories\//, name: 'layered', fixName: '' },
    { test: /\/features\/|\/modules\//, name: 'feature-based', fixName: '' },
    { test: /\/packages\/|\/apps\//, name: 'monorepo', fixName: 'monorepo-coordination' },
  ];
  // We don't add issues here — patterns are returned separately
  return issues;
};

// ---------- Detector registry ----------
export const ALL_DETECTORS: { name: string; fn: Detector }[] = [
  { name: 'no-explicit-any', fn: detectAnyType },
  { name: 'react-effect-cleanup', fn: detectEffectCleanup },
  { name: 'low-test-coverage', fn: detectMissingTests },
  { name: 'hardcoded-secret', fn: detectHardcodedSecrets },
  { name: 'console-log-pollution', fn: detectConsoleLog },
  { name: 'sql-injection-risk', fn: detectSqlInjection },
  { name: 'missing-error-handling', fn: detectMissingErrorHandling },
  { name: 'missing-docs', fn: detectMissingDocs },
];

export function runAllDetectors(files: ParsedFile[]): Issue[] {
  const all: Issue[] = [];
  for (const d of ALL_DETECTORS) {
    try {
      all.push(...d.fn(files));
    } catch (e) {
      console.warn(`[detector:${d.name}] failed:`, (e as Error).message);
    }
  }
  // Sort by severity then file
  const order: Record<IssueSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return all.sort((a, b) => order[a.severity] - order[b.severity]);
}
