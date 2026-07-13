// ============================================================
// Settings — runtime config (i18n via cookie)
// Server component renders current state, client component handles
// provider selection / model override / connection test / 密钥模式切换
// ============================================================
import { Card, CardSection, PageHeader, Chip } from '@/components/ui';
import { Boxes, Database, KeyRound, CheckCircle2 } from 'lucide-react';
import { ALL_PLATFORMS } from '@/lib/orchestrator/compiler';
import { getServerLang, tFor } from '@/lib/i18n/server';
import { providerStatus, PROVIDERS, type Provider } from '@/lib/llm/client';
import { getLLMPrefs, getAllCustomKeys } from '@/lib/llm/prefs';
import { ProviderConfig } from './ProviderConfig';

export default async function SettingsPage() {
  const lang = await getServerLang();
  const t = (k: string) => tFor(lang, k);

  // 读取自定义密钥（用于 providerStatus 判断 + hasCustomKey 映射）
  const customKeys = await getAllCustomKeys();
  const providers = providerStatus(customKeys).map((p) => ({
    ...p,
    hasEnvKey: !!process.env[PROVIDERS[p.provider].envKey],
  }));
  const { provider: currentProvider, model: currentModel, keyMode } = await getLLMPrefs();
  const configuredCount = providers.filter((p) => p.configured).length;

  // 构建 hasCustomKey 映射（仅布尔值，不含密钥本身）
  const hasCustomKey = Object.fromEntries(
    (Object.keys(PROVIDERS) as Provider[]).map((id) => [id, !!customKeys[id]])
  ) as Record<Provider, boolean>;

  const defaultKeyAvailable = !!process.env.DEEPSEEK_API_KEY;

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

            {/* 默认密钥可用 banner：DEEPSEEK_API_KEY 环境变量存在时显示 */}
            {defaultKeyAvailable && (
              <div className="mb-4 p-3 rounded-md bg-good/5 border border-good/20 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-good flex-shrink-0" />
                <span className="text-xs text-ink2">
                  {t('set.ai.defaultAvailable')} — DeepSeek · {t('set.ai.keyMode.defaultSub')}
                </span>
              </div>
            )}

            <ProviderConfig
              providers={providers}
              currentProvider={currentProvider}
              currentModel={currentModel}
              hasCustomKey={hasCustomKey}
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
                keyMode: t('set.ai.keyMode'),
                keyModeDefault: t('set.ai.keyMode.default'),
                keyModeCustom: t('set.ai.keyMode.custom'),
                keyModeDefaultSub: t('set.ai.keyMode.defaultSub'),
                keyModeCustomSub: t('set.ai.keyMode.customSub'),
                customKey: t('set.ai.customKey'),
                customKeyPh: t('set.ai.customKey.ph'),
                customKeyHint: t('set.ai.customKey.hint'),
                noKey: t('set.ai.noKey'),
                defaultAvailable: t('set.ai.defaultAvailable'),
                keySaved: t('set.ai.keySaved'),
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
