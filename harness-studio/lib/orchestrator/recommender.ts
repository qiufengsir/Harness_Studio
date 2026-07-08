// ============================================================
// Agent Recommender — suggests agent rosters + patterns
// Combines:
//   - industry KB (deterministic, instant)
//   - LLM generation (specific, contextual — when API key present)
// Strategy:
//   1. Always compute a deterministic baseline from industry KB
//   2. If LLM available, enrich with context-specific agents
//   3. If no context + no LLM, return industry roster as-is
// ============================================================
import { matchIndustry, fallbackIndustry, type IndustryTemplate } from './industry';
import { PATTERNS, type PatternId, type PatternDef, type PatternNode } from './patterns';
import type { ProjectContext } from '@/lib/llm/context-parser';
import { llmGenerateJSON, isProviderAvailable, availableProviders } from '@/lib/llm/client';
import { buildAgentRecommendPrompt } from '@/lib/llm/prompts';
import { resolveProvider } from '@/lib/llm/prefs';

export interface RecommendedAgent {
  label: string;
  agent: string;
  role: PatternNode['role'];
  description: string;
}

export interface RecommendationResult {
  agents: RecommendedAgent[];
  pattern: PatternId;
  patternReason: string;
  industry: IndustryTemplate | null;
  source: 'industry' | 'llm' | 'hybrid';
  fallback: boolean;
}

/**
 * Recommend an agent roster + pattern for a new loop.
 * Sync when no LLM, async when LLM is available.
 */
export async function recommendRoster(args: {
  loopName: string;
  pattern?: PatternId;
  ctx: ProjectContext | null;
  useLLM?: boolean;
}): Promise<RecommendationResult> {
  const { loopName, ctx, useLLM = true } = args;
  const text = `${loopName} ${ctx?.description ?? ''} ${ctx?.industryHint ?? ''}`;
  const industry = matchIndustry(text) ?? fallbackIndustry();

  // Determine pattern
  let pattern: PatternId = args.pattern ?? (industry.recommendedPatterns[0] as PatternId) ?? 'worker-leader';
  let patternReason = `Recommended for ${industry.name} industry.`;
  if (ctx) {
    const inferred = inferPatternFromContext(ctx, industry);
    if (inferred && !args.pattern) {
      pattern = inferred.id;
      patternReason = inferred.reason;
    }
  }

  // Baseline agents from industry KB
  const baselineAgents: RecommendedAgent[] = industry.agentRoster.map((a) => ({
    label: a.label,
    agent: a.agent,
    role: a.role,
    description: a.description,
  }));

  // Note: LLM-based roster recommendation is intentionally disabled here.
  // The industry KB + context tweaks already produce high-quality rosters
  // instantly. We save the LLM call for prompt generation (the high-value
  // step in /api/generate). This keeps total latency to one LLM round-trip
  // instead of two, avoiding 60s+ "stuck" UX.
  // If you want LLM roster recommendations back, set USE_LLM_ROSTER=true.
  const USE_LLM_ROSTER = false;
  if (USE_LLM_ROSTER && useLLM && availableProviders().length > 0 && ctx) {
    try {
      const { provider, model } = await resolveProvider();
      const llmAgents = await llmGenerateJSON<RecommendedAgent[]>({
        system: 'You recommend agent rosters for multi-agent AI workflows. Respond with JSON only.',
        prompt: buildAgentRecommendPrompt(loopName, pattern, ctx, industry.id),
        config: { provider, model: model ?? undefined, temperature: 0.6, maxTokens: 1500 },
      });
      if (Array.isArray(llmAgents) && llmAgents.length >= 3) {
        const validRoles = new Set(['leader','worker','reviewer','security','tester','doc-writer','router','specialist','merge']);
        const cleaned = llmAgents
          .filter((a) => a && a.label && a.agent && validRoles.has(a.role))
          .slice(0, 10);
        if (cleaned.length >= 3) {
          return {
            agents: cleaned,
            pattern,
            patternReason,
            industry,
            source: 'llm',
            fallback: false,
          };
        }
      }
    } catch {
      // fall through to hybrid
    }
  }

  // Hybrid: industry baseline + context tweaks (no LLM)
  const agents = tweakByContext(baselineAgents, ctx);

  return {
    agents,
    pattern,
    patternReason,
    industry,
    source: ctx ? 'hybrid' : 'industry',
    fallback: false,
  };
}

