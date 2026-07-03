'use client';

// ============================================================
// Pattern Picker — modal with two tabs:
//   1. Template — pick a pattern, scaffold from preset
//   2. AI Generate — describe project, get recommended agents
//      + LLM-generated system prompts
// ============================================================
import { useState, useCallback } from 'react';
import { X, ArrowRight, Loader2, Sparkles, Upload, FileCode, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button, Chip } from '@/components/ui';
import { PATTERN_LIST } from '@/lib/orchestrator/patterns';
import { useI18n } from '@/components/i18n/I18nProvider';

export interface CreateLoopData {
  pattern: string;
  name: string;
  graph?: { nodes: any[]; edges: any[] };
  agentPrompts?: Record<string, string>;
  description?: string;
}

interface Props {
  onClose: () => void;
  onPick: (data: CreateLoopData) => Promise<void> | void;
}

type Tab = 'template' | 'ai';

interface GenResult {
  pattern: string;
  patternReason: string;
  industry: { id: string; name: string; complianceRules: string[] } | null;
  agents: { label: string; agent: string; role: string; description: string }[];
  graph: { nodes: any[]; edges: any[] };
  generatedPrompts: Record<string, string>;
  source: string;
  llmUsed: boolean;
  contextSummary: any;
}

export function PatternPicker({ onClose, onPick }: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('ai'); // default to AI tab (the new feature)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-line sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            {/* Tabs */}
            <div className="flex bg-bg2 rounded-lg p-1">
              <button
                onClick={() => setTab('ai')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                  tab === 'ai' ? 'bg-black text-white' : 'text-ink3 hover:text-ink'
                }`}
              >
                <Sparkles size={11} />
                {t('pp.tab.ai')}
              </button>
              <button
                onClick={() => setTab('template')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  tab === 'template' ? 'bg-black text-white' : 'text-ink3 hover:text-ink'
                }`}
              >
                {t('pp.tab.template')}
              </button>
            </div>
            {tab === 'ai' && (
              <Chip tone="accent">{t('pp.ai.badge.recommend')}</Chip>
            )}
          </div>
          <button onClick={onClose} className="text-ink3 hover:text-ink"><X size={18} /></button>
        </div>

        {tab === 'template' ? (
          <TemplatePanel t={t} onClose={onClose} onPick={onPick} />
        ) : (
          <AIPanel t={t} onClose={onClose} onPick={onPick} />
        )}
      </div>
    </div>
  );
}

