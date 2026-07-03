'use client';

// ============================================================
// Dashboard — AI Code Quality Metrics (i18n-aware)
// Closed loop: submit AI code → score → see trend → adjust configs
// ============================================================
import { useEffect, useState, useCallback } from 'react';
import { BarChart3, Upload, TrendingUp, AlertTriangle, CheckCircle2, Loader2, Code2 } from 'lucide-react';
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
          {/* Submit form */}
          <Card>
            <CardSection>
              <h2 className="mb-1">{t('dash.submit.title')}</h2>
              <p className="text-xs text-ink3 mb-4">{t('dash.submit.sub')}</p>
              <div className="grid-2 gap-3 mb-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-1">{t('dash.submit.filePath')}</label>
                  <input className="input" placeholder={t('dash.submit.filePath.ph')} value={filePath} onChange={(e) => setFilePath(e.target.value)} />
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
