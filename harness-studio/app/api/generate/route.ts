// ============================================================
// /api/generate — AI-powered agent roster + instruction generation
// POST: { loopName, pattern?, files?, freeText?, existingAgents? }
// Returns: { agents, pattern, patternReason, industry, generatedPrompts, source }
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { recommendRoster, buildGraphFromRoster, type RecommendedAgent } from '@/lib/orchestrator/recommender';
import { getPattern, type PatternId, type PatternNode } from '@/lib/orchestrator/patterns';
import { parseFiles, extractDependencies } from '@/lib/analyzer/parser';
import { decodeFiles } from '@/lib/analyzer/file-decoder';
import { buildProjectContext, type ProjectContext } from '@/lib/llm/context-parser';
import { llmGenerateJSON, isProviderAvailable, PROVIDERS, type Provider } from '@/lib/llm/client';
import { buildAgentGenPrompt, metaSystemPrompt } from '@/lib/llm/prompts';
import { getIndustry } from '@/lib/orchestrator/industry';
import { resolveProvider, getLLMPrefs } from '@/lib/llm/prefs';
import { checkRateLimit, getClientIP } from '@/lib/middleware/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface GenerateBody {
  loopName: string;
  pattern?: PatternId;
  files?: { path: string; content: string }[];
  freeText?: string;
  existingAgents?: RecommendedAgent[];
  provider?: Provider;       // explicit override (rare)
  apiKey?: string;           // explicit override (rare)
  model?: string;            // explicit override (rare)
  generatePrompts?: boolean; // default true
}

export async function POST(req: NextRequest) {
  try {
    // Rate limit check
    const ip = getClientIP(req);
    const rate = checkRateLimit(ip);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a minute and try again.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rate.resetAt - Date.now()) / 1000)) } }
      );
    }

    const body = (await req.json()) as GenerateBody;
    if (!body.loopName || typeof body.loopName !== 'string') {
      return NextResponse.json({ error: 'loopName is required' }, { status: 400 });
    }

    // ---- 1. Parse project context (if files provided) ----
    let ctx: ProjectContext | null = null;
    if (body.files && body.files.length > 0) {
      // 解码 Base64 编码的二进制文件（PDF/Word）
      const decodedFiles = await decodeFiles(body.files);
      const parsed = parseFiles(decodedFiles);
      const deps = extractDependencies(parsed.files);
      ctx = buildProjectContext({
        loopName: body.loopName,
        files: parsed.files,
        deps,
        freeText: body.freeText,
      });
    } else if (body.freeText) {
      // No files, but free text — minimal context
      ctx = buildProjectContext({
        loopName: body.loopName,
        files: [],
        deps: { languages: [], frameworks: [], projectType: '', tools: [] },
        freeText: body.freeText,
      });
    }

    // ---- 2. Recommend roster + pattern ----
    const useLLM = body.generatePrompts !== false;
    const rec = await recommendRoster({
      loopName: body.loopName,
      pattern: body.pattern,
      ctx,
      useLLM,
    });

    // Use existing agents if provided (user already customized), else use recommended
    const agents = body.existingAgents && body.existingAgents.length > 0
      ? body.existingAgents
      : rec.agents;

    // ---- 3. Generate system prompts via LLM (if available) ----
    let generatedPrompts: Record<string, string> = {};
    // Resolve provider: explicit body override → user cookie pref → first configured
    const resolved = await resolveProvider();
    const provider: Provider = body.provider ?? resolved.provider;
    const model: string | undefined = body.model ?? resolved.model ?? undefined;
    const llmReady = useLLM && (isProviderAvailable(provider) || !!body.apiKey);

    if (llmReady && agents.length > 0) {
      try {
        const prompt = buildAgentGenPrompt(
          body.loopName,
          rec.pattern,
          agents.map((a) => ({
            role: a.role,
            label: a.label,
            agent: a.agent,
            description: a.description,
          })),
          ctx,
        );

        // Append industry prompt suffix if matched
        let system = metaSystemPrompt();
        if (rec.industry && rec.industry.promptSuffix) {
          system += '\n\n' + rec.industry.promptSuffix;
        }

        generatedPrompts = await llmGenerateJSON<Record<string, string>>({
          system,
          prompt,
          config: {
            provider,
            model,
            apiKey: body.apiKey,
            temperature: 0.7,
            maxTokens: 4000,
          },
        });
      } catch (e) {
        // LLM failed — return roster without generated prompts
        generatedPrompts = { _error: (e as Error).message };
      }
    }

    // ---- 4. Build graph from roster + pattern ----
    const patternDef = getPattern(rec.pattern);
    if (!patternDef) {
      return NextResponse.json({ error: `Unknown pattern: ${rec.pattern}` }, { status: 400 });
    }
    const graph = buildGraphFromRoster(patternDef, agents);

    // ---- 5. Return ----
    return NextResponse.json({
      loopName: body.loopName,
      pattern: rec.pattern,
      patternReason: rec.patternReason,
      industry: rec.industry
        ? {
            id: rec.industry.id,
            name: rec.industry.name,
            complianceRules: rec.industry.complianceRules,
            promptSuffix: rec.industry.promptSuffix,
          }
        : null,
      agents,
      graph,
      generatedPrompts,
      source: rec.source,
      contextSummary: ctx
        ? {
            projectName: ctx.projectName,
            languages: ctx.languages,
            frameworks: ctx.frameworks,
            projectType: ctx.projectType,
            scale: ctx.scale,
            deployTarget: ctx.deployTarget,
            industryHint: ctx.industryHint,
          }
        : null,
      llmUsed: llmReady && !generatedPrompts._error,
      llmProvider: provider,
      llmModel: model ?? PROVIDERS[provider].defaultModel,
      llmError: generatedPrompts._error ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || 'Generation failed' },
      { status: 500 },
    );
  }
}

/** GET: list available patterns + industries (for UI pickers) */
export async function GET() {
  const { listPatterns } = await import('@/lib/orchestrator/recommender');
  const { listIndustries } = await import('@/lib/orchestrator/industry');
  const { provider, model, meta } = await getLLMPrefs();
  return NextResponse.json({
    patterns: listPatterns().map((p) => ({
      id: p.id,
      name: p.name,
      tagline: p.tagline,
      description: p.description,
      whenToUse: p.whenToUse,
      nodeCount: p.nodes.length,
      edgeCount: p.edges.length,
    })),
    industries: listIndustries().map((i) => ({
      id: i.id,
      name: i.name,
      agentCount: i.agentRoster.length,
      recommendedPatterns: i.recommendedPatterns,
    })),
    llmAvailable: Object.values(PROVIDERS).some((p) => isProviderAvailable(p.id)),
    llmProvider: provider,
    llmModel: model ?? meta.defaultModel,
    llmProviderLabel: meta.label,
  });
}
