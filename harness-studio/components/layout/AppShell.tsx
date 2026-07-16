'use client';

// ============================================================
// App Shell — responsive sidebar (desktop) / drawer (mobile)
// Black/white professional style, 3-module navigation
// ============================================================
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Boxes, GitBranch, Workflow, BarChart3, Settings, Languages, Menu, X } from 'lucide-react';
import { cn } from '../ui';
import { useI18n } from '@/components/i18n/I18nProvider';
import { OnboardingGuide, OnboardingButton } from '@/components/onboarding/OnboardingGuide';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t, lang, toggle } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);

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

  // Close drawer on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Lock body scroll + Escape when drawer is open
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const brand = (
    <Link href="/" className="flex items-center gap-2 group" onClick={() => setMenuOpen(false)}>
      <div className="w-7 h-7 rounded-md bg-black flex items-center justify-center">
        <Boxes size={16} className="text-white" />
      </div>
      <div className="flex flex-col leading-none">
        <span className="font-bold text-black text-sm tracking-tight">{t('app.brand')}</span>
        <span className="text-[10px] text-ink3 mt-0.5">{t('app.tagline')}</span>
      </div>
    </Link>
  );

  const nav = (
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
                onClick={() => setMenuOpen(false)}
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
  );

  const footer = (
    <div className="px-5 py-4 border-t border-line mt-auto space-y-3">
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
      <Link
        href="/settings"
        onClick={() => setMenuOpen(false)}
        className="flex items-center gap-2 text-xs text-ink3 hover:text-ink transition-colors"
      >
        <Settings size={13} />
        {t('nav.settings')}
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur-sm safe-top">
        <div className="flex items-center justify-between gap-3 px-4 h-14">
          {brand}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label={t('nav.menu')}
            aria-expanded={menuOpen}
            className="btn btn-ghost -mr-2 min-h-[44px] min-w-[44px] justify-center"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* Mobile drawer backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/40 transition-opacity md:hidden',
          menuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setMenuOpen(false)}
        aria-hidden={!menuOpen}
      />

      {/* Sidebar / drawer */}
      <aside
        className={cn(
          'bg-white border-r border-line flex flex-col safe-left',
          // Mobile: off-canvas drawer
          'max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:w-[min(18rem,88vw)]',
          'max-md:transition-transform max-md:duration-200 max-md:ease-out',
          menuOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full',
          // Desktop: sticky sidebar
          'md:sticky md:top-0 md:z-auto md:w-64 md:flex-shrink-0 md:h-screen md:overflow-y-auto'
        )}
        aria-label={t('nav.workflow')}
      >
        <div className="px-5 py-4 border-b border-line flex items-center justify-between gap-2">
          <div className="min-w-0">{brand}</div>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label={t('nav.close')}
            className="md:hidden btn btn-ghost min-h-[44px] min-w-[44px] justify-center -mr-2"
          >
            <X size={18} />
          </button>
        </div>
        {nav}
        {footer}
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        <div className="page-pad max-w-7xl mx-auto">{children}</div>
      </main>

      {/* 悬浮球 — 点击触发新手引导 */}
      <OnboardingButton />
      {/* Onboarding guide (auto-shows on first visit) */}
      <OnboardingGuide />
    </div>
  );
}
