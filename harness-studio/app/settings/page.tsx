// ============================================================
// Settings — runtime config (i18n via cookie)
// Server component renders current state, client component handles
// provider selection / model override / connection test
// ============================================================
import { Card, CardSection, PageHeader, Chip } from '@/components/ui';
import { Boxes, Database, KeyRound } from 'lucide-react';
import { ALL_PLATFORMS } from '@/lib/orchestrator/compiler';
import { getServerLang, tFor } from '@/lib/i18n/server';
import { providerStatus } from '@/lib/llm/client';
import { getLLMPrefs } from '@/lib/llm/prefs';
import { ProviderConfig } from './ProviderConfig';

export default async function SettingsPage() {
  const lang = await getServerLang();
  const t = (k: string) => tFor(lang, k);

  const providers = providerStatus();
  const { provider: currentProvider, model: currentModel } = await getLLMPrefs();
  const configuredCount = providers.filter((p) => p.configured).length;

  return (
    <div>
      <PageHeader
        title={t('set.title')}
        desc={t('set.desc')}
        actions={<Chip tone="default">v2.1</Chip>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Provider Config */}
        <Card className="lg:col-span-2">
          <CardSection>
            <div className="flex items-center gap-2 mb-3">
              <KeyRound size={14} className="text-ink2" />
              <h2>{t('set.ai.title')}</h2>
              <Chip tone={configuredCount > 0 ? 'good' : 'warn'}>
                {configuredCount}/{providers.length} {t('set.ai.configured')}
              </Chip>
            </div>
            <p className="text-xs text-ink3 mb-4">{t('set.ai.sub')}</p>

            {/* Demo mode banner */}
            {process.env.DEMO_MODE === 'true' && (
              <div className="mb-4 p-3 rounded-md bg-good/5 border border-good/20 flex items-center gap-2">
                <span className="text-good text-xs">✓</span>
                <span className="text-xs text-ink2">
                  Demo mode: AI provider is pre-configured. No API key needed — just start exploring!
                </span>
              </div>
            )}

            <ProviderConfig
              providers={providers}
              currentProvider={currentProvider}
              currentModel={currentModel}
              labels={{
                default: t('set.ai.default'),
                defaultSub: t('set.ai.default.sub'),
                model: t('set.ai.model'),
                modelPh: t('set.ai.model.ph'),
                test: t('set.ai.test'),
                testing: t('set.ai.testing'),
                testOk: t('set.ai.test.ok'),
                testFail: t('set.ai.test.fail'),
                configured: t('set.ai.configured'),
                notConfigured: t('set.ai.notConfigured'),
                envkey: t('set.ai.envkey'),
                regionCn: t('set.ai.region.cn'),
                regionGlobal: t('set.ai.region.global'),
                docs: t('set.ai.docs'),
                refresh: t('set.ai.refresh'),
                needRestart: t('set.ai.needRestart'),
                current: t('set.ai.current'),
                pickFirst: t('set.ai.pickFirst'),
                save: t('set.ai.save'),
                saved: t('set.ai.saved'),
              }}
            />
          </CardSection>
        </Card>

        <Card>
          <CardSection>
            <div className="flex items-center gap-2 mb-3">
              <Boxes size={14} className="text-ink2" />
              <h2>{t('set.targets.title')}</h2>
            </div>
            <p className="text-xs text-ink3 mb-4">{t('set.targets.sub')}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {ALL_PLATFORMS.map((p) => (
                <Chip key={p} tone="dark">{p}</Chip>
              ))}
            </div>
          </CardSection>
        </Card>

        <Card>
          <CardSection>
            <div className="flex items-center gap-2 mb-3">
              <Database size={14} className="text-ink2" />
              <h2>{t('set.storage.title')}</h2>
            </div>
            <p className="text-xs text-ink3 mb-4">{t('set.storage.sub')}</p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-ink3">{t('set.storage.path')}</span><code>./dev.db</code></div>
              <div className="flex justify-between"><span className="text-ink3">drizzle-kit</span><code>db:push / db:studio</code></div>
            </div>
          </CardSection>
        </Card>

        <Card>
          <CardSection>
            <h2 className="mb-3">{t('set.about.title') || 'About'}</h2>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-ink3">{t('set.about.v')}</span><code>2.1.0</code></div>
              <div className="flex justify-between"><span className="text-ink3">{t('set.about.stack')}</span><code>Next.js 16 · React 19 · better-sqlite3</code></div>
            </div>
          </CardSection>
        </Card>
      </div>
    </div>
  );
}
