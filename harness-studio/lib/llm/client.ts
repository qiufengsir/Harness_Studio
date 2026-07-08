// ============================================================
// LLM Client — unified wrapper around ai-sdk
// Supports multiple OpenAI-compatible providers + Anthropic
//
// Built-in providers (key from env):
//   - openai    (OPENAI_API_KEY)        https://api.openai.com/v1
//   - anthropic (ANTHROPIC_API_KEY)     https://api.anthropic.com
//   - deepseek  (DEEPSEEK_API_KEY)      https://api.deepseek.com        ← V4-Pro/Flash
//   - moonshot  (MOONSHOT_API_KEY)      https://api.moonshot.cn/v1
//   - qwen      (DASHSCOPE_API_KEY)     https://dashscope.aliyuncs.com/compatible-mode/v1
//   - zhipu     (ZHIPU_API_KEY)         https://open.bigmodel.cn/api/paas/v4
//   - groq      (GROQ_API_KEY)          https://api.groq.com/openai/v1
//
// User-selected default provider is stored in cookie `llm_provider`
// and optional custom model in `llm_model`. See lib/llm/prefs.ts.
// ============================================================
import { generateText, type LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';

export type Provider = 'openai' | 'anthropic' | 'deepseek' | 'moonshot' | 'qwen' | 'zhipu' | 'groq';

export interface ProviderMeta {
  id: Provider;
  label: string;           // display name
  protocol: 'openai' | 'anthropic';
  baseUrl: string;
  defaultModel: string;
  envKey: string;          // env var holding the API key
  models: string[];        // selectable models
  region: 'CN' | 'GLOBAL';
  docUrl: string;
}

/** Static registry — drives Settings UI + client init */
export const PROVIDERS: Record<Provider, ProviderMeta> = {
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    protocol: 'openai',
    baseUrl: 'https://api.deepseek.com',
    // V4-Flash is the default — it's much faster (83 tok/s vs V4-Pro's slower
    // thinking mode) and quality is comparable for prompt generation tasks.
    // Users can switch to V4-Pro in Settings for complex reasoning.
    defaultModel: 'deepseek-v4-flash',
    envKey: 'DEEPSEEK_API_KEY',
    models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
    region: 'CN',
    docUrl: 'https://api-docs.deepseek.com/',
  },
  moonshot: {
    id: 'moonshot',
    label: 'Moonshot / Kimi',
    protocol: 'openai',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-32k',
    envKey: 'MOONSHOT_API_KEY',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k', 'kimi-k2-0905-preview'],
    region: 'CN',
    docUrl: 'https://platform.moonshot.cn/docs',
  },
  qwen: {
    id: 'qwen',
    label: 'Qwen / 通义千问',
    protocol: 'openai',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    envKey: 'DASHSCOPE_API_KEY',
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen2.5-coder-32b-instruct'],
    region: 'CN',
    docUrl: 'https://help.aliyun.com/zh/dashscope/',
  },
  zhipu: {
    id: 'zhipu',
    label: 'Zhipu / 智谱 GLM',
    protocol: 'openai',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-plus',
    envKey: 'ZHIPU_API_KEY',
    models: ['glm-4-plus', 'glm-4-air', 'glm-4-flash', 'glm-4.5'],
    region: 'CN',
    docUrl: 'https://open.bigmodel.cn/dev/api',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    envKey: 'OPENAI_API_KEY',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1', 'gpt-4.1-mini', 'o4-mini'],
    region: 'GLOBAL',
    docUrl: 'https://platform.openai.com/docs',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic Claude',
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-3-5-haiku-latest',
    envKey: 'ANTHROPIC_API_KEY',
    models: ['claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest', 'claude-sonnet-4-5', 'claude-opus-4-1'],
    region: 'GLOBAL',
    docUrl: 'https://docs.anthropic.com/',
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    protocol: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    envKey: 'GROQ_API_KEY',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    region: 'GLOBAL',
    docUrl: 'https://console.groq.com/docs',
  },
};

export const PROVIDER_LIST: ProviderMeta[] = Object.values(PROVIDERS);

export interface LLMConfig {
  provider: Provider;
  model: string;
  apiKey?: string;       // override env key if provided
  baseUrl?: string;      // override registry baseUrl
  temperature?: number;
  maxTokens?: number;
}

// Singleton model instances (cached per provider+key+model)
const modelCache = new Map<string, LanguageModel>();

