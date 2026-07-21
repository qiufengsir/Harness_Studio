'use client';

// ============================================================
// Pattern Picker — modal with two tabs:
//   1. Template — pick a pattern, scaffold from preset
//   2. AI Generate — describe project, get recommended agents
//      + LLM-generated system prompts
// ============================================================
import { useState, useCallback, useEffect, useRef } from 'react';
import { X, ArrowRight, Loader2, Sparkles, Upload, FileCode, CheckCircle2, AlertCircle, Cpu } from 'lucide-react';
import { Button, Chip } from '@/components/ui';
import { PATTERN_LIST, patternText } from '@/lib/orchestrator/patterns';
import { getIndustry, industryName } from '@/lib/orchestrator/industry';
import { useI18n } from '@/components/i18n/I18nProvider';

interface LLMStatus {
  llmAvailable: boolean;
  llmProvider: string;
  llmModel: string;
  llmProviderLabel: string;
}

export interface CreateLoopData {
  pattern: string;
  name: string;
  graph?: { nodes: any[]; edges: any[] };
  agentPrompts?: Record<string, string>;
  description?: string;
  meta?: { freeText?: string; uploadedFiles?: string[] } | null;
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
  llmProvider?: string;
  llmModel?: string;
  llmError?: string | null;
  contextSummary: any;
}

