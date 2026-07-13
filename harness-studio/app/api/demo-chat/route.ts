// ============================================================
// /api/demo-chat — AI 对比演示
// POST: { question, configContext? }
// 返回: { without, with, withoutScore, withScore }
// 无 configContext 时使用默认演示配置
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { llmGenerate, isProviderAvailable, PROVIDERS, type Provider } from '@/lib/llm/client';
import { resolveProvider, getCustomApiKey } from '@/lib/llm/prefs';
import { checkRateLimit, getClientIP } from '@/lib/middleware/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 默认演示配置上下文（模拟 Harness Studio 生成的配置）
const DEFAULT_CONFIG_CONTEXT = `You are part of a well-structured development team using Harness Studio.
Team conventions:
- All functions must have TypeScript types and error handling
- API endpoints must validate input and return typed responses
- Security: use parameterized queries, hash passwords with bcrypt, implement rate limiting
- Code style: descriptive names, early returns, consistent error patterns
- Architecture: separation of concerns, dependency injection where appropriate`;

const WITHOUT_SYSTEM = `You are a helpful coding assistant. Answer the user's question concisely.`;

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIP(req);
    const rate = checkRateLimit(ip);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a minute and try again.' },
        { status: 429 },
      );
    }

    const body = await req.json().catch(() => ({})) as { question?: string; configContext?: string };
    const question = body.question?.trim();
    if (!question) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    // 解析 LLM 供应商和密钥
    const resolved = await resolveProvider();
    const provider: Provider = resolved.provider;
    const model = resolved.model ?? undefined;
    const customKey = await getCustomApiKey(provider);
    const apiKey = customKey ?? undefined;

    if (!isProviderAvailable(provider, customKey ?? undefined)) {
      return NextResponse.json({
        ok: false,
        error: 'LLM 未配置。请在设置页配置 API 密钥后重试。',
        provider: PROVIDERS[provider].label,
      }, { status: 400 });
    }

    const configContext = body.configContext?.trim() || DEFAULT_CONFIG_CONTEXT;

    // 并行调用：无配置 vs 有配置
    const [withoutRes, withRes] = await Promise.all([
      llmGenerate({
        system: WITHOUT_SYSTEM,
        prompt: question,
        config: { provider, model, apiKey, maxTokens: 2000 },
      }).catch((e) => `[Error] ${(e as Error).message}`),
      llmGenerate({
        system: configContext,
        prompt: question,
        config: { provider, model, apiKey, maxTokens: 2000 },
      }).catch((e) => `[Error] ${(e as Error).message}`),
    ]);

    // 简易评分：基于代码质量指标（长度、类型注解、错误处理等）
    const scoreResponse = (text: string): number => {
      let score = 30;
      if (text.length > 200) score += 10;
      if (text.length > 500) score += 10;
      if (/interface|type\s+\w+\s*=/.test(text)) score += 15;
      if (/try\s*\{|catch\s*\(/.test(text)) score += 15;
      if (/async|await/.test(text)) score += 10;
      if (/export\s/.test(text)) score += 5;
      if (/\bError\b|throw\s/.test(text)) score += 10;
      if (/\/\*\*|\/\/.*TODO|\/\/.*FIXME/i.test(text)) score -= 5;
      return Math.max(10, Math.min(98, score + Math.floor(Math.random() * 5)));
    };

    return NextResponse.json({
      ok: true,
      without: withoutRes,
      with: withRes,
      withoutScore: scoreResponse(withoutRes),
      withScore: scoreResponse(withRes),
      provider: PROVIDERS[provider].label,
      model: model ?? PROVIDERS[provider].defaultModel,
    });
  } catch (e) {
    const msg = (e as Error).message || String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
