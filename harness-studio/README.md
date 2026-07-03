# Harness Studio v2.0 — AI Workflow Orchestrator

> Reverse-engineer AI configs from your code, orchestrate multi-agent loops, and measure whether AI actually writes better code.

## Why v2?

v1 was a config generator: you uploaded a PRD, AI parsed it, you got config files. v2 closes the loop:

```
code → analysis → configs → AI runs → metrics → better configs
```

Three modules, each compounding the next:

| Module | What it does | Why it matters |
|---|---|---|
| **01 · Reverse Engineering** | Drop a codebase → AST analysis finds real issues (SQL injection, missing tests, useEffect leaks) → recommends configs that fix each issue | No more writing PRDs for AI to guess. Read the code. |
| **02 · Multi-Agent Loops** | Visually orchestrate 4 patterns (Pipeline / Parallel / Worker-Leader / Specialist Router). Compile once to 8 platforms. | The one thing AI providers can't do alone — they only see their own IDE. |
| **03 · Quality Dashboard** | Submit AI-generated code → score across 4 dimensions (style/security/test/arch) → track trend → prove ROI | Without metrics, you can't tell if your configs actually help. |

## Tech stack

- **Frontend**: Next.js 15 (App Router) · React 19 · TypeScript 5 · Tailwind CSS · React Flow · Recharts
- **Backend**: Next.js API Routes · Drizzle ORM · SQLite (better-sqlite3)
- **AI** (optional): Vercel AI SDK (OpenAI / Anthropic compatible)
- **Deploy**: Vercel · Cloudflare Pages · self-host

## Run it

```bash
cd harness-studio
cp .env.example .env       # optional: add OPENAI_API_KEY for AI-assisted refinement
npm install
npm run dev                # → http://localhost:3000
```

The SQLite database (`dev.db`) is auto-created on first run — no manual migration needed.

## Project structure

```
harness-studio/
├── app/
│   ├── page.tsx                    # Landing — product positioning
│   ├── reverse/                    # Module 01: Reverse Engineering
│   │   ├── page.tsx                #   Import (drop files / paste code)
│   │   └── [id]/page.tsx           #   Analysis result (issues + recommendations)
│   ├── orchestrate/                # Module 02: Multi-Agent Loops
│   │   ├── page.tsx                #   Loop list + pattern picker
│   │   └── [id]/page.tsx           #   React Flow canvas + compile preview
│   ├── dashboard/                  # Module 03: Quality Dashboard
│   │   └── page.tsx                #   Score cards + trend + sample list
│   ├── settings/                   # AI keys + storage info
│   └── api/
│       ├── analyze/                # Module 01 endpoints
│       │   ├── route.ts            #   POST: run analysis
│       │   └── [id]/
│       │       ├── route.ts        #   GET: fetch analysis
│       │       └── accept/route.ts #   POST: accept recommendation
│       ├── loops/                  # Module 02 endpoints
│       │   ├── route.ts            #   GET: list, POST: create / compile
│       │   └── [id]/route.ts       #   GET/PUT/DELETE single loop
│       └── metrics/route.ts        # Module 03: GET dashboard, POST score sample
├── components/
│   ├── ui/                         # Primitives (Card, Button, Chip, ...)
│   ├── layout/AppShell.tsx         # Sidebar + main
│   ├── reverse/                    # IssueList, RecommendationView
│   └── orchestrate/                # PatternPicker
├── lib/
│   ├── db/
│   │   ├── schema.ts               # 7 tables (projects, analysis, recs, loops, samples, events, scores)
│   │   └── client.ts               # Singleton DB with auto-bootstrap
│   ├── analyzer/
│   │   ├── parser.ts               # Multi-language file parser + dependency extraction
│   │   ├── detector.ts             # 8 issue detectors (any, effect, secrets, sql, ...)
│   │   └── recommender.ts          # Issue → config recommendation mapping
│   ├── orchestrator/
│   │   ├── patterns.ts             # 4 canonical loop patterns
│   │   ├── compiler.ts             # Compile graph → 8 platform configs
│   │   └── validator.ts            # Graph sanity check
│   └── metrics/
│       └── scorer.ts               # 15 scoring rules across 4 dimensions
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── drizzle.config.ts
```

## Module details

### Module 01 — Reverse Engineering (`/reverse`)

**Input**: drop source files (or paste code with `path:` markers)
**Output**: detected tech stack + list of real issues + recommended configs that fix each issue

8 detectors:
- `no-explicit-any` — TypeScript `any` usage
- `react-effect-cleanup` — useEffect without cleanup (memory leaks)
- `low-test-coverage` — too few test files
- `hardcoded-secret` — API keys, passwords in source
- `console-log-pollution` — production code with console.log
- `sql-injection-risk` — string interpolation in queries
- `missing-error-handling` — async I/O without try/catch
- `missing-docs` — no README / CONTRIBUTING

Each detector tags issues with the **specific config that would prevent it** (an agent, rule, skill, or loop).

### Module 02 — Multi-Agent Loops (`/orchestrate`)

4 patterns, each scaffolded with realistic agents:

| Pattern | When to use |
|---|---|
| **Pipeline** | Sequential code review (style → security → tests → docs) |
| **Parallel** | Same-input multi-lens audit (all dimensions at once) |
| **Worker-Leader** | Complex feature (leader splits, workers execute, leader assembles) |
| **Specialist Router** | Intent-based triage (router classifies, dispatches to one specialist) |

Canvas features:
- Drag nodes, connect edges, edit agent / system prompt inline
- Compile to **8 platforms**: AGENTS.md, Claude Code, Cursor, GitHub Copilot, TRAE, Cline/Roo Code, Windsurf, Aider
- Preview every generated file in-app
- Auto-save (debounced) to SQLite

### Module 03 — Quality Dashboard (`/dashboard`)

**Input**: paste AI-generated code
**Output**: 4-dimension score + per-rule pass/fail + trend over time + top failing rules

15 rules across 4 dimensions:
- **Style** (4): no-any, no-console, naming, imports
- **Security** (4): no-secrets, no-sql-injection, no-eval, https-only
- **Test** (3): error-handling, input-validation, return-types
- **Architecture** (4): no-circular, file-length, nesting-depth, type-safety

Overall score weights security highest (40%) → style/test/arch (20% each).

## Why this beats "just asking AI"

| Dimension | Direct AI | Harness Studio v2 |
|---|---|---|
| Multi-platform consistency | Per-IDE hallucination | One graph → 8 platforms, same semantics |
| Schema compliance | AI guesses field names | Templates enforce compliance |
| Reason for recommendation | "Best practice" | Tied to a real issue in your code |
| Long-term value | One-shot | Trend proves (or kills) the config's ROI |
| What AI providers can't do | — | Cross-IDE loop orchestration |

## License

MIT
