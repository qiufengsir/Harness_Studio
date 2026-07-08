// ============================================================
// /api/llm-test — verify provider config works end-to-end
// POST: { provider, model? }  → uses env key to send a 1-token ping
// Returns: { ok, provider, model, latencyMs, reply } | { ok: false, error }
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { PROVIDERS, llmGenerate, isProviderAvailable, type Provider } from '@/lib/llm/client';
import { getLLMPrefs } from '@/lib/llm/prefs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { provider?: Provider; model?: string };
    const { provider: userProvider, model: userModel } = await getLLMPrefs();
    const provider = body.provider ?? userProvider;
    const model = body.model ?? userModel ?? PROVIDERS[provider]?.defaultModel;

    const meta = PROVIDERS[provider];
    if (!meta) {
      return NextResponse.json({ ok: false, error: `Unknown provider: ${provider}` }, { status: 400 });
    }

    if (!isProviderAvailable(provider)) {
      return NextResponse.json({
        ok: false,
        error: `${meta.label} 未配置 API Key。请在 .env.local 中设置 ${meta.envKey} 后重启服务。`,
        envKey: meta.envKey,
        docUrl: meta.docUrl,
      }, { status: 400 });
    }

    const t0 = Date.now();
    const reply = await llmGenerate({
      prompt: 'Reply with the single word: OK',
      config: {
        provider,
        model,
        temperature: 0,
        maxTokens: 10,
      },
    });
    const latencyMs = Date.now() - t0;

    return NextResponse.json({
      ok: true,
      provider,
      model,
      label: meta.label,
      latencyMs,
      reply: reply.trim().slice(0, 50),
    });
  } catch (e) {
    const msg = (e as Error).message || String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/** GET: return current prefs + provider status (for Settings page hydration) */
export async function GET() {
  const { provider, model, meta } = await getLLMPrefs();
  return NextResponse.json({
    current: { provider, model, label: meta.label, defaultModel: meta.defaultModel },
    providers: Object.values(PROVIDERS).map((p) => ({
      id: p.id,
      label: p.label,
      region: p.region,
      defaultModel: p.defaultModel,
      models: p.models,
      docUrl: p.docUrl,
      envKey: p.envKey,
      configured: !!process.env[p.envKey],
    })),
  });
}
