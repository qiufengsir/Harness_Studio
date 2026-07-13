'use client';

// ============================================================
// ProviderConfig — client component for Settings page
// Lets user pick default provider + model override, test connection
// 支持默认密钥/自定义密钥切换
// ============================================================
import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, AlertCircle, RefreshCw, ExternalLink, Zap, KeyRound, ShieldCheck } from 'lucide-react';
import { Button, Chip } from '@/components/ui';
import type { Provider } from '@/lib/llm/client';

interface ProviderInfo {
  provider: Provider;
  label: string;
  region: 'CN' | 'GLOBAL';
  defaultModel: string;
  models: string[];
  docUrl: string;
  configured: boolean;        // env 或自定义密钥可用
  defaultAvailable: boolean;  // 平台是否提供默认密钥（静态标志）
  hasEnvKey: boolean;         // 环境变量密钥是否实际存在
}

interface Props {
  providers: ProviderInfo[];
  currentProvider: Provider;
  currentModel: string | null;
  hasCustomKey: Record<Provider, boolean>;
  labels: Record<string, string>;
}

type TestState = { status: 'idle' | 'testing' | 'ok' | 'fail'; message?: string; latencyMs?: number };

export function ProviderConfig({ providers, currentProvider, currentModel, hasCustomKey, labels }: Props) {
  const [selected, setSelected] = useState<Provider>(currentProvider);
  const [model, setModel] = useState<string>(currentModel ?? '');
  // 密钥模式：有自定义密钥→custom；否则有 env 密钥→default；都没有→custom（引导输入）
  const [keyMode, setKeyMode] = useState<'default' | 'custom'>(() => {
    if (hasCustomKey[currentProvider]) return 'custom';
    const meta = providers.find((p) => p.provider === currentProvider);
    return meta?.hasEnvKey ? 'default' : 'custom';
  });
  const [customKey, setCustomKey] = useState<string>('');
  // 本地追踪 hasCustomKey，保存后即时更新（避免刷新）
  const [localHasCustomKey, setLocalHasCustomKey] = useState<Record<Provider, boolean>>(hasCustomKey);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [test, setTest] = useState<TestState>({ status: 'idle' });

  const selectedMeta = providers.find((p) => p.provider === selected);
  const hasEnvKey = !!selectedMeta?.hasEnvKey;
  const hasCustom = !!localHasCustomKey[selected];

  // 切换 provider 时重置密钥模式与输入
  useEffect(() => {
    const meta = providers.find((p) => p.provider === selected);
    if (localHasCustomKey[selected]) {
      setKeyMode('custom');
    } else if (meta?.hasEnvKey) {
      setKeyMode('default');
    } else {
      // 无默认密钥时引导用户输入自定义密钥
      setKeyMode('custom');
    }
    setCustomKey('');
    setTest({ status: 'idle' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // 当前是否完全没有可用密钥
  const noKeyAtAll = !hasEnvKey && !hasCustom && !(keyMode === 'custom' && customKey.trim().length > 0);

  // 测试前同步密钥到 cookie，确保测试用的是当前选择的密钥模式
  const syncKeyToCookie = async (): Promise<void> => {
    const body: { provider: Provider; model: string | null; apiKey?: string } = {
      provider: selected,
      model: model.trim() || null,
    };
    let needsSync = false;
    let willHaveCustom = hasCustom;
    if (keyMode === 'custom') {
      const k = customKey.trim();
      if (k) {
        body.apiKey = k;
        needsSync = true;
        willHaveCustom = true;
      }
    } else if (hasCustom) {
      // 切回默认模式：清除自定义密钥 cookie
      body.apiKey = '';
      needsSync = true;
      willHaveCustom = false;
    }
    if (needsSync) {
      const res = await fetch('/api/llm-prefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Save failed');
      setLocalHasCustomKey((prev) => ({ ...prev, [selected]: willHaveCustom }));
    }
  };

  const save = async () => {
    // 自定义模式且无已存密钥时，必须输入密钥
    if (keyMode === 'custom' && !customKey.trim() && !hasCustom) {
      setTest({ status: 'fail', message: labels.customKeyPh });
      return;
    }
    setSaving(true);
    try {
      const body: { provider: Provider; model: string | null; apiKey?: string } = {
        provider: selected,
        model: model.trim() || null,
      };
      let willHaveCustom = hasCustom;
      if (keyMode === 'custom') {
        const k = customKey.trim();
        if (k) {
          body.apiKey = k;
          willHaveCustom = true;
        }
        // 已有自定义密钥但未输入新值：不传 apiKey，保持不变
      } else {
        // default 模式：清除自定义密钥
        body.apiKey = '';
        willHaveCustom = false;
      }
      const res = await fetch('/api/llm-prefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Save failed');
      setLocalHasCustomKey((prev) => ({ ...prev, [selected]: willHaveCustom }));
      if (typeof body.apiKey === 'string' && body.apiKey === '') setCustomKey('');
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2500);
    } catch (e) {
      setTest({ status: 'fail', message: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setTest({ status: 'testing' });
    try {
      // 测试前同步密钥到 cookie，确保测试用的是当前选择的密钥模式
      await syncKeyToCookie();
      const res = await fetch('/api/llm-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: selected, model: model.trim() || undefined }),
      });
      const data = await res.json();
      if (data.ok) {
        setTest({
          status: 'ok',
          latencyMs: data.latencyMs,
          message: `${data.label} · ${data.model} · ${data.reply}`,
        });
      } else {
        setTest({ status: 'fail', message: data.error });
      }
    } catch (e) {
      setTest({ status: 'fail', message: (e as Error).message });
    }
  };

  const refresh = () => window.location.reload();

  return (
    <div className="space-y-5">
      {/* Provider grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {providers.map((p) => {
          const active = selected === p.provider;
          const isCurrent = currentProvider === p.provider;
          const pHasCustom = !!localHasCustomKey[p.provider];
          const pConfigured = p.configured || pHasCustom;
          return (
            <button
              key={p.provider}
              onClick={() => { setSelected(p.provider); }}
              className={`text-left p-4 rounded-lg border-2 transition-all ${
                active
                  ? 'border-black bg-bg2'
                  : pConfigured
                    ? 'border-line hover:border-ink3 bg-white'
                    : 'border-line opacity-60 hover:opacity-100 bg-white'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{p.label}</span>
                  {isCurrent && <Chip tone="dark">{labels.current}</Chip>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  {pHasCustom && (
                    <Chip tone="dark"><KeyRound size={10} /> {labels.keySaved}</Chip>
                  )}
                  {p.hasEnvKey ? (
                    <Chip tone="good"><CheckCircle2 size={10} /> {labels.configured}</Chip>
                  ) : (
                    <Chip tone="warn"><AlertCircle size={10} /> {labels.notConfigured}</Chip>
                  )}
                </div>
              </div>
              <div className="text-[10px] text-ink3 font-mono mb-1.5">{p.defaultModel}</div>
              <div className="flex items-center justify-between text-[10px] text-ink3">
                <span>{p.region === 'CN' ? labels.regionCn : labels.regionGlobal}</span>
                <a
                  href={p.docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-0.5 hover:text-ink"
                >
                  {labels.docs} <ExternalLink size={9} />
                </a>
              </div>
              {!p.hasEnvKey && !pHasCustom && (
                <div className="mt-2 pt-2 border-t border-line text-[10px] text-ink3">
                  {labels.envkey}: <code className="font-mono">{p.defaultModel.split('-')[0].toUpperCase()}_API_KEY</code>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected provider detail */}
      {selectedMeta && (
        <div className="bg-bg2 rounded-lg p-4 border border-line space-y-4">
          {/* Key mode selector */}
          <div>
            <label className="block text-xs font-semibold text-ink2 mb-1.5">{labels.keyMode}</label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {/* Default key option */}
              <button
                onClick={() => hasEnvKey && setKeyMode('default')}
                disabled={!hasEnvKey}
                className={`text-left p-3 rounded-md border-2 transition-all ${
                  keyMode === 'default'
                    ? 'border-black bg-white'
                    : hasEnvKey
                      ? 'border-line hover:border-ink3 bg-white'
                      : 'border-line bg-white opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                  <ShieldCheck size={12} className="text-ink2" />
                  <span className="text-xs font-semibold text-ink">{labels.keyModeDefault}</span>
                  {hasEnvKey && <Chip tone="good">{labels.defaultAvailable}</Chip>}
                </div>
                <div className="text-[10px] text-ink3">{labels.keyModeDefaultSub}</div>
              </button>
              {/* Custom key option */}
              <button
                onClick={() => setKeyMode('custom')}
                className={`text-left p-3 rounded-md border-2 transition-all ${
                  keyMode === 'custom'
                    ? 'border-black bg-white'
                    : 'border-line hover:border-ink3 bg-white'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                  <KeyRound size={12} className="text-ink2" />
                  <span className="text-xs font-semibold text-ink">{labels.keyModeCustom}</span>
                  {hasCustom && <Chip tone="dark">{labels.keySaved}</Chip>}
                </div>
                <div className="text-[10px] text-ink3">{labels.keyModeCustomSub}</div>
              </button>
            </div>

            {/* Custom key input */}
            {keyMode === 'custom' && (
              <div className="space-y-1.5">
                <label className="block text-[11px] text-ink2">{labels.customKey}</label>
                <input
                  type="password"
                  className="input font-mono text-xs"
                  placeholder={labels.customKeyPh}
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value)}
                  autoComplete="off"
                />
                <div className="text-[10px] text-ink3 flex items-start gap-1">
                  <KeyRound size={10} className="mt-0.5 flex-shrink-0" />
                  <span>{labels.customKeyHint}</span>
                </div>
              </div>
            )}

            {/* No key warning */}
            {noKeyAtAll && (
              <div className="mt-2 text-xs text-warn bg-warn/10 rounded-md p-2.5 flex items-start gap-2">
                <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                <span>{labels.noKey}</span>
              </div>
            )}
          </div>

          {/* Default model picker */}
          <div>
            <label className="block text-xs font-semibold text-ink2 mb-1.5">{labels.model}</label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {selectedMeta.models.map((m) => (
                <button
                  key={m}
                  onClick={() => setModel(m === selectedMeta.defaultModel ? '' : m)}
                  className={`chip ${model === m ? 'chip-dark' : ''}`}
                >
                  {m}
                </button>
              ))}
            </div>
            <input
              className="input font-mono text-xs"
              placeholder={labels.modelPh + ` (${selectedMeta.defaultModel})`}
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
          </div>

          {/* Test + save buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="ghost"
              icon={test.status === 'testing' ? Loader2 : Zap}
              onClick={runTest}
              disabled={noKeyAtAll || test.status === 'testing'}
            >
              {test.status === 'testing' ? labels.testing : labels.test}
            </Button>
            <Button
              variant="primary"
              icon={saving ? Loader2 : CheckCircle2}
              onClick={save}
              disabled={saving || noKeyAtAll}
            >
              {saving ? labels.saving : labels.save}
            </Button>
            {savedAt && <Chip tone="good">{labels.saved}</Chip>}
          </div>

          {/* Test result */}
          {test.status === 'ok' && (
            <div className="text-xs text-good bg-good/10 rounded-md p-2.5 flex items-start gap-2">
              <CheckCircle2 size={12} className="mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-semibold">{labels.testOk} · {test.latencyMs}ms</div>
                {test.message && <div className="text-ink3 mt-0.5 font-mono text-[10px]">{test.message}</div>}
              </div>
            </div>
          )}
          {test.status === 'fail' && (
            <div className="text-xs text-bad bg-bad/10 rounded-md p-2.5 flex items-start gap-2">
              <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-semibold">{labels.testFail}</div>
                {test.message && <div className="text-ink3 mt-0.5 break-all">{test.message}</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer hint */}
      <div className="text-xs text-ink3 flex items-start gap-2 bg-bg2/50 rounded-md p-3 border border-line">
        <RefreshCw size={12} className="mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <div className="mb-1">{labels.needRestart}</div>
          <button onClick={refresh} className="text-ink2 underline hover:text-ink">
            {labels.refresh}
          </button>
        </div>
      </div>
    </div>
  );
}
