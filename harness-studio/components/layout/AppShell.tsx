'use client';

// ============================================================
// App Shell — sidebar nav + main content area + lang switcher
// Black/white professional style, 3-module navigation
// ============================================================
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Boxes, GitBranch, Workflow, BarChart3, Settings, Languages } from 'lucide-react';
import { cn } from '../ui';
import { useI18n } from '@/components/i18n/I18nProvider';
import { OnboardingGuide, OnboardingButton } from '@/components/onboarding/OnboardingGuide';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t, lang, toggle } = useI18n();

  const navGroups = [
    {
      title: t('nav.workflow'),
      items: [
        { href: '/reverse', label: t('nav.reverse'), icon: GitBranch, desc: t('nav.reverse.desc') },
        { href: '/orchestrate', label: t('nav.loops'), icon: Workflow, desc: t('nav.loops.desc') },
        { href: '/dashboard', label: t('nav.dashboard'), icon: BarChart3, desc: t('nav.dashboard.desc') },
      ],
    },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-line bg-white sticky top-0 h-screen overflow-y-auto flex flex-col">
        <div className="px-5 py-4 border-b border-line">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-md bg-black flex items-center justify-center">
              <Boxes size={16} className="text-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-bold text-black text-sm tracking-tight">{t('app.brand')}</span>
              <span className="text-[10px] text-ink3 mt-0.5">{t('app.tagline')}</span>
            </div>
          </Link>
        </div>

        <nav className="py-4 flex-1">
          {navGroups.map((group) => (
            <div key={group.title} className="mb-6">
              <div className="px-5 mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink3">
                {group.title}
              </div>
              {group.items.map((item) => {
                const active = pathname?.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-start gap-3 px-5 py-2.5 mx-2 rounded-md transition-all',
                      active ? 'bg-black text-white' : 'text-ink2 hover:bg-bg2'
                    )}
                  >
                    <Icon size={15} className="mt-0.5 flex-shrink-0" />
                    <div className="flex flex-col leading-tight">
                      <span className="text-[13px] font-medium">{item.label}</span>
                      <span className={cn('text-[10px] mt-0.5', active ? 'text-white/60' : 'text-ink3')}>
                        {item.desc}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-line mt-auto space-y-3">
          {/* Language switcher */}
          <button
            onClick={toggle}
            aria-label={t('lang.toggle')}
            title={t('lang.toggle')}
            className="flex items-center gap-2 text-xs text-ink3 hover:text-ink transition-colors w-full"
          >
            <Languages size={13} />
            <span className="flex items-center gap-1">
              <span className={cn('px-1.5 py-0.5 rounded', lang === 'zh' ? 'bg-black text-white' : 'text-ink3')}>中</span>
              <span className="text-ink3">/</span>
              <span className={cn('px-1.5 py-0.5 rounded', lang === 'en' ? 'bg-black text-white' : 'text-ink3')}>EN</span>
            </span>
          </button>
          <Link href="/settings" className="flex items-center gap-2 text-xs text-ink3 hover:text-ink transition-colors">
            <Settings size={13} />
            {t('nav.settings')}
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        <div className="px-8 py-8 max-w-7xl mx-auto">{children}</div>
      </main>

      {/* 悬浮球 — 右上角，点击触发新手引导 */}
      <OnboardingButton />
      {/* Onboarding guide (auto-shows on first visit) */}
      <OnboardingGuide />
    </div>
  );
}
