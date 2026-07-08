// ============================================================
// Code Parser — lightweight file scanning
// No AST dependency; uses smart heuristics + regex per language.
// Designed to run server-side on uploaded code bundles.
// ============================================================
import path from 'node:path';

export interface ParsedFile {
  path: string;
  ext: string;
  language: string | null;
  content: string;
  lines: number;
}

export interface ParseStats {
  fileCount: number;
  lineCount: number;
  byLanguage: Record<string, number>;
}

const EXT_LANG: Record<string, string> = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript',
  '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript',
  '.py': 'Python',
  '.go': 'Go',
  '.java': 'Java', '.kt': 'Kotlin',
  '.rs': 'Rust',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.cs': 'C#',
  '.cpp': 'C++', '.cc': 'C++', '.c': 'C', '.h': 'C/C++',
  '.swift': 'Swift',
  '.vue': 'Vue', '.svelte': 'Svelte',
  '.css': 'CSS', '.scss': 'SCSS',
  '.html': 'HTML',
  '.json': 'JSON', '.yaml': 'YAML', '.yml': 'YAML', '.toml': 'TOML',
  '.md': 'Markdown',
  '.sql': 'SQL',
};

// Skip these directories
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', '.cache',
  'vendor', '__pycache__', '.venv', 'venv', 'env',
  'target', '.gradle', '.idea', '.vscode', 'coverage',
]);

const SKIP_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.mp3', '.mp4', '.wav', '.mov',
  '.zip', '.tar', '.gz', '.rar',
  '.pdf', '.doc', '.docx',
  '.lock', '.bin', '.exe', '.dll', '.so', '.dylib',
]);

export function detectLanguage(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  return EXT_LANG[ext] ?? null;
}

export function shouldSkip(filePath: string): boolean {
  const parts = filePath.split(/[\\/]/);
  if (parts.some((p) => SKIP_DIRS.has(p))) return true;
  const ext = path.extname(filePath).toLowerCase();
  if (SKIP_EXTS.has(ext)) return true;
  if (filePath.startsWith('.')) return true;
  return false;
}

// Convert a flat list of {path, content} into ParsedFile[]
export function parseFiles(files: { path: string; content: string }[]): {
  files: ParsedFile[];
  stats: ParseStats;
} {
  const out: ParsedFile[] = [];
  const byLanguage: Record<string, number> = {};

  for (const f of files) {
    if (shouldSkip(f.path)) continue;
    const language = detectLanguage(f.path);
    if (!language) continue;

    const content = f.content ?? '';
    const lines = content.split('\n').length;

    out.push({
      path: f.path,
      ext: path.extname(f.path).toLowerCase(),
      language,
      content,
      lines,
    });

    byLanguage[language] = (byLanguage[language] ?? 0) + 1;
  }

  const stats: ParseStats = {
    fileCount: out.length,
    lineCount: out.reduce((s, f) => s + f.lines, 0),
    byLanguage,
  };

  return { files: out, stats };
}

// Extract tech stack signals from package.json / pyproject.toml / go.mod etc.
export function extractDependencies(files: ParsedFile[]): {
  languages: string[];
  frameworks: string[];
  projectType: string;
  tools: string[];
} {
  const languages = new Set<string>();
  const frameworks = new Set<string>();
  const tools = new Set<string>();
  let projectType: string = 'unknown';

  for (const f of files) {
    if (f.language) languages.add(f.language);
  }

  // package.json
  const pkg = files.find((f) => f.path.endsWith('package.json'));
  if (pkg) {
    try {
      const j = JSON.parse(pkg.content);
      const deps = { ...j.dependencies, ...j.devDependencies };
      const map: Record<string, string> = {
        react: 'React', 'react-dom': 'React',
        next: 'Next.js', 'next-router': 'Next.js',
        vue: 'Vue', nuxt: 'Nuxt',
        '@angular/core': 'Angular',
        svelte: 'Svelte', '@sveltejs/kit': 'SvelteKit',
        express: 'Express', fastify: 'Fastify', koa: 'Koa',
        'fastify-express': 'Fastify',
        '@nestjs/core': 'NestJS',
        tailwindcss: 'Tailwind CSS',
        '@mui/material': 'MUI',
        'styled-components': 'styled-components',
        zustand: 'Zustand', redux: 'Redux', '@reduxjs/toolkit': 'Redux Toolkit',
        jotai: 'Jotai', recoil: 'Recoil',
        prisma: 'Prisma', '@prisma/client': 'Prisma',
        drizzle: 'Drizzle ORM', 'drizzle-orm': 'Drizzle ORM',
        mongoose: 'Mongoose',
        typeorm: 'TypeORM',
        sequelize: 'Sequelize',
        playwright: 'Playwright', '@playwright/test': 'Playwright',
        jest: 'Jest', vitest: 'Vitest', mocha: 'Mocha',
        cypress: 'Cypress',
        eslint: 'ESLint', prettier: 'Prettier',
        zod: 'Zod', yup: 'Yup',
        trpc: 'tRPC', '@trpc/server': 'tRPC',
        graphql: 'GraphQL',
        'react-hook-form': 'React Hook Form',
      };
      for (const dep of Object.keys(deps)) {
        const name = map[dep];
        if (name) frameworks.add(name);
      }
      if (deps.next || deps['next/router']) projectType = 'web-app';
      else if (deps.express || deps.fastify || deps['@nestjs/core']) projectType = 'api-service';
      else if (deps.react || deps.vue || deps.svelte) projectType = 'web-app';
    } catch {
      /* noop */
    }
  }

  // pyproject.toml / requirements.txt
  const py = files.find((f) => f.path.endsWith('pyproject.toml') || f.path.endsWith('requirements.txt'));
  if (py) {
    const c = py.content;
    if (/fastapi|FastAPI/i.test(c)) frameworks.add('FastAPI');
    if (/django|Django/i.test(c)) frameworks.add('Django');
    if (/flask|Flask/i.test(c)) frameworks.add('Flask');
    if (/pydantic/i.test(c)) frameworks.add('Pydantic');
    if (/sqlalchemy/i.test(c)) frameworks.add('SQLAlchemy');
    if (/pytest/i.test(c)) frameworks.add('pytest');
    if (!projectType) projectType = frameworks.has('Django') || frameworks.has('FastAPI') || frameworks.has('Flask') ? 'api-service' : 'unknown';
  }

  // go.mod
  const go = files.find((f) => f.path.endsWith('go.mod'));
  if (go) {
    const c = go.content;
    if (/gin-gonic/i.test(c)) frameworks.add('Gin');
    if (/echo\/v4/i.test(c)) frameworks.add('Echo');
    if (/fiber/i.test(c)) frameworks.add('Fiber');
    if (/gorm.io/i.test(c)) frameworks.add('GORM');
    if (!projectType) projectType = 'api-service';
  }

  // Cargo.toml
  const cargo = files.find((f) => f.path.endsWith('Cargo.toml'));
  if (cargo) {
    const c = cargo.content;
    if (/actix-web/i.test(c)) frameworks.add('Actix Web');
    if (/axum/i.test(c)) frameworks.add('Axum');
    if (/tokio/i.test(c)) frameworks.add('Tokio');
    if (/sqlx/i.test(c)) frameworks.add('sqlx');
    if (!projectType) projectType = 'api-service';
  }

  return {
    languages: Array.from(languages),
    frameworks: Array.from(frameworks),
    projectType,
    tools: Array.from(tools),
  };
}
