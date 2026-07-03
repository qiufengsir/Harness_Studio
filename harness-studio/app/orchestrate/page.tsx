'use client';

// ============================================================
// Orchestrate — Loop List + Pattern Picker (i18n-aware)
// ============================================================
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Workflow, Plus, ArrowRight, Loader2 } from 'lucide-react';
import { Card, CardSection, Button, PageHeader, Chip, EmptyState } from '@/components/ui';
import { PatternPicker } from '@/components/orchestrate/PatternPicker';
import { useI18n } from '@/components/i18n/I18nProvider';

interface LoopRow {
  id: string;
  name: string;
  description: string | null;
  pattern: string;
  graph: { nodes: any[]; edges: any[] };
  targets: string[];
  updatedAt: number;
}

export default function OrchestratePage() {
  const { t } = useI18n();
  const router = useRouter();
  const [loops, setLoops] = useState<LoopRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    fetch('/api/loops')
      .then((r) => r.json())
      .then((d) => { setLoops(d.loops ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const createLoop = async (pattern: string, name: string) => {
    const res = await fetch('/api/loops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, pattern, action: 'create' }),
    });
    const data = await res.json();
    router.push(`/orchestrate/${data.id}`);
  };

  return (
    <div>
      <PageHeader
        title={t('orch.title')}
        desc={t('orch.desc')}
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setShowPicker(true)}>
            {t('orch.new')}
          </Button>
        }
      />

      {/* Educational banner */}
      <Card className="mb-6 bg-bg2 border-line">
        <CardSection className="py-3">
          <div className="flex items-start gap-3 text-sm text-ink2">
            <Workflow size={16} className="text-purple mt-0.5 flex-shrink-0" />
            <p>
              <strong className="text-black">{t('orch.banner.strong')}</strong>
              {t('orch.banner.text')}
            </p>
          </div>
        </CardSection>
      </Card>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-ink3" size={20} />
        </div>
      ) : loops.length === 0 && !showPicker ? (
        <EmptyState
          icon={Workflow}
          title={t('orch.empty.title')}
          desc={t('orch.empty.desc')}
          action={<Button variant="primary" icon={Plus} onClick={() => setShowPicker(true)}>{t('orch.empty.cta')}</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loops.map((loop) => (
            <Card key={loop.id} className="hover:shadow-lg transition-shadow cursor-pointer" >
              <CardSection className="h-full flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-purple/10 flex items-center justify-center text-purple">
                    <Workflow size={18} />
                  </div>
                  <Chip tone="purple">{loop.pattern}</Chip>
                </div>
                <h3 className="text-black mb-1">{loop.name}</h3>
                <p className="text-xs text-ink3 mb-3 flex-1">{loop.description ?? t('orch.noDesc')}</p>
                <div className="flex items-center justify-between pt-3 border-t border-line">
                  <div className="text-xs text-ink3">
                    {loop.graph.nodes?.length ?? 0} {t('orch.card.agents')} · {loop.targets.length} {t('orch.card.platforms')}
                  </div>
                  <button
                    onClick={() => router.push(`/orchestrate/${loop.id}`)}
                    className="text-xs font-medium text-accent flex items-center gap-1 hover:gap-1.5 transition-all"
                  >
                    {t('orch.card.open')} <ArrowRight size={11} />
                  </button>
                </div>
              </CardSection>
            </Card>
          ))}
        </div>
      )}

      {showPicker && (
        <PatternPicker
          onClose={() => setShowPicker(false)}
          onPick={createLoop}
        />
      )}
    </div>
  );
}
