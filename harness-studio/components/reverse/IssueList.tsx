'use client';

// ============================================================
// Issue List — grouped by severity, expandable per file
// ============================================================
import { useState } from 'react';
import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardSection, Chip } from '@/components/ui';

interface Issue {
  rule: string;
  severity: 'critical' | 'warning' | 'info';
  file: string;
  line: number;
  detail: string;
  fixKind: string;
  fixName: string;
  fixDescription: string;
}

export function IssueList({ issues }: { issues: Issue[] }) {
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const filtered = filter === 'all' ? issues : issues.filter((i) => i.severity === filter);

  // Group by file
  const byFile = new Map<string, Issue[]>();
  for (const iss of filtered) {
    if (!byFile.has(iss.file)) byFile.set(iss.file, []);
    byFile.get(iss.file)!.push(iss);
  }

  return (
    <Card>
      <CardSection>
        <div className="flex items-center justify-between mb-4">
          <h2>Issues found</h2>
          <div className="flex gap-1">
            {(['all', 'critical', 'warning', 'info'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 text-xs rounded transition-colors ${
                  filter === f ? 'bg-black text-white' : 'text-ink3 hover:bg-bg2'
                }`}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {Array.from(byFile.entries()).map(([file, fileIssues]) => {
            const isOpen = expanded[file] ?? true;
            return (
              <div key={file} className="border border-line rounded-md overflow-hidden">
                <button
                  onClick={() => setExpanded((p) => ({ ...p, [file]: !isOpen }))}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-bg2 hover:bg-bg3 transition-colors text-left"
                >
                  {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <span className="font-mono text-xs text-ink2 flex-1 truncate">{file}</span>
                  <Chip>{fileIssues.length}</Chip>
                </button>
                {isOpen && (
                  <div className="divide-y divide-line">
                    {fileIssues.map((iss, i) => (
                      <IssueRow key={i} issue={iss} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {byFile.size === 0 && (
            <div className="text-center py-8 text-sm text-ink3">
              No issues in this filter.
            </div>
          )}
        </div>
      </CardSection>
    </Card>
  );
}

function IssueRow({ issue }: { issue: Issue }) {
  const sevConfig = {
    critical: { Icon: AlertTriangle, tone: 'bad' as const, label: 'Critical' },
    warning: { Icon: AlertCircle, tone: 'warn' as const, label: 'Warning' },
    info: { Icon: Info, tone: 'default' as const, label: 'Info' },
  }[issue.severity];

  const { Icon, tone, label } = sevConfig;

  return (
    <div className="px-3 py-3">
      <div className="flex items-start gap-3">
        <Icon size={14} className={`mt-0.5 flex-shrink-0 text-${tone === 'default' ? 'ink3' : tone}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-ink3">
              {issue.line > 0 ? `L${issue.line}` : '—'}
            </span>
            <Chip tone={tone === 'default' ? 'default' : tone}>{label}</Chip>
            <span className="text-xs font-mono text-ink3">{issue.rule}</span>
          </div>
          <p className="text-sm text-ink2 mb-2">{issue.detail}</p>
          <div className="text-xs text-ink3 bg-bg2 rounded px-2 py-1.5 inline-block">
            <span className="font-medium text-ink2">Fix:</span> {issue.fixDescription}
          </div>
        </div>
      </div>
    </div>
  );
}
