'use client';

// ============================================================
// Pattern Picker — modal to select one of 4 patterns (i18n-aware)
// ============================================================
import { useState } from 'react';
import { X, ArrowRight, Loader2 } from 'lucide-react';
import { Button, Chip } from '@/components/ui';
import { PATTERN_LIST } from '@/lib/orchestrator/patterns';
import { useI18n } from '@/components/i18n/I18nProvider';

interface Props {
  onClose: () => void;
  onPick: (pattern: string, name: string) => Promise<void> | void;
}

export function PatternPicker({ onClose, onPick }: Props) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const pick = async () => {
    if (!selected) return;
    setCreating(true);
    try {
      await onPick(selected, name || `${selected}-loop`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-line sticky top-0 bg-white">
          <div>
            <h2 className="text-black">{t('pp.title')}</h2>
            <p className="text-xs text-ink3 mt-0.5">{t('pp.sub')}</p>
          </div>
          <button onClick={onClose} className="text-ink3 hover:text-ink"><X size={18} /></button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {PATTERN_LIST.map((p) => {
            const active = selected === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className={`text-left p-5 rounded-lg border-2 transition-all ${
                  active ? 'border-black bg-bg2' : 'border-line hover:border-ink3 bg-white'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-black">{p.name}</h3>
                  {active && <Chip tone="dark">{t('pp.selected')}</Chip>}
                </div>
                <p className="text-xs text-ink2 mb-3">{p.tagline}</p>
                <p className="text-xs text-ink3 leading-relaxed mb-3">{p.description}</p>
                <div className="border-t border-line pt-3 mt-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-1.5">{t('pp.whenToUse')}</div>
                  <ul className="text-xs text-ink2 space-y-1">
                    {p.whenToUse.map((w, i) => <li key={i}>• {w}</li>)}
                  </ul>
                </div>
                <div className="border-t border-line pt-3 mt-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-1.5">{t('pp.scaffold')}</div>
                  <div className="text-xs text-ink2">{p.nodes.length} {t('pp.scaffold.agents')} · {p.edges.length} {t('pp.scaffold.edges')}</div>
                </div>
              </button>
            );
          })}
        </div>

        {selected && (
          <div className="p-6 border-t border-line bg-bg2">
            <label className="block text-xs font-semibold text-ink2 mb-2">{t('pp.loopName')}</label>
            <input
              className="input mb-4"
              placeholder={t('pp.loopName.ph')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>{t('pp.cancel')}</Button>
              <Button variant="primary" icon={creating ? Loader2 : ArrowRight} onClick={pick} disabled={creating}>
                {creating ? t('pp.creating') : t('pp.create')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
