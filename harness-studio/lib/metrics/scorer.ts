// ============================================================
// Scorer — evaluate a code sample across 4 dimensions
// Returns per-rule pass/fail events + an aggregated score
// ============================================================
export interface ScoreRule {
  dimension: 'style' | 'security' | 'test' | 'arch';
  rule: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  check: (code: string, filePath: string) => { passed: boolean; detail?: string };
}

export interface ScoreEvent {
  rule: string;
  dimension: 'style' | 'security' | 'test' | 'arch';
  passed: boolean;
  severity: 'info' | 'warning' | 'critical';
  detail?: string;
}

export interface ScoreResult {
  events: ScoreEvent[];
  style: number;
  security: number;
  test: number;
  arch: number;
  overall: number;
  // Attribution: which configs contributed
  topContributors: { name: string; dimension: string; impact: number }[];
}

// ---------- Rule library ----------
export const SCORE_RULES: ScoreRule[] = [
  // ---- Style ----
  {
    dimension: 'style', rule: 'no-explicit-any', severity: 'warning',
    description: 'TypeScript: no explicit any',
    check: (code) => {
      const matches = code.match(/:\s*any\b|<any>|as\s+any\b/g);
      return matches && matches.length > 0
        ? { passed: false, detail: `${matches.length} explicit any` }
        : { passed: true };
    },
  },
  {
    dimension: 'style', rule: 'no-console-log', severity: 'info',
    description: 'No console.log in production code',
    check: (code) => {
      const m = code.match(/console\.(log|debug|info)\s*\(/g);
      return m && m.length > 2 ? { passed: false, detail: `${m.length} console calls` } : { passed: true };
    },
  },
  {
    dimension: 'style', rule: 'consistent-naming', severity: 'info',
    description: 'Functions use camelCase, classes PascalCase',
    check: (code, path) => {
      if (!/\.(ts|tsx|js|jsx)$/.test(path)) return { passed: true };
      // Look for PascalCase function declarations (should be classes)
      const bad = code.match(/function\s+([a-z][a-zA-Z]*)\s*\(/g);
      // Look for snake_case in JS
      const snake = code.match(/\bfunction\s+[a-z]+_[a-z]/g);
      return bad || snake ? { passed: false, detail: 'Inconsistent naming' } : { passed: true };
    },
  },
  {
    dimension: 'style', rule: 'imports-sorted', severity: 'info',
    description: 'Imports are sorted (alphabetical)',
    check: (code) => {
      const importLines = code.match(/^(import|from)\s.+$/gm);
      if (!importLines || importLines.length < 3) return { passed: true };
      const sorted = [...importLines].sort();
      return JSON.stringify(importLines) === JSON.stringify(sorted)
        ? { passed: true }
        : { passed: false, detail: 'Imports not sorted' };
    },
  },

  // ---- Security ----
  {
    dimension: 'security', rule: 'no-hardcoded-secrets', severity: 'critical',
    description: 'No hardcoded API keys / passwords',
    check: (code) => {
      const patterns = [
        /(sk-[a-zA-Z0-9]{20,})/, /(AKIA[0-9A-Z]{16})/, /(ghp_[a-zA-Z0-9]{36})/,
        /(password\s*[:=]\s*["'][^"']{6,}["'])/i, /(api[_-]?key\s*[:=]\s*["'][^"']{10,}["'])/i,
      ];
      for (const re of patterns) {
        if (re.test(code)) return { passed: false, detail: 'Possible secret detected' };
      }
      return { passed: true };
    },
  },
  {
    dimension: 'security', rule: 'no-sql-injection', severity: 'critical',
    description: 'No SQL string interpolation',
    check: (code) => {
      if (/(execute|query)\s*\(\s*["'`].*(SELECT|INSERT|UPDATE|DELETE).*["'`]\s*\+/i.test(code) ||
          /(["'`].*(SELECT|INSERT|UPDATE|DELETE).*["'`]).*\$\{/.test(code)) {
        return { passed: false, detail: 'SQL string interpolation' };
      }
      return { passed: true };
    },
  },
  {
    dimension: 'security', rule: 'no-eval', severity: 'critical',
    description: 'No eval() or Function() constructor',
    check: (code) => {
      if (/\beval\s*\(/.test(code) || /new\s+Function\s*\(/.test(code)) {
        return { passed: false, detail: 'eval/Function constructor used' };
      }
      return { passed: true };
    },
  },
  {
    dimension: 'security', rule: 'https-only', severity: 'warning',
    description: 'Use HTTPS, not HTTP, for external requests',
    check: (code) => {
      if (/http:\/\/(?!localhost|127\.0\.0\.1)/.test(code)) {
        return { passed: false, detail: 'HTTP URL used (should be HTTPS)' };
      }
      return { passed: true };
    },
  },

  // ---- Test ----
  {
    dimension: 'test', rule: 'has-error-handling', severity: 'warning',
    description: 'Async ops wrapped in try/catch',
    check: (code) => {
      const asyncOps = code.match(/\bawait\s+(fetch|axios|prisma|drizzle|mongoose)\./g);
      if (!asyncOps || asyncOps.length === 0) return { passed: true };
      const tryBlocks = code.match(/try\s*\{/g);
      return tryBlocks && tryBlocks.length >= asyncOps.length
        ? { passed: true }
        : { passed: false, detail: `${asyncOps.length} async ops without try/catch` };
    },
  },
  {
    dimension: 'test', rule: 'has-input-validation', severity: 'warning',
    description: 'Function validates inputs (zod/joi/types)',
    check: (code, path) => {
      if (!/\.(ts|tsx|js|jsx)$/.test(path)) return { passed: true };
      // Look for exported functions without validation
      const exports = code.match(/export\s+(async\s+)?function\s+\w+|export\s+const\s+\w+\s*=\s*(async\s+)?\(/g);
      if (!exports || exports.length === 0) return { passed: true };
      const hasZod = /zod|z\.object|z\.string|z\.number/.test(code);
      const hasValidation = /validate|parse|safeParse|schema\.validate/.test(code);
      return hasZod || hasValidation ? { passed: true } : { passed: false, detail: 'No input validation library' };
    },
  },
  {
    dimension: 'test', rule: 'has-return-types', severity: 'info',
    description: 'TypeScript: explicit return types on exports',
    check: (code, path) => {
      if (!/\.tsx?$/.test(path)) return { passed: true };
      const exports = code.match(/export\s+(async\s+)?function\s+\w+\s*\([^)]*\)\s*{/g);
      if (!exports || exports.length === 0) return { passed: true };
      const withTypes = code.match(/export\s+(async\s+)?function\s+\w+\s*\([^)]*\)\s*:\s*[A-Za-z<>\[\]\|]+/g);
      const ratio = withTypes ? withTypes.length / exports.length : 0;
      return ratio >= 0.5 ? { passed: true } : { passed: false, detail: `${(ratio * 100).toFixed(0)}% have return types` };
    },
  },

  // ---- Architecture ----
  {
    dimension: 'arch', rule: 'no-circular-deps', severity: 'warning',
    description: 'No circular imports (heuristic)',
    check: (code, path) => {
      // Can't truly detect without project context; check if file imports itself
      const selfName = path.split('/').pop()?.replace(/\.(ts|tsx|js|jsx)$/, '');
      if (selfName && new RegExp(`from\\s+['"].*${selfName}['"]`).test(code)) {
        return { passed: false, detail: 'File imports itself' };
      }
      return { passed: true };
    },
  },
  {
    dimension: 'arch', rule: 'single-responsibility', severity: 'info',
    description: 'File length < 400 lines',
    check: (code) => {
      const lines = code.split('\n').length;
      return lines < 400 ? { passed: true } : { passed: false, detail: `${lines} lines (recommend < 400)` };
    },
  },
  {
    dimension: 'arch', rule: 'no-deep-nesting', severity: 'warning',
    description: 'No deeply nested callbacks (>5 levels)',
    check: (code) => {
      let depth = 0; let max = 0;
      for (const ch of code) {
        if (ch === '{') { depth++; max = Math.max(max, depth); }
        if (ch === '}') depth--;
      }
      return max < 6 ? { passed: true } : { passed: false, detail: `Max nesting: ${max}` };
    },
  },
  {
    dimension: 'arch', rule: 'uses-type-safety', severity: 'warning',
    description: 'TypeScript: uses types/interfaces (not just any)',
    check: (code, path) => {
      if (!/\.tsx?$/.test(path)) return { passed: true };
      const hasTypes = /\b(type|interface)\s+\w+/.test(code);
      return hasTypes ? { passed: true } : { passed: false, detail: 'No type/interface declarations' };
    },
  },
];

// ---------- Score ----------
export function scoreCode(code: string, filePath: string): ScoreResult {
  const events: ScoreEvent[] = [];
  for (const rule of SCORE_RULES) {
    try {
      const result = rule.check(code, filePath);
      events.push({
        rule: rule.rule,
        dimension: rule.dimension,
        passed: result.passed,
        severity: rule.severity,
        detail: result.detail,
      });
    } catch (e) {
      // ignore failing rules
    }
  }

  // Compute dimension scores (0-100)
  const dimScore = (dim: 'style' | 'security' | 'test' | 'arch') => {
    const dimEvents = events.filter((e) => e.dimension === dim);
    if (dimEvents.length === 0) return 100;
    const weights: Record<string, number> = { critical: 25, warning: 10, info: 3 };
    let penalty = 0;
    for (const e of dimEvents) {
      if (!e.passed) penalty += weights[e.severity] ?? 5;
    }
    return Math.max(0, 100 - penalty);
  };

  const style = dimScore('style');
  const security = dimScore('security');
  const test = dimScore('test');
  const arch = dimScore('arch');
  // Weighted overall (security matters most)
  const overall = Math.round(style * 0.2 + security * 0.4 + test * 0.2 + arch * 0.2);

  // Top contributors — rules that failed most
  const failedByRule = new Map<string, number>();
  for (const e of events) {
    if (!e.passed) failedByRule.set(e.rule, (failedByRule.get(e.rule) ?? 0) + 1);
  }
  const topContributors = Array.from(failedByRule.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => {
      const rule = SCORE_RULES.find((r) => r.rule === name);
      return { name, dimension: rule?.dimension ?? 'style', impact: count };
    });

  return { events, style, security, test, arch, overall, topContributors };
}