// ============================================================
// Template Panel — original pattern picker
// ============================================================
function TemplatePanel({ t, onClose, onPick }: { t: (k: string) => string; onClose: () => void; onPick: (d: CreateLoopData) => any }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const pick = async () => {
    if (!selected) return;
    setCreating(true);
    try {
      await onPick({ pattern: selected, name: name || `${selected}-loop` });
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {PATTERN_LIST.map((p) => {
          const active = selected === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={`text-left p-5 rounded-lg border-2 transition-all ${
                active ? 'border-black bg-bg2' : 'border-line hover:border-ink3 bg-white'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-black">{p.name}</h3>
                {active && <Chip tone="dark">{t('pp.selected')}</Chip>}
              </div>
              <p className="text-xs text-ink2 mb-3">{p.tagline}</p>
              <p className="text-xs text-ink3 leading-relaxed mb-3">{p.description}</p>
              <div className="border-t border-line pt-3 mt-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-1.5">{t('pp.whenToUse')}</div>
                <ul className="text-xs text-ink2 space-y-1">
                  {p.whenToUse.map((w, i) => <li key={i}>• {w}</li>)}
                </ul>
              </div>
              <div className="border-t border-line pt-3 mt-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-1.5">{t('pp.scaffold')}</div>
                <div className="text-xs text-ink2">{p.nodes.length} {t('pp.scaffold.agents')} · {p.edges.length} {t('pp.scaffold.edges')}</div>
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="p-6 border-t border-line bg-bg2">
          <label className="block text-xs font-semibold text-ink2 mb-2">{t('pp.loopName')}</label>
          <input
            className="input mb-4"
            placeholder={t('pp.loopName.ph')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>{t('pp.cancel')}</Button>
            <Button variant="primary" icon={creating ? Loader2 : ArrowRight} onClick={pick} disabled={creating}>
              {creating ? t('pp.creating') : t('pp.create')}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// AI Panel — describe project, get recommended agents + prompts
// ============================================================
function AIPanel({ t, onClose, onPick }: { t: (k: string) => string; onClose: () => void; onPick: (d: CreateLoopData) => any }) {
  const [loopName, setLoopName] = useState('');
  const [desc, setDesc] = useState('');
  const [files, setFiles] = useState<{ path: string; content: string }[]>([]);
  const [dragging, setDragging] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<GenResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(async (dropped: FileList | null) => {
    if (!dropped) return;
    const collected: { path: string; content: string }[] = [];
    for (const file of Array.from(dropped)) {
      // Only accept text-based config files
      if (!/\.(json|toml|yaml|yml|txt|md|ts|js|py|go|rs)$/i.test(file.name)) continue;
      try {
        const text = await file.text();
        collected.push({ path: file.name, content: text });
      } catch {}
    }
    setFiles((p) => [...p, ...collected]);
  }, []);

  const generate = async () => {
    if (!loopName.trim()) {
      setError(t('pp.ai.err.name'));
      return;
    }
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loopName,
          freeText: desc || undefined,
          files: files.length > 0 ? files : undefined,
          generatePrompts: true,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || 'Generation failed');
      }
      const data = (await res.json()) as GenResult;
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const create = async () => {
    if (!result) return;
    setCreating(true);
    try {
      await onPick({
        pattern: result.pattern,
        name: loopName,
        graph: result.graph,
        agentPrompts: result.generatedPrompts,
        description: desc || undefined,
      });
    } finally {
      setCreating(false);
    }
  };

  const promptCount = result
    ? Object.keys(result.generatedPrompts).filter((k) => !k.startsWith('_') && typeof result.generatedPrompts[k] === 'string' && result.generatedPrompts[k].length > 20).length
    : 0;

  return (
    <>
      {/* Input form */}
      <div className="p-6 space-y-4">
        <div>
          <h2 className="text-black mb-1 flex items-center gap-2">
            <Sparkles size={16} className="text-accent" />
            {t('pp.ai.title')}
          </h2>
          <p className="text-xs text-ink3">{t('pp.ai.sub')}</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-ink2 mb-1.5">{t('pp.ai.loopName')}</label>
          <input
            className="input"
            placeholder={t('pp.ai.loopName.ph')}
            value={loopName}
            onChange={(e) => setLoopName(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-ink2 mb-1.5">{t('pp.ai.desc')}</label>
          <textarea
            className="input h-24"
            placeholder={t('pp.ai.desc.ph')}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-ink2 mb-1.5">{t('pp.ai.files')}</label>
          <div
            className={`dropzone py-4 ${dragging ? 'drag' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
          >
            <Upload size={16} className="mx-auto mb-1.5 text-ink3" />
            <div className="text-xs text-ink3">{t('pp.ai.files')}</div>
            {files.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5 justify-center">
                {files.slice(0, 6).map((f, i) => (
                  <Chip key={i} tone="dark">
                    <span className="flex items-center gap-1"><FileCode size={9} /> {f.path}</span>
                  </Chip>
                ))}
                {files.length > 6 && <Chip tone="default">+{files.length - 6}</Chip>}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="text-xs text-bad flex items-center gap-2">
            <AlertCircle size={12} /> {error}
          </div>
        )}

        <Button
          variant="primary"
          icon={generating ? Loader2 : Sparkles}
          onClick={generate}
          disabled={generating}
          className="w-full justify-center"
        >
          {generating ? t('pp.ai.generating') : t('pp.ai.generate')}
        </Button>
      </div>

      {/* Result */}
      {result && (
        <div className="p-6 border-t border-line bg-bg2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-good" />
              {t('pp.ai.result')}
            </h3>
            <div className="flex gap-1.5">
              <Chip tone="accent">{t('pp.ai.result.pattern')}: {result.pattern}</Chip>
              {result.industry && <Chip tone="purple">{t('pp.ai.result.industry')}: {result.industry.name}</Chip>}
              <Chip tone="good">{result.agents.length} {t('pp.ai.result.agents')}</Chip>
              <Chip tone={promptCount > 0 ? 'good' : 'warn'}>{promptCount} {t('pp.ai.result.prompts')}</Chip>
            </div>
          </div>

          {/* Pattern reason */}
          {result.patternReason && (
            <div className="text-xs text-ink2 bg-white rounded-md p-3 border border-line">
              <span className="font-semibold text-ink">{t('pp.ai.result.pattern')}: </span>
              {result.patternReason}
            </div>
          )}

          {/* LLM warning */}
          {!result.llmUsed && (
            <div className="text-xs text-warn bg-warn/10 rounded-md p-3 flex items-start gap-2">
              <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
              {promptCount === 0 ? t('pp.ai.result.noPrompts') : t('pp.ai.result.llmOff')}
            </div>
          )}

          {/* Agent list */}
          <div className="bg-white rounded-md border border-line overflow-hidden">
            <div className="grid grid-cols-1 divide-y divide-line">
              {result.agents.map((a, i) => {
                const hasPrompt = !!result.generatedPrompts[a.agent] && result.generatedPrompts[a.agent].length > 20;
                return (
                  <div key={i} className="p-3 flex items-start gap-3">
                    <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-mono flex-shrink-0 ${
                      hasPrompt ? 'bg-good/10 text-good' : 'bg-warn/10 text-warn'
                    }`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-ink">{a.label}</span>
                        <Chip tone="dark">{a.role}</Chip>
                        <code className="text-[10px] text-ink3">{a.agent}</code>
                      </div>
                      <div className="text-xs text-ink3">{a.description}</div>
                      {hasPrompt && (
                        <div className="mt-1.5 text-[10px] text-ink3 line-clamp-2 font-mono bg-bg2 rounded p-1.5">
                          {result.generatedPrompts[a.agent].slice(0, 120)}...
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Compliance rules (if industry matched) */}
          {result.industry && result.industry.complianceRules.length > 0 && (
            <div className="bg-white rounded-md border border-line p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-2">
                {t('pp.ai.result.industry')} compliance
              </div>
              <ul className="text-xs text-ink2 space-y-1">
                {result.industry.complianceRules.slice(0, 4).map((r, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-bad mt-0.5">•</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setResult(null)}>↺</Button>
            <Button variant="ghost" onClick={onClose}>{t('pp.cancel')}</Button>
            <Button variant="primary" icon={creating ? Loader2 : ArrowRight} onClick={create} disabled={creating}>
              {creating ? t('pp.creating') : t('pp.ai.create')}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
