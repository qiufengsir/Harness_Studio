'use client';

// ============================================================
// ProviderConfig — client component for Settings page
// Lets user pick default provider + model override, test connection
// ============================================================
import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, AlertCircle, RefreshCw, ExternalLink, Zap } from 'lucide-react';
import { Button, Chip } from '@/components/ui';
import type { Provider } from '@/lib/llm/client';

interface ProviderInfo {
  provider: Provider;
  label: string;
  region: 'CN' | 'GLOBAL';
  defaultModel: string;
  models: string[];
  docUrl: string;
  configured: boolean;
}

interface Props {
  providers: ProviderInfo[];
  currentProvider: Provider;
  currentModel: string | null;
  labels: Record<string, string>;
}

type TestState = { status: 'idle' | 'testing' | 'ok' | 'fail'; message?: string; latencyMs?: number };

export function ProviderConfig({ providers, currentProvider, currentModel, labels }: Props) {
  const [selected, setSelected] = useState<Provider>(currentProvider);
  const [model, setModel] = useState<string>(currentModel ?? '');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [test, setTest] = useState<TestState>({ status: 'idle' });

  const selectedMeta = providers.find((p) => p.provider === selected);
  const isConfigured = !!selectedMeta?.configured;

  // When user switches provider, reset model to its default if model field is empty
  useEffect(() => {
    if (selectedMeta && !model) {
      // do nothing — keep blank means "use default"
    }
  }, [selected, selectedMeta, model]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/llm-prefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: selected, model: model.trim() || null }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Save failed');
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
          return (
            <button
              key={p.provider}
              onClick={() => { setSelected(p.provider); setTest({ status: 'idle' }); }}
              className={`text-left p-4 rounded-lg border-2 transition-all ${
                active
                  ? 'border-black bg-bg2'
                  : p.configured
                    ? 'border-line hover:border-ink3 bg-white'
                    : 'border-line opacity-60 hover:opacity-100 bg-white'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{p.label}</span>
                  {isCurrent && <Chip tone="dark">{labels.current}</Chip>}
                </div>
                {p.configured ? (
                  <Chip tone="good"><CheckCircle2 size={10} /> {labels.configured}</Chip>
                ) : (
                  <Chip tone="warn"><AlertCircle size={10} /> {labels.notConfigured}</Chip>
                )}
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
              {!p.configured && (
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
              disabled={!isConfigured || test.status === 'testing'}
            >
              {test.status === 'testing' ? labels.testing : labels.test}
            </Button>
            <Button
              variant="primary"
              icon={saving ? Loader2 : CheckCircle2}
              onClick={save}
              disabled={saving || !isConfigured}
            >
              {saving ? labels.saving : labels.save}
            </Button>
            {savedAt && <Chip tone="good">{labels.saved}</Chip>}

            {!isConfigured && (
              <span className="text-xs text-warn flex items-center gap-1">
                <AlertCircle size={11} />
                {labels.pickFirst}
              </span>
            )}
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
