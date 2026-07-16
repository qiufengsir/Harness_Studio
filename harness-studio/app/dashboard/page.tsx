'use client';

// ============================================================
// Dashboard — AI Code Quality Metrics (i18n-aware)
// Closed loop: submit AI code → score → see trend → adjust configs
// ============================================================
import { useEffect, useState, useCallback, useRef, Fragment } from 'react';
import { BarChart3, Upload, TrendingUp, AlertTriangle, CheckCircle2, Loader2, Code2, FolderOpen, X, FileCode } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, Cell,
} from 'recharts';
import { Card, CardSection, Button, PageHeader, Chip, Stat, EmptyState } from '@/components/ui';
import { useI18n } from '@/components/i18n/I18nProvider';

interface Sample {
  id: string;
  filePath: string;
  content: string;
  aiGenerated: boolean;
  createdAt: number;
  events: { rule: string; passed: boolean; severity: string; detail: string | null; dimension: string }[];
}

interface HistoryRow {
  id: string;
  styleScore: number;
  securityScore: number;
  testScore: number;
  archScore: number;
  overall: number;
  createdAt: number;
  topContributors: { name: string; dimension: string; impact: number }[];
}

interface RuleStat {
  name: string;
  total: number;
  passed: number;
  failed: number;
  passRate: number;
}

// 批量评分结果中单个文件的明细
interface BatchFileRow {
  filePath: string;
  lineCount: number;
  overall: number;
  style: number;
  security: number;
  test: number;
  arch: number;
  failedRules: { rule: string; detail: string | null }[];
}

// 批量评分接口返回结构
interface BatchResult {
  fileCount: number;
  totalLines: number;
  scores: { style: number; security: number; test: number; arch: number; overall: number };
  files: BatchFileRow[];
  ruleStats: { rule: string; dimension: string; passed: number; failed: number; total: number }[];
  topContributors: { name: string; dimension: string; impact: number }[];
}

// 已加载的文件条目
interface LoadedFile {
  filePath: string;
  content: string;
}

// 允许的代码文件扩展名
const BATCH_ACCEPT = '.ts,.tsx,.js,.jsx,.py,.go,.rs,.java,.vue';

