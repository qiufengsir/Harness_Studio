// ============================================================
// LLM Preferences — user-selected default provider + model
// Stored in cookies (server-readable, no flash on load)
//
// Cookies:
//   llm_provider        — Provider id (e.g. "deepseek")
//   llm_model           — Optional model override (e.g. "deepseek-v4-flash")
//   llm_key_<provider>  — 自定义 API 密钥（可选，每个 provider 一份）
// ============================================================
import { cookies } from 'next/headers';
import { PROVIDERS, type Provider, type ProviderMeta } from './client';

export const PROVIDER_COOKIE = 'llm_provider';
export const MODEL_COOKIE = 'llm_model';
export const APIKEY_COOKIE_PREFIX = 'llm_key_';
export const LLM_COOKIE_OPTS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 365, // 1 year
  httpOnly: true,
  sameSite: 'lax' as const,
};

// 自定义密钥 cookie 选项：不设 httpOnly，客户端需读取"是否已设置"状态；
// 密钥本身只在 API 调用时使用，不会回显。
export const APIKEY_COOKIE_OPTS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 365, // 1 year
  httpOnly: false,
  sameSite: 'lax' as const,
};

/** Server-side: read user's preferred provider + model from cookies */
export async function getLLMPrefs(): Promise<{
  provider: Provider;
  model: string | null;
  meta: ProviderMeta;
  customKey: string | null;
  keyMode: 'default' | 'custom';
}> {
  const store = await cookies();
  const providerRaw = store.get(PROVIDER_COOKIE)?.value ?? 'deepseek';
  const provider = (PROVIDERS as Record<string, ProviderMeta>)[providerRaw]?.id
    ? (providerRaw as Provider)
    : 'deepseek';
  const model = store.get(MODEL_COOKIE)?.value ?? null;
  const customKeyRaw = store.get(`${APIKEY_COOKIE_PREFIX}${provider}`)?.value ?? '';
  const customKey = customKeyRaw.trim() ? customKeyRaw : null;
  const keyMode: 'default' | 'custom' = customKey ? 'custom' : 'default';
  return { provider, model, meta: PROVIDERS[provider], customKey, keyMode };
}

/** Server-side: 读取指定 provider 的自定义密钥 */
export async function getCustomApiKey(provider: Provider): Promise<string | null> {
  const store = await cookies();
  const v = store.get(`${APIKEY_COOKIE_PREFIX}${provider}`)?.value ?? '';
  return v.trim() ? v : null;
}

/** Server-side: 读取所有自定义密钥 */
export async function getAllCustomKeys(): Promise<Partial<Record<Provider, string>>> {
  const store = await cookies();
  const result: Partial<Record<Provider, string>> = {};
  for (const p of Object.keys(PROVIDERS) as Provider[]) {
    const v = store.get(`${APIKEY_COOKIE_PREFIX}${p}`)?.value ?? '';
    if (v.trim()) result[p] = v;
  }
  return result;
}

/** 判断指定 provider 的密钥模式：有自定义密钥 → custom，否则 → default */
export async function getKeyMode(provider: Provider): Promise<'default' | 'custom'> {
  const customKey = await getCustomApiKey(provider);
  return customKey ? 'custom' : 'default';
}

/** Server-side: detect available providers for fallback logic */
export function configuredProviderCount(): number {
  return Object.values(PROVIDERS).filter((p) => !!process.env[p.envKey]).length;
}

/** Pick a sensible default: user's choice → first configured → 'deepseek' */
export async function resolveProvider(): Promise<{ provider: Provider; model: string | null }> {
  const { provider, model } = await getLLMPrefs();
  const customKeys = await getAllCustomKeys();
  // 如果用户选择的 provider 有 env 密钥或自定义密钥，使用它
  if (PROVIDERS[provider] && (process.env[PROVIDERS[provider].envKey] || customKeys[provider])) {
    return { provider, model };
  }
  // 回退：第一个已配置的 provider
  for (const meta of Object.values(PROVIDERS)) {
    if (process.env[meta.envKey] || customKeys[meta.id]) {
      return { provider: meta.id, model: null };
    }
  }
  // 最后兜底：deepseek（未配置也会优雅报错）
  return { provider: 'deepseek', model: null };
}
