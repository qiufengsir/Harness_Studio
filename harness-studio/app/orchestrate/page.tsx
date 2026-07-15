'use client';

// ============================================================
// Orchestrate — Loop List + Pattern Picker (i18n-aware)
// ============================================================
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Workflow, Plus, ArrowRight, Loader2, Trash2, X } from 'lucide-react';
import { Card, CardSection, Button, PageHeader, Chip, EmptyState } from '@/components/ui';
import { PatternPicker, type CreateLoopData } from '@/components/orchestrate/PatternPicker';
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
  // 删除确认状态
  const [deleteTarget, setDeleteTarget] = useState<LoopRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch('/api/loops')
      .then((r) => r.json())
      .then((d) => { setLoops(d.loops ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // 删除循环
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`/api/loops/${deleteTarget.id}`, { method: 'DELETE' });
      setLoops((prev) => prev.filter((l) => l.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      // 静默失败
    } finally {
      setDeleting(false);
    }
  };

  const createLoop = async (data: CreateLoopData) => {
    const res = await fetch('/api/loops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name,
        pattern: data.pattern,
        graph: data.graph,
        agentPrompts: data.agentPrompts,
        description: data.description,
        meta: data.meta,
        action: 'create',
      }),
    });
    const result = await res.json();
    // 缓存到 sessionStorage，防止 Cloudflare Worker 冷启动丢数据
    const cacheData = {
      ...result,
      targets: ['agents', 'claude', 'cursor', 'copilot', 'trae'],
      meta: data.meta ?? null,
      updatedAt: Date.now(),
    };
    try {
      sessionStorage.setItem(`loop_${result.id}`, JSON.stringify(cacheData));
    } catch {
      // sessionStorage 不可用时静默忽略
    }
    // URL 带 pattern 参数，作为 API 404 时的回退
    router.push(`/orchestrate/${result.id}?pattern=${data.pattern}`);
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
            <Card key={loop.id} className="hover:shadow-lg transition-shadow cursor-pointer group" >
              <CardSection className="h-full flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-purple/10 flex items-center justify-center text-purple">
                    <Workflow size={18} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Chip tone="purple">{loop.pattern}</Chip>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(loop); }}
                      className="text-ink3 hover:text-bad transition-colors p-1 rounded"
                      title={t('orch.card.delete')}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
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

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <div className="flex items-center gap-2">
                <Trash2 size={15} className="text-bad" />
                <span className="text-sm font-semibold text-ink">{t('orch.card.confirmDelete')}</span>
              </div>
              <button onClick={() => setDeleteTarget(null)} className="text-ink3 hover:text-ink">
                <X size={15} />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-ink2 mb-1">{t('orch.card.confirmDeleteDesc')}</p>
              <p className="text-sm font-medium text-black mt-3">{deleteTarget.name}</p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-line bg-bg2">
              <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
                {t('orch.card.deleteCancel')}
              </Button>
              <Button variant="primary" icon={deleting ? Loader2 : Trash2} onClick={handleDelete} disabled={deleting}>
                {deleting ? t('orch.card.deleting') : t('orch.card.deleteConfirm')}
              </Button>
            </div>
          </div>
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
