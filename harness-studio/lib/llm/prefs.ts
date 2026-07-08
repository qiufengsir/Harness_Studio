// ============================================================
// LLM Preferences — user-selected default provider + model
// Stored in cookies (server-readable, no flash on load)
//
// Cookies:
//   llm_provider  — Provider id (e.g. "deepseek")
//   llm_model     — Optional model override (e.g. "deepseek-v4-flash")
// ============================================================
import { cookies } from 'next/headers';
import { PROVIDERS, type Provider, type ProviderMeta } from './client';

export const PROVIDER_COOKIE = 'llm_provider';
export const MODEL_COOKIE = 'llm_model';
export const LLM_COOKIE_OPTS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 365, // 1 year
  httpOnly: true,
  sameSite: 'lax' as const,
};

/** Server-side: read user's preferred provider + model from cookies */
export async function getLLMPrefs(): Promise<{ provider: Provider; model: string | null; meta: ProviderMeta }> {
  const store = await cookies();
  const providerRaw = store.get(PROVIDER_COOKIE)?.value ?? 'deepseek';
  const provider = (PROVIDERS as Record<string, ProviderMeta>)[providerRaw]?.id
    ? (providerRaw as Provider)
    : 'deepseek';
  const model = store.get(MODEL_COOKIE)?.value ?? null;
  return { provider, model, meta: PROVIDERS[provider] };
}

/** Server-side: detect available providers for fallback logic */
export function configuredProviderCount(): number {
  return Object.values(PROVIDERS).filter((p) => !!process.env[p.envKey]).length;
}

/** Pick a sensible default: user's choice → first configured → 'deepseek' */
export async function resolveProvider(): Promise<{ provider: Provider; model: string | null }> {
  const { provider, model } = await getLLMPrefs();
  // If user's choice is configured, use it
  if (PROVIDERS[provider] && process.env[PROVIDERS[provider].envKey]) {
    return { provider, model };
  }
  // Fallback: first configured provider
  for (const meta of Object.values(PROVIDERS)) {
    if (process.env[meta.envKey]) {
      return { provider: meta.id, model: null };
    }
  }
  // Last resort: deepseek (will error gracefully if not configured)
  return { provider: 'deepseek', model: null };
}
