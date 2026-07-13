// ============================================================
// /api/llm-prefs — save / read user's default provider + model
// POST: { provider, model?, apiKey? }  → writes cookies
//   - apiKey 非空：写入 llm_key_<provider>（不设 httpOnly）
//   - apiKey 为空字符串：删除该 cookie（切回默认密钥）
// GET:  → current prefs + provider status（含 hasCustomKey）
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { PROVIDERS, isProviderAvailable, type Provider } from '@/lib/llm/client';
import {
  PROVIDER_COOKIE,
  MODEL_COOKIE,
  LLM_COOKIE_OPTS,
  APIKEY_COOKIE_PREFIX,
  APIKEY_COOKIE_OPTS,
  getLLMPrefs,
  getAllCustomKeys,
} from '@/lib/llm/prefs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { provider, model, meta, keyMode } = await getLLMPrefs();
  const customKeys = await getAllCustomKeys();
  return NextResponse.json({
    current: { provider, model, label: meta.label, defaultModel: meta.defaultModel, keyMode },
    providers: Object.values(PROVIDERS).map((p) => ({
      id: p.id,
      label: p.label,
      region: p.region,
      defaultModel: p.defaultModel,
      models: p.models,
      docUrl: p.docUrl,
      envKey: p.envKey,
      defaultAvailable: p.defaultAvailable,
      // 仅返回是否已设置，不返回密钥本身
      hasCustomKey: !!customKeys[p.id],
      configured: isProviderAvailable(p.id, customKeys[p.id]),
    })),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { provider?: Provider; model?: string | null; apiKey?: string };
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

    // 自定义密钥：非空写入，空字符串删除（切回默认密钥）
    // body.apiKey 为 undefined 时表示不修改密钥（仅切换 provider/model）
    if (typeof body.apiKey === 'string') {
      const apiKey = body.apiKey.trim();
      const cookieName = `${APIKEY_COOKIE_PREFIX}${provider}`;
      if (apiKey) {
        store.set(cookieName, body.apiKey, APIKEY_COOKIE_OPTS);
      } else {
        store.delete(cookieName);
      }
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
