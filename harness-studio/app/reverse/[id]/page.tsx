// ============================================================
// Reverse Engineering — Result Page (server component, i18n via cookie)
// ============================================================
import { getDB } from '@/lib/db/client';
import { codeAnalysis, recommendations, projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, ArrowRight, FileCode, Workflow } from 'lucide-react';
import { Card, CardSection, Chip, PageHeader, Button } from '@/components/ui';
import { RecommendationView } from '@/components/reverse/RecommendationView';
import { IssueList } from '@/components/reverse/IssueList';
import { getServerLang, tFor } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lang = await getServerLang();
  const t = (k: string) => tFor(lang, k);

  const db = getDB();
  const analysis = db.select().from(codeAnalysis).where(eq(codeAnalysis.id, id)).get();
  if (!analysis) notFound();

  const project = db.select().from(projects).where(eq(projects.id, analysis.projectId)).get();
  const recs = db.select().from(recommendations).where(eq(recommendations.analysisId, id)).all();

  const issues = JSON.parse(analysis.issues) as any[];
  const languages = JSON.parse(analysis.languages) as string[];
  const frameworks = JSON.parse(analysis.frameworks) as string[];
  const archPatterns = analysis.archPatterns ? JSON.parse(analysis.archPatterns) : [];

  const critical = issues.filter((i) => i.severity === 'critical').length;
  const warning = issues.filter((i) => i.severity === 'warning').length;
  const info = issues.filter((i) => i.severity === 'info').length;

  return (
    <div>
      <PageHeader
        title={`${t('rev.result.title')}${project?.name ?? 'project'}`}
        desc={`${analysis.fileCount} ${t('rev.files')} · ${analysis.lineCount.toLocaleString()} ${t('rev.lines')} · ${new Date(analysis.createdAt).toLocaleString()}`}
        actions={
          <>
            <Link href="/reverse"><Button variant="ghost">{t('rev.result.new')}</Button></Link>
            <Link href="/orchestrate">
              <Button variant="primary" icon={Workflow}>{t('rev.result.buildLoop')}</Button>
            </Link>
          </>
        }
      />

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatBox label={t('rev.result.stat.files')} value={analysis.fileCount} icon={FileCode} tone="default" />
        <StatBox label={t('rev.result.stat.critical')} value={critical} icon={AlertTriangle} tone={critical > 0 ? 'bad' : 'good'} />
        <StatBox label={t('rev.result.stat.warnings')} value={warning} icon={AlertCircle} tone={warning > 0 ? 'warn' : 'good'} />
        <StatBox label={t('rev.result.stat.recs')} value={recs.length} icon={CheckCircle2} tone="accent" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: issues */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tech stack detected */}
          <Card>
            <CardSection>
              <h2 className="mb-3">{t('rev.result.techStack')}</h2>
              <div className="grid-2 gap-4">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-2">{t('rev.result.languages')}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {languages.map((l) => <Chip key={l} tone="dark">{l}</Chip>)}
                    {languages.length === 0 && <span className="text-xs text-ink3">{t('rev.result.noneDetected')}</span>}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-2">{t('rev.result.frameworks')}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {frameworks.map((f) => <Chip key={f} tone="accent">{f}</Chip>)}
                    {frameworks.length === 0 && <span className="text-xs text-ink3">{t('rev.result.noneDetected')}</span>}
                  </div>
                </div>
              </div>
              {analysis.projectType && (
                <div className="mt-4 pt-4 border-t border-line">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-1">{t('rev.result.projectType')}</div>
                  <span className="text-sm font-medium text-ink">{analysis.projectType}</span>
                </div>
              )}
            </CardSection>
          </Card>

          {/* Issues */}
          <IssueList issues={issues} />
        </div>

        {/* Right: recommendations */}
        <div>
          <Card className="sticky top-8">
            <CardSection>
              <div className="flex items-center justify-between mb-3">
                <h2>{t('rev.result.recs.title')}</h2>
                <Chip tone="accent">{recs.length}</Chip>
              </div>
              <p className="text-xs text-ink3 mb-4">{t('rev.result.recs.sub')}</p>
              <div className="space-y-3 -mx-2">
                {recs.map((rec) => {
                  const payload = JSON.parse(rec.payload);
                  const targets = rec.platformTargets ? JSON.parse(rec.platformTargets) : [];
                  return (
                    <RecommendationView
                      key={rec.id}
                      id={rec.id}
                      kind={rec.kind as any}
                      name={rec.name}
                      reason={rec.reason}
                      severity={rec.severity as any}
                      triggeredBy={0}
                      payload={payload}
                      platforms={targets}
                      accepted={rec.accepted ?? false}
                    />
                  );
                })}
                {recs.length === 0 && (
                  <div className="text-center py-8">
                    <CheckCircle2 size={24} className="mx-auto text-good mb-2" />
                    <p className="text-sm font-medium text-ink">{t('rev.result.recs.empty.title')}</p>
                    <p className="text-xs text-ink3 mt-1">{t('rev.result.recs.empty.sub')}</p>
                  </div>
                )}
              </div>
            </CardSection>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, icon: Icon, tone }: { label: string; value: number | string; icon: typeof FileCode; tone: 'default' | 'good' | 'warn' | 'bad' | 'accent' }) {
  const toneClass = {
    default: 'text-ink3',
    good: 'text-good',
    warn: 'text-warn',
    bad: 'text-bad',
    accent: 'text-accent',
  }[tone];
  return (
    <Card>
      <CardSection className="py-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-ink3">{label}</span>
          <Icon size={14} className={toneClass} />
        </div>
        <div className={`text-2xl font-bold tracking-tight ${toneClass}`}>{value}</div>
      </CardSection>
    </Card>
  );
}
