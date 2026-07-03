// ============================================================
// Project Context Parser — turns raw inputs into a structured
// ProjectContext that the LLM uses to generate specific agent
// instructions.
// Inputs: uploaded files (package.json, etc.) + free-text desc
// ============================================================
import type { ParsedFile } from '@/lib/analyzer/parser';

export interface ProjectContext {
  loopName: string;
  projectName: string;
  description: string;
  languages: string[];
  frameworks: string[];
  projectType: string;       // 'web-app' | 'api' | 'data-pipeline' | ...
  tools: string[];            // ['jest', 'eslint', 'docker', ...]
  deployTarget: string;       // 'k8s' | 'vercel' | 'server' | ''
  scale: string;              // 'single' | 'monorepo' | 'microservices'
  keyPaths: string[];         // ['src/', 'server/', 'tests/']
  industryHint: string;       // 'financial' | 'ecommerce' | '' — drives industry KB
}

const EMPTY: ProjectContext = {
  loopName: '',
  projectName: '',
  description: '',
  languages: [],
  frameworks: [],
  projectType: '',
  tools: [],
  deployTarget: '',
  scale: 'single',
  keyPaths: [],
  industryHint: '',
};

/**
 * Build a ProjectContext from heterogeneous inputs.
 * @param loopName   user-provided loop name
 * @param files      uploaded code files (parsed)
 * @param deps       dependency info extracted from package.json / pyproject.toml etc.
 * @param languages  languages detected from files
 * @param freeText   user's natural-language project description
 */
export function buildProjectContext(args: {
  loopName: string;
  files: ParsedFile[];
  deps: { languages: string[]; frameworks: string[]; projectType: string; tools: string[] };
  freeText?: string;
}): ProjectContext {
  const { loopName, files, deps, freeText } = args;
  const ctx: ProjectContext = { ...EMPTY, loopName };

  ctx.languages = deps.languages;
  ctx.frameworks = deps.frameworks;
  ctx.projectType = deps.projectType;
  ctx.tools = deps.tools;
  ctx.description = freeText ?? '';

  // Infer scale from file paths
  const paths = files.map((f) => f.path);
  if (paths.some((p) => p.startsWith('apps/') || p.startsWith('packages/'))) {
    ctx.scale = 'monorepo';
  } else if (paths.some((p) => /services?\/[^/]+\/(go\.mod|package\.json|Dockerfile)/.test(p))) {
    ctx.scale = 'microservices';
  }

  // Infer deploy target
  if (paths.some((p) => p.endsWith('docker-compose.yml') || p.endsWith('Dockerfile'))) {
    ctx.deployTarget = 'docker';
  }
  if (paths.some((p) => p.endsWith('vercel.json'))) ctx.deployTarget = 'vercel';
  if (paths.some((p) => p.endsWith('k8s.yaml') || p.includes('kubernetes/'))) {
    ctx.deployTarget = 'k8s';
  }

  // Infer key paths (top-level dirs that contain code)
  const topDirs = new Set<string>();
  for (const p of paths) {
    const seg = p.split('/')[0];
    if (seg && !seg.startsWith('.') && seg !== 'node_modules') topDirs.add(seg + '/');
  }
  ctx.keyPaths = [...topDirs].slice(0, 8);

  // Infer project name from package.json if present
  const pkg = files.find((f) => f.path.endsWith('package.json'));
  if (pkg) {
    try {
      const j = JSON.parse(pkg.content);
      if (j.name) ctx.projectName = j.name;
    } catch {}
  }

  // Industry hint from text + loop name
  ctx.industryHint = detectIndustry(loopName + ' ' + (freeText ?? ''));

  return ctx;
}

const INDUSTRY_KEYWORDS: [RegExp, string][] = [
  [/financial|fintech|banking|payment|trading|audit/i, 'financial'],
  [/ecommerce|e-commerce|shop|store|cart|checkout|merch/i, 'ecommerce'],
  [/iot|device|sensor|mqtt|edge computing|embedded/i, 'iot'],
  [/healthcare|medical|hipaa|patient|clinic|hospital/i, 'healthcare'],
  [/game|gaming|unity|unreal|gameplay/i, 'gaming'],
  [/data|analytics|pipeline|etl|warehouse|ml|machine learning/i, 'data'],
  [/edu|learning|course|student|lms|moodle/i, 'education'],
  [/logistics|supply chain|warehouse|shipping|fleet/i, 'logistics'],
];

export function detectIndustry(text: string): string {
  for (const [re, name] of INDUSTRY_KEYWORDS) {
    if (re.test(text)) return name;
  }
  return '';
}

/**
 * Summarize context for display in UI (not for LLM).
 */
export function summarizeContext(ctx: ProjectContext): string {
  const bits: string[] = [];
  if (ctx.projectName) bits.push(ctx.projectName);
  if (ctx.projectType) bits.push(ctx.projectType);
  if (ctx.languages.length) bits.push(ctx.languages.slice(0, 3).join('/'));
  if (ctx.frameworks.length) bits.push(ctx.frameworks.slice(0, 2).join(', '));
  if (ctx.scale !== 'single') bits.push(ctx.scale);
  if (ctx.deployTarget) bits.push(`→ ${ctx.deployTarget}`);
  return bits.join(' · ');
}
