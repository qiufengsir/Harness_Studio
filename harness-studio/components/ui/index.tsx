// ============================================================
// UI primitives — black/white professional style
// ============================================================
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { LucideIcon } from 'lucide-react';
import React from 'react';

export function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(inputs));
}

// ---------- Card ----------
export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('card', className)}>{children}</div>;
}

export function CardSection({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('card-section', className)}>{children}</div>;
}

// ---------- Button ----------
type BtnVariant = 'default' | 'primary' | 'ghost' | 'danger';
export function Button({
  variant = 'default',
  size = 'md',
  className,
  icon: Icon,
  children,
  ...props
}: {
  variant?: BtnVariant;
  size?: 'sm' | 'md';
  icon?: LucideIcon;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const variants: Record<BtnVariant, string> = {
    default: 'btn',
    primary: 'btn btn-primary',
    ghost: 'btn btn-ghost',
    danger: 'btn',
  };
  return (
    <button className={cn(variants[variant], size === 'sm' && 'btn-sm', className)} {...props}>
      {Icon && <Icon size={14} />}
      {children}
    </button>
  );
}

// ---------- Chip ----------
type ChipTone = 'default' | 'good' | 'warn' | 'bad' | 'accent' | 'purple' | 'dark';
export function Chip({ tone = 'default', className, children }: { tone?: ChipTone; className?: string; children: React.ReactNode }) {
  const tones: Record<ChipTone, string> = {
    default: 'chip',
    good: 'chip chip-good',
    warn: 'chip chip-warn',
    bad: 'chip chip-bad',
    accent: 'chip chip-accent',
    purple: 'chip chip-purple',
    dark: 'chip chip-dark',
  };
  return <span className={cn(tones[tone], className)}>{children}</span>;
}

// ---------- Empty State ----------
export function EmptyState({ icon: Icon, title, desc, action }: { icon: LucideIcon; title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 sm:py-20 px-2 text-center">
      <div className="w-12 h-12 rounded-full bg-bg2 flex items-center justify-center mb-4">
        <Icon size={20} className="text-ink3" />
      </div>
      <h2 className="mb-1">{title}</h2>
      {desc && <p className="text-ink3 text-sm max-w-md mb-4 leading-relaxed">{desc}</p>}
      {action}
    </div>
  );
}

// ---------- Page Header ----------
export function PageHeader({ title, desc, actions }: { title: string; desc?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6">
      <div className="min-w-0">
        <h1 className="mb-1">{title}</h1>
        {desc && <p className="text-ink3 text-sm leading-relaxed">{desc}</p>}
      </div>
      {actions && <div className="row shrink-0">{actions}</div>}
    </div>
  );
}

// ---------- Stat ----------
export function Stat({ label, value, delta, tone = 'default' }: { label: string; value: string | number; delta?: string; tone?: ChipTone }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-ink3 mb-1.5">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-black tracking-tight">{value}</span>
        {delta && <Chip tone={tone}>{delta}</Chip>}
      </div>
    </div>
  );
}

// ---------- Tabs ----------
export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="scroll-x flex gap-1 border-b border-line -mx-1 px-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'px-3 sm:px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap shrink-0 min-h-[44px]',
            active === t.id ? 'border-black text-black' : 'border-transparent text-ink3 hover:text-ink'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
