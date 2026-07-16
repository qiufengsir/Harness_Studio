// ============================================================
// Landing — product positioning (server component, i18n via cookie)
// ============================================================
import Link from 'next/link';
import { GitBranch, Workflow, BarChart3, ArrowRight, Sparkles } from 'lucide-react';
import { Card, CardSection, Button } from '@/components/ui';
import { getServerLang, tFor } from '@/lib/i18n/server';

export default async function LandingPage() {
  const lang = await getServerLang();
  const t = (k: string) => tFor(lang, k);

  return (
    <div>
      {/* Hero */}
      <div className="mb-8 sm:mb-12">
        <div className="inline-flex items-center gap-1.5 chip chip-accent mb-4">
          <Sparkles size={11} />
          <span>{t('land.badge')}</span>
        </div>
        <h1 className="text-[1.75rem] sm:text-3xl md:text-4xl font-bold tracking-tight text-black mb-3 max-w-2xl leading-snug">
          {t('land.h1.l1')}<br />
          {t('land.h1.l2')}<span className="text-accent">{t('land.h1.l3')}</span>{t('land.h1.l4')}
        </h1>
        <p className="text-ink2 text-[0.9375rem] sm:text-base max-w-xl mb-6 leading-relaxed prose-read">
          {t('land.lead')}
        </p>
        <div className="row">
          <Link href="/reverse" className="w-full sm:w-auto">
            <Button variant="primary" icon={ArrowRight} className="w-full sm:w-auto justify-center">
              {t('land.cta.primary')}
            </Button>
          </Link>
          <Link href="/demo" className="w-full sm:w-auto">
            <Button variant="ghost" icon={Sparkles} className="w-full sm:w-auto justify-center">
              {t('land.cta.secondary')}
            </Button>
          </Link>
        </div>
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
          <span className="text-xs text-ink3">{t('land.demo')}</span>
          <span className="text-xs text-ink3">{t('land.demoSub')}</span>
        </div>
      </div>

      {/* Why this exists */}
      <Card className="mb-12">
        <CardSection>
          <div className="grid-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-bad mb-2">{t('land.problem.label')}</div>
              <p className="text-sm text-ink2">{t('land.problem.text')}</p>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-accent mb-2">{t('land.shift.label')}</div>
              <p className="text-sm text-ink2">{t('land.shift.text')}</p>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-good mb-2">{t('land.outcome.label')}</div>
              <p className="text-sm text-ink2">{t('land.outcome.text')}</p>
            </div>
          </div>
        </CardSection>
      </Card>

      {/* Three modules */}
      <div className="mb-6">
        <h2 className="mb-1">{t('land.modules.title')}</h2>
        <p className="text-ink3 text-sm">{t('land.modules.sub')}</p>
      </div>

      <div className="grid-3 mb-12">
        <ModuleCard
          num="01"
          icon={GitBranch}
          title={t('land.m1.title')}
          desc={t('land.m1.desc')}
          href="/reverse"
          tone="accent"
          openLabel={t('land.module.open')}
        />
        <ModuleCard
          num="02"
          icon={Workflow}
          title={t('land.m2.title')}
          desc={t('land.m2.desc')}
          href="/orchestrate"
          tone="purple"
          openLabel={t('land.module.open')}
        />
        <ModuleCard
          num="03"
          icon={BarChart3}
          title={t('land.m3.title')}
          desc={t('land.m3.desc')}
          href="/dashboard"
          tone="good"
          openLabel={t('land.module.open')}
        />
      </div>

      {/* Footnote */}
      <div className="text-center text-xs text-ink3 pt-8 border-t border-line">
        {t('land.foot')}
      </div>
    </div>
  );
}

function ModuleCard({
  num, icon: Icon, title, desc, href, tone, openLabel,
}: {
  num: string; icon: typeof GitBranch; title: string; desc: string; href: string;
  tone: 'accent' | 'purple' | 'good'; openLabel: string;
}) {
  const toneClass = { accent: 'text-accent', purple: 'text-purple', good: 'text-good' }[tone];
  return (
    <Link href={href} className="block">
      <Card className="hover:shadow-lg transition-shadow h-full">
        <CardSection className="h-full flex flex-col">
          <div className="flex items-start justify-between mb-4">
            <div className={`w-10 h-10 rounded-lg bg-bg2 flex items-center justify-center ${toneClass}`}>
              <Icon size={18} />
            </div>
            <span className="text-xs font-mono text-ink3">{num}</span>
          </div>
          <h3 className="text-black mb-2">{title}</h3>
          <p className="text-sm text-ink3 leading-relaxed flex-1">{desc}</p>
          <div className={`mt-4 text-xs font-medium ${toneClass} flex items-center gap-1`}>
            {openLabel} <ArrowRight size={12} />
          </div>
        </CardSection>
      </Card>
    </Link>
  );
}
