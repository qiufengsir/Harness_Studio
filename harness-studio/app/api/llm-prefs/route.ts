// ============================================================
// /api/llm-prefs — save / read user's default provider + model
// POST: { provider, model? }  → writes cookies
// GET:  → current prefs + provider status
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { PROVIDERS, isProviderAvailable, type Provider } from '@/lib/llm/client';
import { PROVIDER_COOKIE, MODEL_COOKIE, LLM_COOKIE_OPTS, getLLMPrefs } from '@/lib/llm/prefs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
      configured: isProviderAvailable(p.id),
    })),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { provider?: Provider; model?: string | null };
    const provider = body.provider;
    if (!provider || !PROVIDERS[provider]) {
      return NextResponse.json({ error: `Invalid provider: ${provider}` }, { status: 400 });
    }

    const store = await cookies();
    store.set(PROVIDER_COOKIE, provider, LLM_COOKIE_OPTS);

    // Empty model string → clear cookie (use provider default)
    const model = (body.model ?? '').trim();
    if (model) {
      store.set(MODEL_COOKIE, model, LLM_COOKIE_OPTS);
    } else {
      store.delete(MODEL_COOKIE);
    }

    return NextResponse.json({
      ok: true,
      provider,
      model: model || PROVIDERS[provider].defaultModel,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