/**
 * Custom fetch for DeepSeek — injects `thinking: {type: "disabled"}` into
 * the request body to disable the thinking mode that makes V4-Pro/Flash
 * ~10x slower (57s → 6s for prompt generation).
 *
 * DeepSeek is the only provider that needs this; others ignore the param
 * or reject it, so we only inject for deepseek.com base URLs.
 */
function makeDeepSeekFetch(): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.body && typeof init.body === 'string') {
      try {
        const body = JSON.parse(init.body);
        // Only inject if not already set — and only for chat completions
        if (!body.thinking) {
          body.thinking = { type: 'disabled' };
          init = { ...init, body: JSON.stringify(body) };
        }
      } catch {
        // Body isn't JSON — pass through unchanged
      }
    }
    return globalThis.fetch(input, init);
  };
}

function getModel(cfg: LLMConfig): LanguageModel {
  const meta = PROVIDERS[cfg.provider];
  if (!meta) throw new Error(`Unknown provider: ${cfg.provider}`);

  const apiKey = cfg.apiKey || process.env[meta.envKey];
  if (!apiKey) {
    throw new Error(
      `No API key for ${cfg.provider}. Set ${meta.envKey} in .env.local (see Settings page).`
    );
  }

  const model = cfg.model || meta.defaultModel;
  const baseUrl = cfg.baseUrl || meta.baseUrl;

  const key = `${cfg.provider}:${model}:${apiKey.slice(0, 8)}`;
  const cached = modelCache.get(key);
  if (cached) return cached;

  let inst: LanguageModel;
  if (meta.protocol === 'anthropic') {
    const client = createAnthropic({ apiKey, baseURL: baseUrl });
    inst = client(model);
  } else {
    // All OpenAI-compatible providers go through createOpenAI.
    // For DeepSeek, use a custom fetch to inject thinking:disabled.
    const isDeepSeek = /deepseek\.com/.test(baseUrl);
    const client = createOpenAI({
      apiKey,
      baseURL: baseUrl,
      ...(isDeepSeek ? { fetch: makeDeepSeekFetch() } : {}),
    });
    inst = client(model);
  }

  if (modelCache.size > 8) modelCache.clear();
  modelCache.set(key, inst);
  return inst;
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
  const provider = opts.config?.provider ?? 'deepseek';
  const meta = PROVIDERS[provider];
  const cfg: LLMConfig = {
    provider,
    model: opts.config?.model ?? meta.defaultModel,
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
 *
 * Robustness:
 * - Strips markdown fences (```json ... ```)
 * - Skips DeepSeek "thinking mode" preamble (everything before first `{`)
 * - Tolerates trailing prose after the JSON object
 * - On partial JSON (truncated by maxTokens), tries to salvage key-value pairs
 */
export async function llmGenerateJSON<T = unknown>(opts: GenerateOptions): Promise<T> {
  const raw = await llmGenerate({ ...opts, json: true });

  // Strip markdown fences if present
  let cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Some models (DeepSeek thinking mode, Claude reasoning) prepend
  // narrative before the JSON. Find the first '{' and last '}'.
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Try to salvage: extract completed "key": "value" pairs from truncated JSON
    const salvaged: Record<string, string> = {};
    // Match "agent-name": "..." where value can span multiple lines until unescaped quote
    const re = /"([a-zA-Z0-9_-]+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(cleaned)) !== null) {
      const key = m[1];
      // Skip meta keys like _error
      if (key.startsWith('_')) continue;
      // Unescape common sequences
      const val = m[2]
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
      salvaged[key] = val;
    }
    if (Object.keys(salvaged).length > 0) {
      return salvaged as unknown as T;
    }
    throw new Error(`Could not parse JSON from LLM response (length=${raw.length}). First 200 chars: ${raw.slice(0, 200)}`);
  }
}

/** Quick check whether a provider is configured (has key in env) */
export function isProviderAvailable(provider: Provider): boolean {
  const meta = PROVIDERS[provider];
  return !!meta && !!process.env[meta.envKey];
}

/** List of providers that have an API key configured in env */
export function availableProviders(): Provider[] {
  return PROVIDER_LIST.filter((p) => isProviderAvailable(p.id)).map((p) => p.id);
}

/** Status report for Settings page */
export function providerStatus(): Array<{
  provider: Provider;
  label: string;
  region: 'CN' | 'GLOBAL';
  defaultModel: string;
  models: string[];
  docUrl: string;
  configured: boolean;
}> {
  return PROVIDER_LIST.map((p) => ({
    provider: p.id,
    label: p.label,
    region: p.region,
    defaultModel: p.defaultModel,
    models: p.models,
    docUrl: p.docUrl,
    configured: isProviderAvailable(p.id),
  }));
}