// 批量评分面板
function BatchPanel({ onScored }: { onScored: () => void }) {
  const { t } = useI18n();
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 接收文件列表并合并到已加载文件中（按 filePath 去重）
  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    const next: LoadedFile[] = [];
    for (const f of arr) {
      try {
        const text = await f.text();
        next.push({ filePath: f.name, content: text });
      } catch {
        // 跳过读取失败的文件
      }
    }
    if (next.length === 0) return;
    setFiles((prev) => {
      const map = new Map(prev.map((p) => [p.filePath, p]));
      for (const n of next) map.set(n.filePath, n);
      return Array.from(map.values());
    });
  }, []);

  // 移除指定文件
  const removeFile = (filePath: string) => {
    setFiles((prev) => prev.filter((p) => p.filePath !== filePath));
  };

  // 清空全部
  const clearAll = () => {
    setFiles([]);
    setResult(null);
    setError(null);
    setExpanded(null);
  };

  // 提交全部文件评分
  const scoreAll = async () => {
    if (files.length === 0) {
      setError(t('dash.batch.result.empty'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/metrics', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files, source: 'batch' }),
      });
      if (!res.ok) throw new Error('Batch score failed');
      const data: BatchResult = await res.json();
      setResult(data);
      onScored();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // 拖拽相关事件
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  return (
    <div>
      {/* 上传区域 */}
      <div
        className={`dropzone border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-black bg-bg2' : 'border-line hover:border-ink3'
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <Upload size={24} className="mx-auto text-ink3 mb-2" />
        <p className="text-sm font-medium text-ink">{t('dash.batch.drop')}</p>
        <p className="text-[10px] text-ink3 mt-1">{t('dash.batch.drop.sub')}</p>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept={BATCH_ACCEPT}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {/* 已加载文件列表 */}
      {files.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-ink2">
              {files.length} {t('dash.batch.loaded')}
            </span>
            <button
              type="button"
              onClick={clearAll}
              className="text-[10px] text-ink3 hover:text-bad transition-colors"
            >
              {t('dash.batch.clear')}
            </button>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {files.map((f) => (
              <div
                key={f.filePath}
                className="flex items-center gap-2 px-2 py-1.5 rounded bg-bg2 text-xs"
              >
                <FileCode size={11} className="text-ink3 flex-shrink-0" />
                <span className="font-mono text-ink2 truncate flex-1">{f.filePath}</span>
                <button
                  type="button"
                  onClick={() => removeFile(f.filePath)}
                  className="text-ink3 hover:text-bad transition-colors flex-shrink-0"
                  title={t('dash.batch.remove')}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 评分按钮 */}
      <div className="flex justify-end mt-4">
        <Button
          variant="primary"
          icon={submitting ? Loader2 : Upload}
          onClick={scoreAll}
          disabled={submitting || files.length === 0}
        >
          {submitting ? t('dash.batch.scoring') : t('dash.batch.run')}
        </Button>
      </div>

      {error && <div className="mt-2 text-xs text-bad">{error}</div>}

      {/* 评分结果 */}
      {result && (
        <div className="mt-6">
          {/* 项目级聚合分数卡片 */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">{t('dash.batch.result.title')}</h3>
            <span className="text-[10px] text-ink3">
              {result.fileCount} {t('dash.batch.result.files')} · {result.totalLines} {t('dash.batch.result.lines')}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
            <Stat
              label={t('dash.overall')}
              value={result.scores.overall}
              tone={result.scores.overall >= 80 ? 'good' : 'warn'}
            />
            <Stat label={t('dash.style')} value={result.scores.style} tone="default" />
            <Stat
              label={t('dash.security')}
              value={result.scores.security}
              tone={result.scores.security >= 80 ? 'good' : 'bad'}
            />
            <Stat label={t('dash.test')} value={result.scores.test} tone="default" />
            <Stat label={t('dash.archFull')} value={result.scores.arch} tone="default" />
          </div>

          {/* 文件明细表格 */}
          <h3 className="text-sm font-semibold mb-2">{t('dash.batch.result.fileBreakdown')}</h3>
          <div className="border border-line rounded-lg overflow-hidden scroll-x">
            <table className="w-full text-xs min-w-[640px]">
              <thead className="bg-bg2 text-ink3">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">File</th>
                  <th className="text-right px-3 py-2 font-semibold">Lines</th>
                  <th className="text-right px-3 py-2 font-semibold">Overall</th>
                  <th className="text-right px-3 py-2 font-semibold">Style</th>
                  <th className="text-right px-3 py-2 font-semibold">Security</th>
                  <th className="text-right px-3 py-2 font-semibold">Test</th>
                  <th className="text-right px-3 py-2 font-semibold">Arch</th>
                  <th className="text-right px-3 py-2 font-semibold">Failed</th>
                </tr>
              </thead>
              <tbody>
                {result.files.map((f) => {
                  const isOpen = expanded === f.filePath;
                  const failedCount = f.failedRules.length;
                  return (
                    <Fragment key={f.filePath}>
                      <tr
                        onClick={() => setExpanded(isOpen ? null : f.filePath)}
                        className={`border-t border-line cursor-pointer transition-colors ${
                          isOpen ? 'bg-bg2' : 'hover:bg-bg2'
                        }`}
                      >
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <FileCode size={11} className="text-ink3 flex-shrink-0" />
                            <span className="font-mono text-ink2 truncate">{f.filePath}</span>
                          </div>
                        </td>
                        <td className="text-right px-3 py-2 text-ink3">{f.lineCount}</td>
                        <td className="text-right px-3 py-2 font-semibold text-ink">{f.overall}</td>
                        <td className="text-right px-3 py-2 text-ink2">{f.style}</td>
                        <td className="text-right px-3 py-2 text-ink2">{f.security}</td>
                        <td className="text-right px-3 py-2 text-ink2">{f.test}</td>
                        <td className="text-right px-3 py-2 text-ink2">{f.arch}</td>
                        <td className="text-right px-3 py-2">
                          {failedCount > 0 ? (
                            <span className="inline-flex items-center gap-1 text-bad">
                              <AlertTriangle size={10} />
                              {failedCount}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-good">
                              <CheckCircle2 size={10} />
                              0
                            </span>
                          )}
                        </td>
                      </tr>
                      {isOpen && failedCount > 0 && (
                        <tr className="border-t border-line bg-bg2">
                          <td colSpan={8} className="px-3 py-2">
                            <div className="space-y-1.5 pl-5">
                              {f.failedRules.map((r, i) => (
                                <div key={i} className="flex items-start gap-2 text-[11px]">
                                  <AlertTriangle size={10} className="text-bad mt-0.5 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <span className="font-mono text-ink2">{r.rule}</span>
                                    {r.detail && (
                                      <div className="text-ink3 text-[10px] mt-0.5">{r.detail}</div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useI18n();
  const [data, setData] = useState<{
    samples: Sample[];
    history: HistoryRow[];
    ruleStats: RuleStat[];
    projects: any[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [filePath, setFilePath] = useState('');
  const [code, setCode] = useState('');
  const [selectedSample, setSelectedSample] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Collect existing file paths for datalist suggestions
  const knownPaths = data?.samples?.map((s) => s.filePath).filter((v, i, a) => a.indexOf(v) === i) ?? [];

  const handleFilePick = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      setFilePath(file.name);
      setCode(text);
    } catch {
      setError('Failed to read file');
    }
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/metrics')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!code || !filePath) {
      setError(t('dash.submit.errRequired'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, content: code, source: 'paste', aiGenerated: true }),
      });
      if (!res.ok) throw new Error('Submit failed');
      setCode('');
      setFilePath('');
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const latest = data?.history[0];
  const prev = data?.history[1];
  const delta = (cur?: number, p?: number) => {
    if (cur === undefined || p === undefined) return null;
    return cur > p ? `+${cur - p}` : `${cur - p}`;
  };

  const selected = data?.samples.find((s) => s.id === selectedSample);

  return (
    <div>
      <PageHeader
        title={t('dash.title')}
        desc={t('dash.desc')}
        actions={<Chip tone="good">{t('dash.module')}</Chip>}
      />

      {/* Why this exists */}
      <Card className="mb-6 bg-bg2 border-line">
        <CardSection className="py-3">
          <div className="flex items-start gap-3 text-sm text-ink2">
            <BarChart3 size={16} className="text-good mt-0.5 flex-shrink-0" />
            <p>
              <strong className="text-black">{t('dash.banner.strong')}</strong>
              {t('dash.banner.text')}
            </p>
          </div>
        </CardSection>
      </Card>

      {/* Score cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Stat label={t('dash.overall')} value={latest?.overall ?? '—'} delta={delta(latest?.overall, prev?.overall) ?? undefined} tone={latest && latest.overall >= 80 ? 'good' : 'warn'} />
        <Stat label={t('dash.style')} value={latest?.styleScore ?? '—'} delta={delta(latest?.styleScore, prev?.styleScore) ?? undefined} tone="default" />
        <Stat label={t('dash.security')} value={latest?.securityScore ?? '—'} delta={delta(latest?.securityScore, prev?.securityScore) ?? undefined} tone={latest && latest.securityScore >= 80 ? 'good' : 'bad'} />
        <Stat label={t('dash.test')} value={latest?.testScore ?? '—'} delta={delta(latest?.testScore, prev?.testScore) ?? undefined} tone="default" />
        <Stat label={t('dash.archFull')} value={latest?.archScore ?? '—'} delta={delta(latest?.archScore, prev?.archScore) ?? undefined} tone="default" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: submit + chart */}
        <div className="lg:col-span-2 space-y-6">
          {/* Submit form with tabs */}
          <Card>
            <CardSection>
              <h2 className="mb-1">{t('dash.submit.title')}</h2>
              <p className="text-xs text-ink3 mb-4">{t('dash.submit.sub')}</p>

              {/* Tab 切换器：单文件 / 批量文件 */}
              <div className="flex bg-bg2 rounded-lg p-1 mb-4">
                <button
                  onClick={() => setMode('single')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    mode === 'single' ? 'bg-black text-white' : 'text-ink3 hover:text-ink'
                  }`}
                >
                  {t('dash.tab.single')}
                </button>
                <button
                  onClick={() => setMode('batch')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    mode === 'batch' ? 'bg-black text-white' : 'text-ink3 hover:text-ink'
                  }`}
                >
                  {t('dash.tab.batch')}
                </button>
              </div>

              {mode === 'single' ? (
                <>
                  <div className="grid-2 gap-3 mb-3">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-1">{t('dash.submit.filePath')}</label>
                      <div className="flex gap-2">
                        <input
                          className="input flex-1"
                          placeholder={t('dash.submit.filePath.ph')}
                          value={filePath}
                          onChange={(e) => setFilePath(e.target.value)}
                          list="file-path-suggestions"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1.5 rounded-md border border-line bg-bg2 text-xs font-medium text-ink2 hover:bg-bg3 hover:text-ink transition-colors flex items-center gap-1.5 flex-shrink-0"
                          title={t('dash.submit.browse')}
                        >
                          <FolderOpen size={12} />
                          {t('dash.submit.browse')}
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          accept=".ts,.tsx,.js,.jsx,.py,.go,.rs,.java,.vue,.rb,.php,.c,.cpp,.h,.cs,.swift,.kt,.scala"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFilePick(file);
                            e.target.value = '';
                          }}
                        />
                      </div>
                      <datalist id="file-path-suggestions">
                        {knownPaths.map((p) => <option key={p} value={p} />)}
                      </datalist>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-1">{t('dash.submit.source')}</label>
                      <select className="select" disabled>
                        <option>{t('dash.submit.source.ai')}</option>
                      </select>
                    </div>
                  </div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-1">{t('dash.submit.code')}</label>
                  <textarea
                    className="input h-48 font-mono text-[11px]"
                    placeholder={t('dash.submit.code.ph')}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                  <div className="flex justify-end mt-3">
                    <Button variant="primary" icon={submitting ? Loader2 : Upload} onClick={submit} disabled={submitting}>
                      {submitting ? t('dash.submit.scoring') : t('dash.submit.run')}
                    </Button>
                  </div>
                  {error && <div className="mt-2 text-xs text-bad">{error}</div>}
                </>
              ) : (
                <BatchPanel onScored={load} />
              )}
            </CardSection>
          </Card>

          {/* Trend chart */}
          <Card>
            <CardSection>
              <div className="flex items-center justify-between mb-4">
                <h2>{t('dash.trend.title')}</h2>
                <Chip tone="default">{data?.history.length ?? 0} {t('dash.trend.sub')}</Chip>
              </div>
              {data && data.history.length > 0 ? (
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={[...data.history].reverse().map((h, i) => ({
                      n: `#${i + 1}`,
                      Overall: h.overall,
                      Style: h.styleScore,
                      Security: h.securityScore,
                      Test: h.testScore,
                      Arch: h.archScore,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                      <XAxis dataKey="n" stroke="#a1a1aa" fontSize={11} />
                      <YAxis stroke="#a1a1aa" fontSize={11} domain={[0, 100]} />
                      <Tooltip contentStyle={{ background: '#09090b', border: 'none', borderRadius: 6, color: 'white', fontSize: 12 }} />
                      <Line type="monotone" dataKey="Overall" stroke="#09090b" strokeWidth={2} />
                      <Line type="monotone" dataKey="Style" stroke="#2563eb" strokeWidth={1.5} />
                      <Line type="monotone" dataKey="Security" stroke="#dc2626" strokeWidth={1.5} />
                      <Line type="monotone" dataKey="Test" stroke="#16a34a" strokeWidth={1.5} />
                      <Line type="monotone" dataKey="Arch" stroke="#7c3aed" strokeWidth={1.5} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState icon={TrendingUp} title={t('dash.empty.history')} desc={t('dash.empty.history.sub')} />
              )}
            </CardSection>
          </Card>

          {/* Radar */}
          {latest && (
            <Card>
              <CardSection>
                <h2 className="mb-4">{t('dash.radar.title')}</h2>
                <div style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={[
                      { dim: t('dash.style'), score: latest.styleScore },
                      { dim: t('dash.security'), score: latest.securityScore },
                      { dim: t('dash.test'), score: latest.testScore },
                      { dim: t('dash.archFull'), score: latest.archScore },
                    ]}>
                      <PolarGrid stroke="#e4e4e7" />
                      <PolarAngleAxis dataKey="dim" tick={{ fill: '#3f3f46', fontSize: 11 }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#a1a1aa', fontSize: 10 }} />
                      <Radar dataKey="score" stroke="#09090b" fill="#09090b" fillOpacity={0.2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardSection>
            </Card>
          )}
        </div>

        {/* Right: recent samples + rule stats */}
        <div className="space-y-6">
          {/* Recent samples */}
          <Card>
            <CardSection>
              <h2 className="mb-3">{t('dash.recent.title')}</h2>
              <div className="space-y-2 max-h-80 overflow-y-auto -mx-2">
                {data?.samples.map((s) => {
                  const passCount = s.events.filter((e) => e.passed).length;
                  const total = s.events.length;
                  const passRate = total > 0 ? Math.round((passCount / total) * 100) : 0;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSample(s.id)}
                      className={`w-full text-left px-3 py-2 rounded transition-colors ${
                        selectedSample === s.id ? 'bg-black text-white' : 'hover:bg-bg2'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Code2 size={11} className={selectedSample === s.id ? 'text-white' : 'text-ink3'} />
                        <span className={`text-xs font-mono truncate flex-1 ${selectedSample === s.id ? 'text-white' : 'text-ink2'}`}>
                          {s.filePath}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`h-1 flex-1 rounded-full ${selectedSample === s.id ? 'bg-white/20' : 'bg-bg3'}`}>
                          <div
                            className={`h-1 rounded-full ${passRate >= 80 ? 'bg-good' : passRate >= 50 ? 'bg-warn' : 'bg-bad'}`}
                            style={{ width: `${passRate}%` }}
                          />
                        </div>
                        <span className={`text-[10px] ${selectedSample === s.id ? 'text-white/70' : 'text-ink3'}`}>
                          {passRate}%
                        </span>
                      </div>
                    </button>
                  );
                })}
                {(!data || data.samples.length === 0) && (
                  <div className="text-center py-6 text-xs text-ink3">{t('dash.empty.samples')}</div>
                )}
              </div>
            </CardSection>
          </Card>

          {/* Selected sample details */}
          {selected && (
            <Card>
              <CardSection>
                <h2 className="mb-1">{selected.filePath}</h2>
                <p className="text-xs text-ink3 mb-3">
                  {selected.events.filter((e) => e.passed).length}/{selected.events.length} {t('dash.recent.rulesPassed')}
                  {new Date(selected.createdAt).toLocaleString()}
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {selected.events.map((ev, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      {ev.passed ? (
                        <CheckCircle2 size={11} className="text-good mt-0.5 flex-shrink-0" />
                      ) : (
                        <AlertTriangle size={11} className={`mt-0.5 flex-shrink-0 text-${ev.severity === 'critical' ? 'bad' : ev.severity === 'warning' ? 'warn' : 'ink3'}`} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-mono ${ev.passed ? 'text-ink3' : 'text-ink2'}`}>{ev.rule}</span>
                          <Chip tone={ev.dimension === 'security' ? 'bad' : ev.dimension === 'test' ? 'good' : ev.dimension === 'arch' ? 'purple' : 'default'}>
                            {ev.dimension}
                          </Chip>
                        </div>
                        {ev.detail && <div className="text-ink3 text-[10px] mt-0.5">{ev.detail}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardSection>
            </Card>
          )}

          {/* Top failing rules */}
          {data && data.ruleStats.length > 0 && (
            <Card>
              <CardSection>
                <h2 className="mb-1">{t('dash.topFailing.title')}</h2>
                <p className="text-xs text-ink3 mb-3">{t('dash.topFailing.sub')}</p>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.ruleStats.slice(0, 6)} layout="vertical">
                      <XAxis type="number" stroke="#a1a1aa" fontSize={10} />
                      <YAxis dataKey="name" type="category" stroke="#a1a1aa" fontSize={10} width={120} />
                      <Tooltip contentStyle={{ background: '#09090b', border: 'none', borderRadius: 6, color: 'white', fontSize: 12 }} />
                      <Bar dataKey="failed" fill="#dc2626" />
                      <Bar dataKey="passed" fill="#16a34a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardSection>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
