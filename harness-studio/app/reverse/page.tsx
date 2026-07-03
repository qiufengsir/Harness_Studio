'use client';

// ============================================================
// Reverse Engineering — Import Page (i18n-aware)
// Drag-and-drop files OR paste code with path markers.
// On submit → POST /api/analyze → redirect to /reverse/[id]
// ============================================================
import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileCode, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardSection, Button, PageHeader, Chip } from '@/components/ui';
import { useI18n } from '@/components/i18n/I18nProvider';

export default function ReverseImportPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [projectName, setProjectName] = useState('');
  const [files, setFiles] = useState<{ path: string; content: string }[]>([]);
  const [pastedText, setPastedText] = useState('');
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const totalLines = files.reduce((s, f) => s + f.content.split('\n').length, 0);

  const handleFileDrop = useCallback(async (dropped: FileList | null) => {
    if (!dropped || dropped.length === 0) return;
    setError(null);
    const collected: { path: string; content: string }[] = [];
    for (const file of Array.from(dropped)) {
      try {
        const text = await file.text();
        collected.push({ path: (file as any).webkitRelativePath || file.name, content: text });
      } catch {
        // skip binary
      }
    }
    setFiles((prev) => [...prev, ...collected]);
    if (!projectName && collected.length > 0) {
      const first = collected[0].path.split('/')[0];
      setProjectName(first.replace(/[^a-zA-Z0-9-_]/g, '-') || 'my-project');
    }
  }, [projectName]);

  const parsePasted = useCallback(() => {
    const blocks: { path: string; content: string }[] = [];
    const fenceRe = /```path:([^\n]+)\n([\s\S]*?)```/g;
    let m;
    while ((m = fenceRe.exec(pastedText)) !== null) {
      blocks.push({ path: m[1].trim(), content: m[2].trim() });
    }
    if (blocks.length === 0 && pastedText.trim()) {
      blocks.push({ path: 'pasted-file.ts', content: pastedText.trim() });
    }
    setFiles((prev) => [...prev, ...blocks]);
  }, [pastedText]);

  const submit = useCallback(async () => {
    if (files.length === 0) {
      setError(t('rev.err.noFiles'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files,
          projectName: projectName || 'untitled-project',
          source: 'upload',
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || 'Analyze failed');
      }
      const data = await res.json();
      router.push(`/reverse/${data.analysisId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [files, projectName, router, t]);

  return (
    <div>
      <PageHeader
        title={t('rev.title')}
        desc={t('rev.desc')}
        actions={<Chip tone="accent">{t('rev.module')}</Chip>}
      />

      {/* Why this matters */}
      <Card className="mb-6 bg-bg2 border-line">
        <CardSection className="py-3">
          <div className="flex items-start gap-3 text-sm text-ink2">
            <AlertCircle size={16} className="text-accent mt-0.5 flex-shrink-0" />
            <p>
              <strong className="text-black">{t('rev.banner.strong')}</strong>
              {t('rev.banner.text')}
            </p>
          </div>
        </CardSection>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload zone */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardSection>
              <label className="block text-xs font-semibold text-ink2 mb-2">{t('rev.projectName')}</label>
              <input
                className="input"
                placeholder="my-project"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </CardSection>
          </Card>

          <Card>
            <CardSection>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-semibold text-ink2">{t('rev.dropFiles')}</label>
                <span className="text-xs text-ink3">{files.length} {t('rev.files')} · {totalLines} {t('rev.lines')}</span>
              </div>
              <div
                className={`dropzone ${dragging ? 'drag' : ''}`}
                onClick={() => fileInput.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  handleFileDrop(e.dataTransfer.files);
                }}
              >
                <Upload size={20} className="mx-auto mb-2 text-ink3" />
                <div className="text-sm font-medium text-ink2 mb-1">{t('rev.drop.title')}</div>
                <div className="text-xs text-ink3">{t('rev.drop.sub')}</div>
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileDrop(e.target.files)}
                />
              </div>
            </CardSection>
          </Card>

          <Card>
            <CardSection>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-semibold text-ink2">{t('rev.paste')}</label>
                <Button size="sm" variant="ghost" onClick={parsePasted}>{t('rev.parse')}</Button>
              </div>
              <textarea
                className="input h-32"
                placeholder={`\`\`\`path:src/foo.ts\nexport const foo = () => 'bar';\n\`\`\`\n\n\`\`\`path:src/bar.ts\nconsole.log('hello');\n\`\`\``}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
              />
            </CardSection>
          </Card>

          {files.length > 0 && (
            <Card>
              <CardSection>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-semibold text-ink2">{t('rev.loaded')} ({files.length})</label>
                  <Button size="sm" variant="ghost" onClick={() => setFiles([])}>{t('rev.clear')}</Button>
                </div>
                <div className="max-h-64 overflow-y-auto -mx-2">
                  {files.slice(0, 50).map((f, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-bg2 rounded">
                      <FileCode size={12} className="text-ink3 flex-shrink-0" />
                      <span className="font-mono text-ink2 truncate flex-1">{f.path}</span>
                      <span className="text-ink3">{f.content.split('\n').length}L</span>
                    </div>
                  ))}
                  {files.length > 50 && (
                    <div className="text-xs text-ink3 text-center py-2">+{files.length - 50}</div>
                  )}
                </div>
              </CardSection>
            </Card>
          )}
        </div>

        {/* Submit panel */}
        <div>
          <Card className="sticky top-8">
            <CardSection>
              <h3 className="mb-3">{t('rev.plan.title')}</h3>
              <div className="space-y-2 text-xs text-ink2 mb-4">
                <PlanRow label={t('rev.plan.files')} value={String(files.length)} />
                <PlanRow label={t('rev.plan.lines')} value={totalLines.toLocaleString()} />
                <PlanRow label={t('rev.plan.detectors')} value="8" />
                <PlanRow label={t('rev.plan.platforms')} value="5" />
              </div>
              <div className="border-t border-line pt-4 mt-4 space-y-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-2">{t('rev.plan.will')}</div>
                {['TypeScript `any` usage', 'React useEffect leaks', 'Missing tests', 'Hardcoded secrets', 'SQL injection risks', 'Console.log pollution', 'Async without try/catch', 'Missing docs'].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-xs text-ink2">
                    <div className="w-1 h-1 rounded-full bg-ink3" />
                    {item}
                  </div>
                ))}
              </div>
              <Button
                variant="primary"
                className="w-full mt-6 justify-center"
                disabled={files.length === 0 || loading}
                onClick={submit}
                icon={loading ? Loader2 : undefined}
              >
                {loading ? t('rev.analyzing') : t('rev.analyze')}
              </Button>
              {error && (
                <div className="mt-3 text-xs text-bad flex items-start gap-2">
                  <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              )}
            </CardSection>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PlanRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink3">{label}</span>
      <span className="font-mono text-ink font-medium">{value}</span>
    </div>
  );
}
