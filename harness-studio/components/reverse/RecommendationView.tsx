'use client';

// ============================================================
// Recommendation View — expandable card with accept/decline
// Shows the proposed config payload (agent prompt / rule content / loop pattern)
// ============================================================
import { useState } from 'react';
import { Bot, Wrench, FileText, Plug, Workflow, ChevronDown, ChevronRight, Check, X, Copy } from 'lucide-react';
import { Chip, Button } from '@/components/ui';

interface RecommendationPayload {
  description: string;
  role?: string;
  systemPrompt?: string;
  triggers?: string[];
  steps?: string[];
  globs?: string[];
  ruleContent?: string;
  mcpServer?: string;
  pattern?: string;
}

interface Props {
  id: string;
  kind: 'agent' | 'skill' | 'rule' | 'mcp' | 'loop';
  name: string;
  reason: string;
  severity: 'info' | 'warning' | 'critical';
  triggeredBy: number;
  payload: RecommendationPayload;
  platforms: string[];
  accepted: boolean;
}

const KIND_META: Record<string, { icon: typeof Bot; label: string; tone: 'accent' | 'purple' | 'good' | 'warn' | 'default' }> = {
  agent: { icon: Bot, label: 'Agent', tone: 'accent' },
  skill: { icon: Wrench, label: 'Skill', tone: 'purple' },
  rule: { icon: FileText, label: 'Rule', tone: 'default' },
  mcp: { icon: Plug, label: 'MCP', tone: 'good' },
  loop: { icon: Workflow, label: 'Loop', tone: 'warn' },
};

export function RecommendationView({ id, kind, name, reason, severity, payload, platforms, accepted }: Props) {
  const [open, setOpen] = useState(false);
  const [acceptedState, setAccepted] = useState(accepted);
  const [copied, setCopied] = useState(false);
  const meta = KIND_META[kind];

  const accept = async () => {
    await fetch(`/api/analyze/${id}/accept`, { method: 'POST', body: JSON.stringify({ accept: true }) }).catch(() => {});
    setAccepted(true);
  };
  const decline = async () => {
    await fetch(`/api/analyze/${id}/accept`, { method: 'POST', body: JSON.stringify({ accept: false }) }).catch(() => {});
    setAccepted(false);
  };

  const copyConfig = () => {
    const cfg = kind === 'agent' ? payload.systemPrompt :
                kind === 'rule' ? payload.ruleContent :
                JSON.stringify(payload, null, 2);
    navigator.clipboard.writeText(cfg ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`mx-2 p-3 rounded-md border transition-all ${acceptedState ? 'border-good bg-good/5' : 'border-line bg-white hover:bg-bg2'}`}>
      <div className="flex items-start gap-2">
        <meta.icon size={14} className={`mt-0.5 flex-shrink-0 text-${meta.tone === 'default' ? 'ink2' : meta.tone}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-ink truncate">{name}</span>
            <Chip tone={meta.tone}>{meta.label}</Chip>
            {severity === 'critical' && <Chip tone="bad">critical</Chip>}
          </div>
          <p className="text-xs text-ink3 leading-relaxed mb-2">{reason}</p>

          <button
            onClick={() => setOpen(!open)}
            className="text-xs text-ink2 hover:text-ink flex items-center gap-1"
          >
            {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            {open ? 'Hide config' : 'Preview config'}
          </button>

          {open && (
            <div className="mt-3 space-y-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-1">Description</div>
                <p className="text-xs text-ink2">{payload.description}</p>
              </div>

              {payload.globs && payload.globs.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-1">Globs</div>
                  <div className="flex flex-wrap gap-1">
                    {payload.globs.map((g) => <code key={g} className="text-[10px]">{g}</code>)}
                  </div>
                </div>
              )}

              {payload.systemPrompt && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-1">System prompt</div>
                  <pre className="text-[11px] max-h-48 overflow-y-auto"><code>{payload.systemPrompt}</code></pre>
                </div>
              )}

              {payload.ruleContent && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-1">Rule content</div>
                  <pre className="text-[11px] max-h-48 overflow-y-auto"><code>{payload.ruleContent}</code></pre>
                </div>
              )}

              {payload.triggers && payload.triggers.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-1">Triggers</div>
                  <ul className="text-xs text-ink2 space-y-0.5">
                    {payload.triggers.map((t, i) => <li key={i}>• {t}</li>)}
                  </ul>
                </div>
              )}

              {payload.pattern && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-1">Loop pattern</div>
                  <Chip tone="purple">{payload.pattern}</Chip>
                </div>
              )}

              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-1">Platforms</div>
                <div className="flex flex-wrap gap-1">
                  {platforms.map((p) => <Chip key={p} tone="default">{p}</Chip>)}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="ghost" icon={copied ? Check : Copy} onClick={copyConfig}>
                  {copied ? 'Copied' : 'Copy'}
                </Button>
                {!acceptedState ? (
                  <Button size="sm" variant="primary" icon={Check} onClick={accept}>Accept</Button>
                ) : (
                  <Button size="sm" variant="ghost" icon={X} onClick={decline}>Undo</Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
