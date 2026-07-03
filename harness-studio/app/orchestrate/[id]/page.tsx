'use client';

// ============================================================
// Loop Canvas — React Flow + Node Inspector + Compile Preview
// ============================================================
import { useEffect, useState, useCallback, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import ReactFlow, {
  Background, Controls, MiniMap,
  addEdge, applyEdgeChanges, applyNodeChanges,
  Node, Edge, Connection, NodeChange, EdgeChange,
  Handle, Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Save, Play, Download, Trash2, Plus, X, Check, AlertTriangle, Loader2, Bot } from 'lucide-react';
import { Card, CardSection, Button, Chip, PageHeader } from '@/components/ui';
import { LoopGraph, LoopNodeData, CompileTarget } from '@/lib/orchestrator/compiler';
import { ALL_PLATFORMS } from '@/lib/orchestrator/compiler';
import { useI18n } from '@/components/i18n/I18nProvider';

interface LoopData {
  id: string;
  name: string;
  description: string | null;
  pattern: string;
  graph: LoopGraph;
  targets: string[];
  updatedAt: number;
}

export default function LoopCanvasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  const router = useRouter();
  const [loop, setLoop] = useState<LoopData | null>(null);
  const [nodes, setNodes] = useState<Node<any>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [compiled, setCompiled] = useState<CompileTarget[] | null>(null);
  const [health, setHealth] = useState<any>(null);
  const [validation, setValidation] = useState<{ level: string; message: string }[]>([]);
  const [targets, setTargets] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [activePreviewFile, setActivePreviewFile] = useState<string>('');
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  // Load
  useEffect(() => {
    fetch(`/api/loops/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setLoop(d);
        setTargets(d.targets ?? ALL_PLATFORMS);
        setNodes(d.graph.nodes.map((n: LoopNodeData) => ({
          id: n.id,
          type: 'agent',
          position: { x: n.x ?? 0, y: n.y ?? 0 },
          data: n,
        })));
        setEdges(d.graph.edges.map((e: any) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
          animated: true,
        })));
        setLoading(false);
      });
  }, [id]);

  // Auto-save (debounced)
  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(), 1500);
  }, []);

  const doSave = async () => {
    if (!loop) return;
    setSaving(true);
    const graph: LoopGraph = {
      nodes: nodes.map((n) => ({ ...n.data, x: n.position.x, y: n.position.y })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label as string | undefined })),
    };
    await fetch(`/api/loops/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: loop.name, graph, targets }),
    });
    setSaving(false);
  };

  // React Flow handlers
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
    scheduleSave();
  }, [scheduleSave]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
    scheduleSave();
  }, [scheduleSave]);

  const onConnect = useCallback((conn: Connection) => {
    setEdges((eds) => addEdge({ ...conn, animated: true }, eds));
    scheduleSave();
  }, [scheduleSave]);

  // Compile
  const compile = async () => {
    if (!loop) return;
    setCompiling(true);
    const graph: LoopGraph = {
      nodes: nodes.map((n) => ({ ...n.data, x: n.position.x, y: n.position.y })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label as string | undefined })),
    };
    try {
      const res = await fetch('/api/loops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'compile', name: loop.name, pattern: loop.pattern, graph, targets }),
      });
      const data = await res.json();
      if (res.ok) {
        setCompiled(data.compiled);
        setHealth(data.health ?? null);
        setValidation(data.validation ?? []);
        setShowPreview(true);
      } else {
        setValidation(data.issues ?? []);
      }
    } finally {
      setCompiling(false);
    }
  };

  // Update node data
  const updateNode = (id: string, patch: Partial<LoopNodeData>) => {
    setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n));
    scheduleSave();
  };

  const addNode = () => {
    const id = `n${Date.now()}`;
    const newNode: Node<LoopNodeData> = {
      id,
      type: 'agent',
      position: { x: 200 + Math.random() * 200, y: 100 + Math.random() * 200 },
      data: {
        id,
        role: 'worker',
        label: 'New Agent',
        agent: 'custom-agent',
        description: 'Describe this agent\'s responsibility.',
        systemPrompt: '',
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNode(id);
    scheduleSave();
  };

  const deleteNode = (id: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setSelectedNode(null);
    scheduleSave();
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-ink3" size={20} /></div>;
  }

  const selected = nodes.find((n) => n.id === selectedNode);
  const allFiles = compiled?.flatMap((t) => t.files.map((f) => ({ ...f, platform: t.platform }))) ?? [];
  const activeFile = allFiles.find((f) => `${f.platform}/${f.path}` === activePreviewFile) ?? allFiles[0];

  return (
    <div>
      <PageHeader
        title={loop?.name ?? 'Loop'}
        desc={`${t('loop.desc')}${loop?.pattern ?? ''}${t('loop.desc.suffix')}`}
        actions={
          <>
            <Button variant="ghost" icon={Plus} onClick={addNode}>{t('loop.addAgent')}</Button>
            <Button variant="ghost" icon={Save} onClick={doSave}>{saving ? t('loop.saving') : t('loop.save')}</Button>
            <Button variant="primary" icon={compiling ? Loader2 : Play} onClick={compile} disabled={compiling}>
              {compiling ? t('loop.compiling') : t('loop.compile')}
            </Button>
          </>
        }
      />

      {/* Validation issues */}
      {validation.length > 0 && (
        <Card className="mb-4 border-warn">
          <CardSection className="py-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="text-warn mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                {validation.map((v, i) => (
                  <div key={i} className={`text-xs ${v.level === 'error' ? 'text-bad' : 'text-warn'}`}>
                    <strong>{v.level}:</strong> {v.message}
                  </div>
                ))}
              </div>
            </div>
          </CardSection>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Canvas */}
        <div className="lg:col-span-3">
          <Card className="overflow-hidden">
            <div style={{ height: '600px' }}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={(_, n) => setSelectedNode(n.id)}
                nodeTypes={{ agent: AgentNode }}
                fitView
                defaultEdgeOptions={{ style: { stroke: '#a1a1aa', strokeWidth: 1.5 } }}
              >
                <Background color="#e4e4e7" gap={16} />
                <Controls />
                <MiniMap
                  nodeColor={(n) => {
                    const role = n.data?.role;
                    if (role === 'leader' || role === 'router' || role === 'merge') return '#09090b';
                    return '#a1a1aa';
                  }}
                  maskColor="rgba(255,255,255,0.6)"
                />
              </ReactFlow>
            </div>
          </Card>

          {/* Platform targets */}
          <Card className="mt-4">
            <CardSection>
              <div className="flex items-center justify-between mb-3">
                <h3>{t('loop.compileTargets')}</h3>
                <span className="text-xs text-ink3">{targets.length} {t('loop.platformsSelected')}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {ALL_PLATFORMS.map((p) => {
                  const on = targets.includes(p);
                  return (
                    <button
                      key={p}
                      onClick={() => setTargets((t) => on ? t.filter((x) => x !== p) : [...t, p])}
                      className={`chip ${on ? 'chip-dark' : ''}`}
                    >
                      {on && <Check size={11} />}
                      {p}
                    </button>
                  );
                })}
              </div>
            </CardSection>
          </Card>
        </div>

        {/* Node inspector */}
        <div>
          <Card className="sticky top-8">
            <CardSection>
              <div className="flex items-center justify-between mb-3">
                <h3>{t('loop.inspector.title')}</h3>
                {selected && (
                  <button onClick={() => deleteNode(selected.id)} className="text-bad hover:text-bad/80">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              {!selected ? (
                <p className="text-xs text-ink3 text-center py-8">{t('loop.inspector.empty')}</p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-1">{t('loop.inspector.label')}</label>
                    <input
                      className="input"
                      value={selected.data.label}
                      onChange={(e) => updateNode(selected.id, { label: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-1">{t('loop.inspector.role')}</label>
                    <select
                      className="select"
                      value={selected.data.role}
                      onChange={(e) => updateNode(selected.id, { role: e.target.value })}
                    >
                      <option value="reviewer">reviewer</option>
                      <option value="security">security</option>
                      <option value="tester">tester</option>
                      <option value="doc-writer">doc-writer</option>
                      <option value="leader">leader</option>
                      <option value="router">router</option>
                      <option value="worker">worker</option>
                      <option value="specialist">specialist</option>
                      <option value="merge">merge</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-1">{t('loop.inspector.agentName')}</label>
                    <input
                      className="input font-mono"
                      value={selected.data.agent}
                      onChange={(e) => updateNode(selected.id, { agent: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-1">{t('loop.inspector.description')}</label>
                    <textarea
                      className="input h-16"
                      value={selected.data.description}
                      onChange={(e) => updateNode(selected.id, { description: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-1">{t('loop.inspector.systemPrompt')}</label>
                    <textarea
                      className="input h-40 font-mono text-[11px]"
                      placeholder={t('loop.inspector.sp.ph')}
                      value={selected.data.systemPrompt ?? ''}
                      onChange={(e) => updateNode(selected.id, { systemPrompt: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </CardSection>
          </Card>
        </div>
      </div>

      {/* Compile preview modal */}
      {showPreview && compiled && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6" onClick={() => setShowPreview(false)}>
          <div
            className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-line">
              <div>
                <h2 className="text-black">{t('loop.preview.title')}</h2>
                <p className="text-xs text-ink3 mt-0.5">
                  {compiled.length} {t('loop.preview.sub')}{allFiles.length}{t('loop.preview.sub2')}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  icon={Download}
                  onClick={() => downloadAll(allFiles)}
                >
                  {t('loop.preview.download')}
                </Button>
                <button onClick={() => setShowPreview(false)} className="text-ink3 hover:text-ink"><X size={18} /></button>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* File tree + health panel */}
              <div className="w-72 border-r border-line overflow-y-auto p-3">
                {/* Health check report */}
                {health && (
                  <div className="mb-4 p-3 rounded-md border border-line bg-bg2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-ink3">Health</span>
                      <span className={`text-sm font-bold ${health.passed ? 'text-good' : 'text-warn'}`}>
                        {health.scores.overall}
                      </span>
                    </div>
                    <div className="space-y-1 text-[10px]">
                      {[
                        ['Complete', health.scores.completeness],
                        ['Coverage', health.scores.coverage],
                        ['Coherence', health.scores.coherence],
                        ['Platform', health.scores.platform],
                      ].map(([label, val]: any) => (
                        <div key={label} className="flex items-center gap-1.5">
                          <span className="text-ink3 w-16 flex-shrink-0">{label}</span>
                          <div className="h-1 flex-1 bg-bg3 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${val >= 80 ? 'bg-good' : val >= 50 ? 'bg-warn' : 'bg-bad'}`}
                              style={{ width: `${val}%` }}
                            />
                          </div>
                          <span className="text-ink2 w-6 text-right font-mono">{val}</span>
                        </div>
                      ))}
                    </div>
                    {health.findings.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-line space-y-1">
                        {health.findings.slice(0, 4).map((f: any, i: number) => (
                          <div key={i} className={`text-[9px] leading-tight ${
                            f.severity === 'critical' ? 'text-bad' : f.severity === 'warning' ? 'text-warn' : 'text-ink3'
                          }`}>
                            {f.severity === 'critical' ? '✕' : f.severity === 'warning' ? '⚠' : 'ℹ'} {f.message}
                          </div>
                        ))}
                        {health.findings.length > 4 && (
                          <div className="text-[9px] text-ink3">+{health.findings.length - 4} more</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {compiled.map((t) => (
                  <div key={t.platform} className="mb-4">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-1.5 px-2">
                      {t.platform} ({t.files.length})
                    </div>
                    {t.files.map((f) => {
                      const key = `${t.platform}/${f.path}`;
                      const active = (activeFile?.platform === t.platform && activeFile?.path === f.path);
                      return (
                        <button
                          key={key}
                          onClick={() => setActivePreviewFile(key)}
                          className={`w-full text-left px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                            active ? 'bg-black text-white' : 'text-ink2 hover:bg-bg2'
                          }`}
                        >
                          {f.path}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* File content */}
              <div className="flex-1 overflow-auto bg-[#09090b] p-5">
                {activeFile ? (
                  <pre className="text-[12px] text-[#e4e4e7]"><code>{activeFile.content}</code></pre>
                ) : (
                  <div className="text-ink3 text-sm text-center py-20">{t('loop.preview.selectFile')}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Custom node renderer ----------
function AgentNode({ data, selected }: { data: LoopNodeData; selected?: boolean }) {
  const isHub = data.role === 'leader' || data.role === 'router' || data.role === 'merge';
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-white shadow-md transition-all min-w-[160px] ${
        selected ? 'border-black' : isHub ? 'border-black' : 'border-line2'
      }`}
      style={isHub ? { background: '#09090b', color: 'white' } : undefined}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2 mb-1">
        <Bot size={12} className={isHub ? 'text-white' : 'text-ink3'} />
        <span className={`text-[10px] font-mono uppercase tracking-wider ${isHub ? 'text-white/60' : 'text-ink3'}`}>
          {data.role}
        </span>
      </div>
      <div className={`text-sm font-medium ${isHub ? 'text-white' : 'text-black'}`}>{data.label}</div>
      <div className={`text-[10px] mt-0.5 ${isHub ? 'text-white/60' : 'text-ink3'} truncate`}>{data.agent}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

// ---------- Download all configs as .json (browser-side) ----------
function downloadAll(files: { platform: string; path: string; content: string }[]) {
  // Simple: serialize all to a single JSON for now (zip requires JSZip, can be added later)
  const blob = new Blob([JSON.stringify(files, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'harness-loop-configs.json';
  a.click();
  URL.revokeObjectURL(url);
}