/**
 * Infer the best pattern from project context.
 */
function inferPatternFromContext(
  ctx: ProjectContext,
  industry: IndustryTemplate,
): { id: PatternId; reason: string } | null {
  // Microservices / event-driven → pipeline
  if (ctx.scale === 'microservices') {
    return { id: 'pipeline', reason: 'Microservices fit pipeline (service-to-service hand-offs).' };
  }
  // Monorepo / multi-team → hierarchical
  if (ctx.scale === 'monorepo') {
    return { id: 'hierarchical', reason: 'Monorepo with multiple packages fits hierarchical (team leads).' };
  }
  // Data/ML industry → pipeline
  if (industry.id === 'data') {
    return { id: 'pipeline', reason: 'Data/ML work fits pipeline (extract → transform → validate).' };
  }
  // Code review loop → peer-to-peer
  if (/review|audit|inspect/i.test(ctx.loopName)) {
    return { id: 'peer-to-peer', reason: 'Review work fits peer-to-peer (equal peers challenge each other).' };
  }
  // Default to industry's first recommendation
  if (industry.recommendedPatterns.length) {
    return {
      id: industry.recommendedPatterns[0] as PatternId,
      reason: `Standard for ${industry.name}.`,
    };
  }
  return null;
}

/**
 * Tweak the industry roster based on detected context (no LLM).
 * E.g., if React detected, ensure a frontend agent exists.
 */
function tweakByContext(agents: RecommendedAgent[], ctx: ProjectContext | null): RecommendedAgent[] {
  if (!ctx) return agents;
  const out = [...agents];
  const hasAgent = (id: string) => out.some((a) => a.agent === id);

  // Frontend framework detected → ensure frontend agent
  if (ctx.frameworks.some((f) => /react|vue|svelte|angular/i.test(f))) {
    if (!hasAgent('frontend-architect')) {
      out.push({
        label: 'Frontend Worker',
        agent: 'frontend-architect',
        role: 'worker',
        description: `${ctx.frameworks.filter((f) => /react|vue|svelte|angular/i.test(f))[0]} components + state`,
      });
    }
  }
  // Backend framework detected → ensure backend agent
  if (ctx.frameworks.some((f) => /express|fastify|next|nest|django|fastapi|gin|echo/i.test(f))) {
    if (!hasAgent('backend-api')) {
      out.push({
        label: 'Backend Worker',
        agent: 'backend-api',
        role: 'worker',
        description: 'API routes + data layer',
      });
    }
  }
  // Database detected → ensure DB-aware agent
  if (ctx.tools.some((t) => /postgres|mysql|sqlite|redis|mongo/i.test(t))) {
    if (!hasAgent('db-engineer') && !hasAgent('backend-api')) {
      out.push({
        label: 'Data Engineer',
        agent: 'db-engineer',
        role: 'worker',
        description: 'Schema + queries + migrations',
      });
    }
  }
  return out;
}

/**
 * Build a default graph (nodes + edges) from a recommended roster,
 * using the pattern's structure as a template.
 */
export function buildGraphFromRoster(
  pattern: PatternDef,
  agents: RecommendedAgent[],
): { nodes: PatternNode[]; edges: PatternDef['edges'] } {
  const template = pattern;
  const nodes: PatternNode[] = [];
  const agentCount = agents.length;
  const templateNodes = template.nodes;

  // Map agents onto template positions, cycling if more agents than slots
  for (let i = 0; i < agentCount; i++) {
    const a = agents[i];
    const tNode = templateNodes[i % templateNodes.length];
    nodes.push({
      id: tNode.id,
      role: a.role,
      label: a.label,
      agent: a.agent,
      description: a.description,
      x: tNode.x,
      y: tNode.y,
    });
  }

  // Keep only edges whose endpoints exist in our node set
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = template.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

  return { nodes, edges };
}

export function listPatterns(): PatternDef[] {
  return Object.values(PATTERNS);
}