export function PatternPicker({ onClose, onPick }: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('ai'); // default to AI tab (the new feature)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6" onClick={onClose}>
      <div
        className="bg-white rounded-t-xl sm:rounded-xl shadow-xl max-w-4xl w-full max-h-[92vh] overflow-y-auto safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 p-4 sm:p-6 border-b border-line sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3 min-w-0">
            {/* Tabs */}
            <div className="flex bg-bg2 rounded-lg p-1">
              <button
                onClick={() => setTab('ai')}
                className={`px-3 py-2 sm:py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 min-h-[40px] ${
                  tab === 'ai' ? 'bg-black text-white' : 'text-ink3 hover:text-ink'
                }`}
              >
                <Sparkles size={11} />
                {t('pp.tab.ai')}
              </button>
              <button
                onClick={() => setTab('template')}
                className={`px-3 py-2 sm:py-1.5 text-xs font-medium rounded-md transition-all min-h-[40px] ${
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
  const { lang } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = () => {
    if (!selected) return;
    setCreating(true);
    setError(null);
    try {
      // 不 await：createLoop 会立刻硬跳转；await 会在线上旧逻辑里卡在 500 API
      void Promise.resolve(
        onPick({ pattern: selected, name: name || `${selected}-loop` }),
      ).catch((e) => {
        setError((e as Error).message || t('pp.create.err'));
        setCreating(false);
      });
    } catch (e) {
      setError((e as Error).message || t('pp.create.err'));
      setCreating(false);
    }
  };

  return (
    <>
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {PATTERN_LIST.map((p) => {
          const active = selected === p.id;
          const txt = patternText(p, lang);
          return (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={`text-left p-5 rounded-lg border-2 transition-all ${
                active ? 'border-black bg-bg2' : 'border-line hover:border-ink3 bg-white'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-black">{txt.name}</h3>
                {active && <Chip tone="dark">{t('pp.selected')}</Chip>}
              </div>
              <p className="text-xs text-ink2 mb-3">{txt.tagline}</p>
              <p className="text-xs text-ink3 leading-relaxed mb-3">{txt.description}</p>
              <div className="border-t border-line pt-3 mt-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-1.5">{t('pp.whenToUse')}</div>
                <ul className="text-xs text-ink2 space-y-1">
                  {txt.whenToUse.map((w, i) => <li key={i}>• {w}</li>)}
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
          {error && (
            <div className="text-xs text-bad flex items-center gap-2 mb-3">
              <AlertCircle size={12} /> {error}
            </div>
          )}
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
  const { lang } = useI18n();
  const [loopName, setLoopName] = useState('');
  const [desc, setDesc] = useState('');
  const [files, setFiles] = useState<{ path: string; content: string }[]>([]);
  const [dragging, setDragging] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<GenResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [llmStatus, setLlmStatus] = useState<LLMStatus | null>(null);
  const aiFileInput = useRef<HTMLInputElement>(null);

  // Load LLM provider status from /api/generate GET
  useEffect(() => {
    fetch('/api/generate')
      .then((r) => r.json())
      .then((d) => {
        if (d.llmProvider) {
          setLlmStatus({
            llmAvailable: d.llmAvailable,
            llmProvider: d.llmProvider,
            llmModel: d.llmModel,
            llmProviderLabel: d.llmProviderLabel,
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleFiles = useCallback(async (dropped: FileList | null) => {
    if (!dropped) return;
    const collected: { path: string; content: string }[] = [];
    for (const file of Array.from(dropped)) {
      // 支持文本类文件（代码、配置、文档）和二进制文档（PDF/Word）
      const isText = /\.(json|toml|yaml|yml|txt|md|markdown|ts|tsx|js|jsx|py|go|rs|java|c|cpp|h|cs|swift|kt|scala|rb|php|vue|html|css|scss|less|xml|csv|sql|sh|bash|zsh|dockerfile|gitignore|env|ini|cfg|conf)$/i.test(file.name);
      const isPdf = /\.pdf$/i.test(file.name);
      const isDocx = /\.docx?$/i.test(file.name);
      if (!isText && !isPdf && !isDocx) continue;
      try {
        if (isText) {
          const text = await file.text();
          collected.push({ path: file.name, content: text });
        } else {
          // 二进制文件用 Base64 编码，API 端解码
          const buffer = await file.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
          collected.push({ path: file.name, content: `__BASE64__:${base64}` });
        }
      } catch {}
    }
    setFiles((p) => [...p, ...collected]);
  }, []);

  const [elapsed, setElapsed] = useState(0);
  const [stage, setStage] = useState<'idle' | 'recommending' | 'generating'>('idle');

  // Elapsed timer while generating
  useEffect(() => {
    if (!generating) {
      setElapsed(0);
      setStage('idle');
      return;
    }
    const start = Date.now();
    setStage('recommending');
    const timer = setInterval(() => {
      const sec = Math.floor((Date.now() - start) / 1000);
      setElapsed(sec);
      // After 3s, assume we're in the LLM prompt-generation phase
      if (sec >= 3) setStage('generating');
    }, 500);
    return () => clearInterval(timer);
  }, [generating]);

  const generate = async () => {
    if (!loopName.trim()) {
      setError(t('pp.ai.err.name'));
      return;
    }
    setGenerating(true);
    setError(null);
    setResult(null);

    // 120s timeout — LLM calls can take 10-40s depending on provider
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

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
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || 'Generation failed');
      }
      const data = (await res.json()) as GenResult;
      setResult(data);
    } catch (e) {
      const err = e as Error;
      if (err.name === 'AbortError') {
        setError('请求超时（120秒）。请稍后重试，或在设置页切换到更快的模型。');
      } else {
        setError(err.message);
      }
    } finally {
      clearTimeout(timeout);
      setGenerating(false);
    }
  };

  const create = () => {
    if (!result) return;
    setCreating(true);
    setError(null);
    try {
      void Promise.resolve(
        onPick({
          pattern: result.pattern,
          name: loopName,
          graph: result.graph,
          agentPrompts: result.generatedPrompts,
          description: desc || undefined,
          meta: {
            freeText: desc || '',
            uploadedFiles: files.map((f) => f.path),
          },
        }),
      ).catch((e) => {
        setError((e as Error).message || t('pp.create.err'));
        setCreating(false);
      });
    } catch (e) {
      setError((e as Error).message || t('pp.create.err'));
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

        {/* LLM provider status */}
        {llmStatus && (
          <div className="flex items-center gap-2 text-xs bg-bg2 rounded-md p-2.5 border border-line">
            <Cpu size={12} className={llmStatus.llmAvailable ? 'text-good' : 'text-warn'} />
            <span className="text-ink3">{t('pp.ai.provider')}:</span>
            {llmStatus.llmAvailable ? (
              <Chip tone="good">{llmStatus.llmProviderLabel} · {llmStatus.llmModel}</Chip>
            ) : (
              <Chip tone="warn">{t('pp.ai.result.llmOff')}</Chip>
            )}
            <span className="text-ink3 ml-auto">{t('pp.ai.provider.sub')}</span>
          </div>
        )}

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
            className={`dropzone py-4 cursor-pointer ${dragging ? 'drag' : ''}`}
            onClick={() => aiFileInput.current?.click()}
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
          <input
            ref={aiFileInput}
            type="file"
            multiple
            className="hidden"
            accept=".json,.toml,.yaml,.yml,.txt,.md,.markdown,.ts,.tsx,.js,.jsx,.py,.go,.rs,.java,.c,.cpp,.h,.cs,.swift,.kt,.scala,.rb,.php,.vue,.html,.css,.scss,.less,.xml,.csv,.sql,.sh,.bash,.zsh,.pdf,.docx,.doc"
            onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
          />
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

        {/* Progress indicator */}
        {generating && (
          <div className="text-xs text-ink3 bg-bg2 rounded-md p-3 border border-line space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Loader2 size={11} className="animate-spin" />
                {stage === 'recommending' ? t('pp.ai.progress.matching') : t('pp.ai.progress.llm')}
              </span>
              <span className="font-mono text-ink2">{elapsed}s</span>
            </div>
            {elapsed >= 10 && (
              <div className="text-[10px] text-ink3">
                {llmStatus?.llmProviderLabel} {llmStatus?.llmModel} {t('pp.ai.progress.slow')}
              </div>
            )}
            {elapsed >= 30 && (
              <div className="text-[10px] text-warn">
                {t('pp.ai.progress.timeout')}
              </div>
            )}
          </div>
        )}
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
              {result.industry && <Chip tone="purple">{t('pp.ai.result.industry')}: {getIndustry(result.industry.id) ? industryName(getIndustry(result.industry.id)!, lang) : result.industry.name}</Chip>}
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

          {/* LLM warning / error */}
          {!result.llmUsed && (
            <div className="text-xs text-warn bg-warn/10 rounded-md p-3 flex items-start gap-2">
              <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div>{promptCount === 0 ? t('pp.ai.result.noPrompts') : t('pp.ai.result.llmOff')}</div>
                {result.llmError && (
                  <div className="mt-1.5 pt-1.5 border-t border-warn/30">
                    <div className="font-semibold text-bad">{t('pp.ai.result.llmErr')} ({result.llmProvider} · {result.llmModel}):</div>
                    <code className="text-[10px] text-ink3 break-all block mt-0.5">{result.llmError}</code>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* LLM success indicator */}
          {result.llmUsed && result.llmProvider && (
            <div className="text-xs text-good bg-good/10 rounded-md p-2.5 flex items-center gap-2">
              <CheckCircle2 size={12} />
              <span>{result.llmProvider} · {result.llmModel}</span>
              <span className="text-ink3 ml-auto">{promptCount} {t('pp.ai.result.prompts')}</span>
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
