'use client';

// ============================================================
// Onboarding Guide — step-by-step tour for first-time users
// Shows automatically on first visit, can be re-triggered
// from the sidebar "Take tour" button.
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { X, ArrowRight, ArrowLeft, GitBranch, Workflow, BarChart3, Settings, Sparkles, Check } from 'lucide-react';
import { Button } from '@/components/ui';
import { useI18n } from '@/components/i18n/I18nProvider';

const STORAGE_KEY = 'hs-onboarding-done';

const STEPS = [
  { icon: GitBranch, href: '/reverse', tone: 'text-accent', bg: 'bg-accent/10' },
  { icon: Workflow, href: '/orchestrate', tone: 'text-purple', bg: 'bg-purple/10' },
  { icon: BarChart3, href: '/dashboard', tone: 'text-good', bg: 'bg-good/10' },
  { icon: Settings, href: '/settings', tone: 'text-ink2', bg: 'bg-bg2' },
] as const;

export function OnboardingGuide() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  // Auto-open on first visit
  useEffect(() => {
    try {
      const done = localStorage.getItem(STORAGE_KEY);
      if (!done) setOpen(true);
    } catch {}
  }, []);

  // Listen for manual trigger from sidebar button
  useEffect(() => {
    const handler = () => { setStep(0); setOpen(true); };
    window.addEventListener('hs-open-onboarding', handler);
    return () => window.removeEventListener('hs-open-onboarding', handler);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
  }, []);

  const next = useCallback(() => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      close();
    }
  }, [step, close]);

  const prev = useCallback(() => {
    if (step > 0) setStep(step - 1);
  }, [step]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, close, next, prev]);

  if (!open) return null;

  const StepIcon = STEPS[step].icon;
  const isLast = step === STEPS.length - 1;
  const stepTitle = t(`onboard.step${step + 1}.title`);
  const stepDesc = t(`onboard.step${step + 1}.desc`);
  const stepCta = t(`onboard.step${step + 1}.cta`);
  const stepHref = STEPS[step].href;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={close}>
      <div
        className="bg-white rounded-t-xl sm:rounded-xl shadow-xl max-w-lg w-full max-h-[92vh] overflow-y-auto safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-accent" />
            <span className="text-sm font-semibold text-ink">{t('onboard.welcome.title')}</span>
          </div>
          <button onClick={close} className="text-ink3 hover:text-ink">
            <X size={16} />
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 px-6 pt-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-black' : 'bg-bg3'}`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${STEPS[step].bg}`}>
              <StepIcon size={22} className={STEPS[step].tone} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-1">
                {t('onboard.step')} {step + 1} {t('onboard.of')} {STEPS.length}
              </div>
              <h3 className="text-lg font-bold text-black mb-2">{stepTitle}</h3>
              <p className="text-sm text-ink2 leading-relaxed">{stepDesc}</p>
            </div>
          </div>

          {/* CTA link */}
          <Link
            href={stepHref}
            onClick={close}
            className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-black transition-colors mt-2"
          >
            {stepCta} <ArrowRight size={12} />
          </Link>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-line bg-bg2">
          <button
            onClick={close}
            className="text-xs text-ink3 hover:text-ink transition-colors"
          >
            {t('onboard.skip')}
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="ghost" icon={ArrowLeft} onClick={prev}>
                {t('onboard.prev')}
              </Button>
            )}
            <Button
              variant="primary"
              icon={isLast ? Check : ArrowRight}
              onClick={next}
            >
              {isLast ? t('onboard.done') : t('onboard.next')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 悬浮球组件 — 固定在右下角，点击触发新手引导
 * 不影响用户使用，悬停时显示提示
 */
export function OnboardingButton() {
  const { t } = useI18n();

  const handleClick = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    window.dispatchEvent(new Event('hs-open-onboarding'));
  };

  return (
    <button
      onClick={handleClick}
      title={t('onboard.fab.tooltip')}
      className="fixed safe-fab z-40 w-11 h-11 min-h-[44px] min-w-[44px] rounded-full bg-black text-white shadow-lg hover:scale-110 hover:shadow-xl transition-all flex items-center justify-center group"
    >
      <Sparkles size={16} className="transition-transform group-hover:rotate-12" />
    </button>
  );
}
