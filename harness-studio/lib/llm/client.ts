// ============================================================
// LLM Client — unified wrapper around ai-sdk
// Supports OpenAI + Anthropic, picks based on env / request
// Keys come from env (server-side) — never exposed to client
// ============================================================
import { generateText, type LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';

export type Provider = 'openai' | 'anthropic';

export interface LLMConfig {
  provider: Provider;
  model: string;
  apiKey?: string;       // override env key if provided
  baseUrl?: string;      // for proxies / custom endpoints
  temperature?: number;
  maxTokens?: number;
}

const DEFAULTS: Record<Provider, { model: string; envKey: string }> = {
  openai: { model: 'gpt-4o-mini', envKey: 'OPENAI_API_KEY' },
  anthropic: { model: 'claude-3-5-haiku-latest', envKey: 'ANTHROPIC_API_KEY' },
};

// Singleton model instances (cached per provider+key)
const modelCache = new Map<string, LanguageModel>();

function getModel(cfg: LLMConfig): LanguageModel {
  const key = `${cfg.provider}:${cfg.model}:${cfg.apiKey ?? 'env'}`;
  const cached = modelCache.get(key);
  if (cached) return cached;

  const apiKey = cfg.apiKey || process.env[DEFAULTS[cfg.provider].envKey];
  if (!apiKey) {
    throw new Error(
      `No API key for ${cfg.provider}. Set ${DEFAULTS[cfg.provider].envKey} in .env or pass apiKey.`
    );
  }

  let model: LanguageModel;
  if (cfg.provider === 'openai') {
    const inst = createOpenAI({ apiKey, baseURL: cfg.baseUrl });
    model = inst(cfg.model);
  } else {
    const inst = createAnthropic({ apiKey, baseURL: cfg.baseUrl });
    model = inst(cfg.model);
  }

  if (modelCache.size > 8) modelCache.clear(); // cap memory
  modelCache.set(key, model);
  return model;
}

export interface GenerateOptions {
  system?: string;
  prompt: string;
  config?: Partial<LLMConfig>;
  /** Return JSON — wraps prompt with parse instructions */
  json?: boolean;
}

/**
 * High-level text generation. Throws on missing key / network error.
 * Caller should wrap in try/catch and return a friendly 500.
 */
export async function llmGenerate(opts: GenerateOptions): Promise<string> {
  const cfg: LLMConfig = {
    provider: opts.config?.provider ?? 'openai',
    model: opts.config?.model ?? DEFAULTS[opts.config?.provider ?? 'openai'].model,
    apiKey: opts.config?.apiKey,
    baseUrl: opts.config?.baseUrl,
    temperature: opts.config?.temperature ?? 0.7,
    maxTokens: opts.config?.maxTokens ?? 2000,
  };

  const model = getModel(cfg);

  let system = opts.system ?? '';
  let userPrompt = opts.prompt;

  if (opts.json) {
    system +=
      (system ? '\n\n' : '') +
      'You MUST respond with valid JSON only. No markdown fences, no prose before or after. ' +
      'If you cannot fulfill the request, return {"error": "reason"}.';
  }

  const result = await generateText({
    model,
    system: system || undefined,
    prompt: userPrompt,
    temperature: cfg.temperature,
    maxTokens: cfg.maxTokens,
  });

  return result.text;
}

/**
 * Generate + parse JSON. Throws if response isn't valid JSON.
 */
export async function llmGenerateJSON<T = unknown>(opts: GenerateOptions): Promise<T> {
  const raw = await llmGenerate({ ...opts, json: true });
  // Strip any accidental fences
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(cleaned) as T;
}

/** Quick check whether a provider is configured (has key in env) */
export function isProviderAvailable(provider: Provider): boolean {
  return !!process.env[DEFAULTS[provider].envKey];
}

export function availableProviders(): Provider[] {
  return (['openai', 'anthropic'] as Provider[]).filter(isProviderAvailable);
}
