// ============================================================
// Settings — runtime config (i18n via cookie)
// ============================================================
import { Card, CardSection, PageHeader, Chip, Button } from '@/components/ui';
import { Settings as SettingsIcon, KeyRound, Boxes, Database } from 'lucide-react';
import { ALL_PLATFORMS } from '@/lib/orchestrator/compiler';
import { getServerLang, tFor } from '@/lib/i18n/server';

export default async function SettingsPage() {
  const lang = await getServerLang();
  const t = (k: string) => tFor(lang, k);

  return (
    <div>
      <PageHeader
        title={t('set.title')}
        desc={t('set.desc')}
        actions={<Chip tone="default">v2.0</Chip>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardSection>
            <div className="flex items-center gap-2 mb-3">
              <KeyRound size={14} className="text-ink2" />
              <h2>{t('set.ai.title')}</h2>
            </div>
            <p className="text-xs text-ink3 mb-4">{t('set.ai.sub')}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-1">{t('set.ai.openai')}</label>
                <input className="input font-mono" type="password" placeholder="sk-..." />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-1">{t('set.ai.anthropic')}</label>
                <input className="input font-mono" type="password" placeholder="sk-ant-..." />
              </div>
              <Button variant="primary" icon={SettingsIcon}>{t('set.ai.save')}</Button>
            </div>
            <div className="mt-4 pt-4 border-t border-line text-xs text-ink3">
              {t('set.ai.sub')}
            </div>
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
            <h2 className="mb-3">{t('set.about.title')}</h2>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-ink3">{t('set.about.v')}</span><code>2.0.0</code></div>
              <div className="flex justify-between"><span className="text-ink3">{t('set.about.stack')}</span><code>Next.js 16 · React 19 · better-sqlite3</code></div>
            </div>
          </CardSection>
        </Card>
      </div>
    </div>
  );
}
