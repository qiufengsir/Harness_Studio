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
import { Save, Play, Download, Trash2, Plus, X, Check, AlertTriangle, Loader2, Bot, RefreshCw, Sparkles, FileCode, Clock, ArrowRight } from 'lucide-react';
import { Card, CardSection, Button, Chip, PageHeader } from '@/components/ui';
import { LoopGraph, LoopNodeData, CompileTarget } from '@/lib/orchestrator/compiler';
import { ALL_PLATFORMS, PLATFORM_INFO } from '@/lib/orchestrator/compiler';
import { type PatternId } from '@/lib/orchestrator/patterns';
import { cacheLoop, getCachedLoop, scaffoldLoopGraph } from '@/lib/orchestrator/loop-cache';
import { useI18n } from '@/components/i18n/I18nProvider';

interface LoopData {
  id: string;
  name: string;
  description: string | null;
  pattern: string;
  graph: LoopGraph;
  targets: string[];
  meta: { freeText?: string; uploadedFiles?: string[] } | null;
  updatedAt: number;
}

interface LoopMeta {
  freeText?: string;
  uploadedFiles?: string[];
}

export default function LoopCanvasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, lang } = useI18n();
  const router = useRouter();
  const [loop, setLoop] = useState<LoopData | null>(null);
  const [nodes, setNodes] = useState<Node<any>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [compiled, setCompiled] = useState<CompileTarget[] | null>(null);
  const [health, setHealth] = useState<any>(null);
  const [validation, setValidation] = useState<{ level: string; message: string }[]>([]);
  const [targets, setTargets] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [activePreviewFile, setActivePreviewFile] = useState<string>('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tab + 项目简介状态
  const [activeTab, setActiveTab] = useState<'canvas' | 'brief'>('canvas');
  const [meta, setMeta] = useState<LoopMeta | null>(null);
  const metaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 重新生成状态
  const [regenerating, setRegenerating] = useState(false);
  const [regenMode, setRegenMode] = useState<'roster' | 'prompts' | null>(null);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [regenElapsed, setRegenElapsed] = useState(0);
  const [regenResult, setRegenResult] = useState<any>(null);
  // Preview modal tabs + chat simulation
  const [previewTab, setPreviewTab] = useState<'files' | 'chat'>('files');
  const [chatQuestion, setChatQuestion] = useState('');
  const [chatResult, setChatResult] = useState<{ without: string; with: string; withoutScore: number; withScore: number } | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // Load — API → sessionStorage → URL pattern 模板（适配 Cloudflare 内存库）
  useEffect(() => {
    const applyLoopData = (d: any) => {
      if (!d?.graph?.nodes) {
        setLoadError('Invalid loop data');
        setLoading(false);
        return;
      }
      setLoop(d);
      setTargets(d.targets ?? ALL_PLATFORMS);
      setMeta(d.meta ?? null);
      setNodes(
        (d.graph.nodes ?? []).map((n: any) => ({
          id: n.id,
          type: 'agent',
          position: { x: n.x ?? 0, y: n.y ?? 0 },
          data: n,
        })),
      );
      setEdges(
        (d.graph.edges ?? []).map((e: any) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
          animated: true,
        })),
      );
      setLoading(false);
    };

    const loadFromFallback = () => {
      const cached = getCachedLoop(id);
      if (cached) {
        applyLoopData(cached);
        return true;
      }
      const url = new URL(window.location.href);
      const pattern = (url.searchParams.get('pattern') as PatternId) || 'pipeline';
      const fallbackData = {
        id,
        name: 'Untitled Loop',
        description: null,
        pattern,
        graph: scaffoldLoopGraph(pattern),
        targets: ALL_PLATFORMS,
        meta: null,
        updatedAt: Date.now(),
      };
      cacheLoop(fallbackData);
      applyLoopData(fallbackData);
      return true;
    };

    const loadLoop = async () => {
      if (!id || id === 'undefined' || id === 'null') {
        loadFromFallback();
        return;
      }

      try {
        const r = await fetch(`/api/loops/${id}`);
        const d = await r.json().catch(() => null);

        if (!r.ok || !d || d.error || !d.graph?.nodes) {
          loadFromFallback();
          return;
        }

        applyLoopData(d);
        cacheLoop({
          id: d.id ?? id,
          name: d.name,
          description: d.description ?? null,
          pattern: d.pattern,
          graph: d.graph,
          targets: d.targets ?? ALL_PLATFORMS,
          meta: d.meta ?? null,
          updatedAt: d.updatedAt ?? Date.now(),
        });
      } catch {
        // 网络失败时优先用本地缓存，避免画布白屏
        if (!loadFromFallback()) {
          setLoadError('Failed to load loop');
          setLoading(false);
        }
      }
    };

    loadLoop();
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
    // 同步保存到 sessionStorage（防止 Worker 冷启动丢数据）
    const cacheData = { ...loop, graph, targets, meta, updatedAt: Date.now() };
    try { sessionStorage.setItem(`loop_${id}`, JSON.stringify(cacheData)); } catch {}
    // 异步保存到服务端（可能失败，不阻塞）
    fetch(`/api/loops/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: loop.name, description: loop.description, graph, targets, meta }),
    }).catch(() => {}).finally(() => setSaving(false));
  };

  // 保存 meta（防抖）
  const scheduleMetaSave = useCallback((newMeta: LoopMeta) => {
    setMeta(newMeta);
    if (metaTimer.current) clearTimeout(metaTimer.current);
    metaTimer.current = setTimeout(async () => {
      await fetch(`/api/loops/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meta: newMeta }),
      });
    }, 1000);
  }, [id]);

  // 保存 loop 元信息（name + description）
  const updateLoopMeta = (patch: Partial<LoopData>) => {
    setLoop((l) => l ? { ...l, ...patch } : l);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(), 1000);
  };

  // 重新生成（两种模式）
  const regenerate = async (mode: 'roster' | 'prompts') => {
    if (!loop) return;
    setRegenerating(true);
    setRegenMode(mode);
    setRegenError(null);
    setRegenResult(null);
    setRegenElapsed(0);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    const start = Date.now();
    const timer = setInterval(() => {
      setRegenElapsed(Math.floor((Date.now() - start) / 1000));
    }, 500);

    try {
      const body: any = {
        loopName: loop.name,
        freeText: meta?.freeText || undefined,
        generatePrompts: true,
      };

      if (mode === 'prompts') {
        // 仅刷新指令：传入现有 agents，保留节点结构
        body.existingAgents = nodes.map((n) => ({
          role: n.data.role,
          label: n.data.label,
          agent: n.data.agent,
          description: n.data.description,
        }));
      }

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || 'Generation failed');
      }
      const data = await res.json();
      setRegenResult(data);

      if (mode === 'roster') {
        // 重新生成名册：替换整个画布
        const newGraph = data.graph;
        const prompts: Record<string, string> = data.generatedPrompts || {};
        setNodes(newGraph.nodes.map((n: any) => {
          const p = prompts[n.agent];
          if (p && typeof p === 'string' && p.length > 20 && !p.startsWith('{')) {
            n.systemPrompt = p;
          }
          return {
            id: n.id,
            type: 'agent',
            position: { x: n.x ?? 0, y: n.y ?? 0 },
            data: n,
          };
        }));
        setEdges(newGraph.edges.map((e: any) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
          animated: true,
        })));
        setActiveTab('canvas');
      } else {
        // 仅刷新指令：保留节点结构，更新 systemPrompt
        const prompts: Record<string, string> = data.generatedPrompts || {};
        setNodes((nds) => nds.map((n) => {
          const p = prompts[n.data.agent];
          if (p && typeof p === 'string' && p.length > 20 && !p.startsWith('{')) {
            return { ...n, data: { ...n.data, systemPrompt: p } };
          }
          return n;
        }));
      }

      // 保存到数据库
      setTimeout(() => doSave(), 200);
    } catch (e) {
      const err = e as Error;
      if (err.name === 'AbortError') {
        setRegenError(t('loop.regenerate.timeout'));
      } else {
        setRegenError(err.message);
      }
    } finally {
      clearTimeout(timeout);
      clearInterval(timer);
      setRegenerating(false);
      setRegenMode(null);
    }
  };

  // Chat 对比演示 — 调用后端 LLM 接口，展示有无 Harness 配置的回答差异
  const simulateChat = async () => {
    const q = chatQuestion.trim();
    if (!q) return;

    setChatLoading(true);
    setChatResult(null);
    setChatError(null);

    try {
      // 从当前 loop 的 agent 配置构建上下文字符串
      const pattern = loop?.pattern || 'pipeline';
      const agentCount = nodes.length;
      const agentRoles = nodes
        .map((n) => `  - ${n.data.label} (${n.data.agent}): ${n.data.description}`)
        .join('\n');

      const configContext = `You are part of a development team using Harness Studio with the following configuration:
- Pattern: ${pattern}
- Agents: ${agentCount}
- Agent roles:
${agentRoles}
Follow the team conventions defined by these agents.`;

      // 调用后端 LLM 对比接口（无配置 vs 有 Harness 配置）
      const res = await fetch('/api/demo-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, configContext }),
      });
      const data = await res.json();

      if (!data.ok) {
        setChatError(data.error || 'LLM 调用失败，请稍后重试。');
      } else {
        setChatResult({
          without: data.without,
          with: data.with,
          withoutScore: data.withoutScore,
          withScore: data.withScore,
        });
      }
    } catch (e) {
      setChatError((e as Error).message || '网络错误，请检查连接后重试。');
    } finally {
      setChatLoading(false);
    }
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

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertTriangle size={32} className="text-bad" />
        <p className="text-sm text-ink2">{loadError}</p>
        <Button variant="ghost" onClick={() => router.push('/orchestrate')}>{lang === 'zh' ? '返回列表' : 'Back to list'}</Button>
      </div>
    );
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

      {/* Tab 切换栏 */}
      <div className="flex gap-1 mb-4 border-b border-line">
        <button
          onClick={() => setActiveTab('canvas')}
          className={`px-4 py-2 text-sm font-medium transition-all ${
            activeTab === 'canvas' ? 'text-black border-b-2 border-black -mb-px' : 'text-ink3 hover:text-ink'
          }`}
        >
          {t('loop.tab.canvas')}
        </button>
        <button
          onClick={() => setActiveTab('brief')}
          className={`px-4 py-2 text-sm font-medium transition-all ${
            activeTab === 'brief' ? 'text-black border-b-2 border-black -mb-px' : 'text-ink3 hover:text-ink'
          }`}
        >
          {t('loop.tab.brief')}
        </button>
      </div>

      {/* ===== Canvas Tab ===== */}
      {activeTab === 'canvas' && (
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
              <div className="flex items-center justify-between mb-2">
                <h3>{t('loop.compileTargets')}</h3>
                <span className="text-xs text-ink3">{targets.length} {t('loop.platformsSelected')}</span>
              </div>
              {/* 引导提示 */}
              <div className="mb-3 p-3 bg-bg2 rounded-lg border border-line">
                <p className="text-xs text-ink2 leading-relaxed">
                  <span className="font-semibold text-ink">{t('loop.targets.tip')}</span>
                  {t('loop.targets.tipDesc')}
                </p>
              </div>
              {/* 按分类分组 */}
              {(['standard', 'ide', 'cli'] as const).map((cat) => {
                const platformsInCat = ALL_PLATFORMS.filter((p) => PLATFORM_INFO[p]?.category === cat);
                if (platformsInCat.length === 0) return null;
                return (
                  <div key={cat} className="mb-3 last:mb-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-1.5">
                      {t(`loop.targets.cat.${cat}`)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {platformsInCat.map((p) => {
                        const on = targets.includes(p);
                        const info = PLATFORM_INFO[p];
                        const label = lang === 'zh' ? (info?.labelZh ?? p) : (info?.label ?? p);
                        const desc = lang === 'zh' ? (info?.descZh ?? '') : (info?.desc ?? '');
                        return (
                          <button
                            key={p}
                            onClick={() => setTargets((t) => on ? t.filter((x) => x !== p) : [...t, p])}
                            className={`chip ${on ? 'chip-dark' : ''} group relative`}
                            title={desc}
                          >
                            {on && <Check size={11} />}
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    {/* 选中平台时显示输出路径提示 */}
                    {platformsInCat.filter((p) => targets.includes(p)).length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        {platformsInCat.filter((p) => targets.includes(p)).map((p) => (
                          <span key={p} className="text-[10px] text-ink3 font-mono">
                            {PLATFORM_INFO[p]?.label}: <span className="text-ink2">{PLATFORM_INFO[p]?.outputHint}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
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
      )}

      {/* ===== Brief Tab — 项目简介 ===== */}
      {activeTab === 'brief' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 左侧：编辑表单 */}
          <div className="lg:col-span-2 space-y-4">
            {/* Loop 元信息 */}
            <Card>
              <CardSection>
                <div className="flex items-center gap-2 mb-3">
                  <Bot size={14} className="text-ink3" />
                  <h3>{t('loop.brief.metaTitle')}</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-1">{t('loop.brief.name')}</label>
                    <input
                      className="input"
                      value={loop?.name ?? ''}
                      onChange={(e) => updateLoopMeta({ name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-1">{t('loop.brief.desc')}</label>
                    <textarea
                      className="input h-20"
                      placeholder={t('loop.brief.descPh')}
                      value={loop?.description ?? ''}
                      onChange={(e) => updateLoopMeta({ description: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Chip tone="dark">{loop?.pattern}</Chip>
                    <span className="text-[10px] text-ink3">
                      {nodes.length} {t('loop.brief.agentsCount')} · {edges.length} {t('loop.brief.edgesCount')}
                    </span>
                  </div>
                </div>
              </CardSection>
            </Card>

            {/* AI 生成上下文 */}
            <Card>
              <CardSection>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={14} className="text-accent" />
                  <h3>{t('loop.brief.ctxTitle')}</h3>
                </div>
                <p className="text-xs text-ink3 mb-3">{t('loop.brief.ctxDesc')}</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-1">{t('loop.brief.freeText')}</label>
                    <textarea
                      className="input h-28"
                      placeholder={t('loop.brief.freeTextPh')}
                      value={meta?.freeText ?? ''}
                      onChange={(e) => scheduleMetaSave({ ...meta, freeText: e.target.value })}
                    />
                  </div>
                  {meta?.uploadedFiles && meta.uploadedFiles.length > 0 && (
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink3 mb-1.5">{t('loop.brief.uploadedFiles')}</label>
                      <div className="flex flex-wrap gap-1.5">
                        {meta.uploadedFiles.map((f, i) => (
                          <Chip key={i} tone="default">
                            <span className="flex items-center gap-1">
                              <FileCode size={9} /> {f}
                            </span>
                          </Chip>
                        ))}
                      </div>
                      <p className="text-[10px] text-ink3 mt-1.5">{t('loop.brief.filesHint')}</p>
                    </div>
                  )}
                </div>
              </CardSection>
            </Card>

            {/* 重新生成结果 */}
            {regenResult && (
              <Card className="border-good">
                <CardSection>
                  <div className="flex items-center gap-2 mb-2">
                    <Check size={14} className="text-good" />
                    <h3>{t('loop.brief.resultTitle')}</h3>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <Chip tone="accent">{t('loop.brief.resultPattern')}: {regenResult.pattern}</Chip>
                    <Chip tone="good">{regenResult.agents?.length ?? 0} {t('loop.brief.resultAgents')}</Chip>
                    {regenResult.llmUsed && (
                      <Chip tone="good">{t('loop.brief.resultPrompts')}</Chip>
                    )}
                  </div>
                  {regenResult.patternReason && (
                    <p className="text-xs text-ink2 bg-bg2 rounded-md p-2.5 mt-2">{regenResult.patternReason}</p>
                  )}
                  {!regenResult.llmUsed && regenResult.llmError && (
                    <p className="text-[10px] text-warn mt-2">{t('loop.brief.resultLlmErr')}: {regenResult.llmError}</p>
                  )}
                </CardSection>
              </Card>
            )}
          </div>

          {/* 右侧：重新生成操作面板 */}
          <div>
            <Card className="sticky top-8">
              <CardSection>
                <div className="flex items-center gap-2 mb-2">
                  <RefreshCw size={14} className="text-ink3" />
                  <h3>{t('loop.regenerate.title')}</h3>
                </div>
                <p className="text-xs text-ink3 mb-4">{t('loop.regenerate.desc')}</p>

                <div className="space-y-3">
                  {/* 重新生成名册 */}
                  <div className="p-3 rounded-lg border border-line bg-bg2">
                    <Button
                      variant="primary"
                      icon={regenerating && regenMode === 'roster' ? Loader2 : RefreshCw}
                      onClick={() => regenerate('roster')}
                      disabled={regenerating}
                      className="w-full justify-center"
                    >
                      {regenerating && regenMode === 'roster' ? t('loop.regenerate.doing') : t('loop.regenerate.roster')}
                    </Button>
                    <p className="text-[10px] text-ink3 mt-2 leading-relaxed">{t('loop.regenerate.rosterDesc')}</p>
                  </div>

                  {/* 仅刷新指令 */}
                  <div className="p-3 rounded-lg border border-line">
                    <Button
                      variant="ghost"
                      icon={regenerating && regenMode === 'prompts' ? Loader2 : Sparkles}
                      onClick={() => regenerate('prompts')}
                      disabled={regenerating}
                      className="w-full justify-center"
                    >
                      {regenerating && regenMode === 'prompts' ? t('loop.regenerate.doing') : t('loop.regenerate.prompts')}
                    </Button>
                    <p className="text-[10px] text-ink3 mt-2 leading-relaxed">{t('loop.regenerate.promptsDesc')}</p>
                  </div>
                </div>

                {/* 进度指示 */}
                {regenerating && (
                  <div className="mt-3 text-xs text-ink3 bg-bg2 rounded-md p-2.5 border border-line">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Loader2 size={11} className="animate-spin" />
                        {regenMode === 'roster' ? t('loop.regenerate.rosterDoing') : t('loop.regenerate.promptsDoing')}
                      </span>
                      <span className="flex items-center gap-1 font-mono text-ink2">
                        <Clock size={9} /> {regenElapsed}s
                      </span>
                    </div>
                    {regenElapsed >= 10 && (
                      <div className="text-[10px] text-ink3 mt-1">{t('loop.regenerate.slow')}</div>
                    )}
                  </div>
                )}

                {/* 错误提示 */}
                {regenError && (
                  <div className="mt-3 text-xs text-bad bg-bad/5 rounded-md p-2.5 border border-bad/20 flex items-start gap-2">
                    <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" />
                    <span className="break-all">{regenError}</span>
                  </div>
                )}

                {/* 提示 */}
                <div className="mt-4 pt-3 border-t border-line">
                  <p className="text-[10px] text-ink3 leading-relaxed">{t('loop.regenerate.tip')}</p>
                </div>
              </CardSection>
            </Card>
          </div>
        </div>
      )}

      {/* Compile preview modal */}
      {showPreview && compiled && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6" onClick={() => setShowPreview(false)}>
          <div
            className="bg-white rounded-t-xl sm:rounded-xl shadow-xl max-w-6xl w-full max-h-[92vh] overflow-hidden flex flex-col safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-6 border-b border-line">
              <div className="min-w-0 flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-black">{t('loop.preview.title')}</h2>
                  <p className="text-xs text-ink3 mt-0.5">
                    {compiled.length} {t('loop.preview.sub')}{allFiles.length}{t('loop.preview.sub2')}
                  </p>
                </div>
                <button onClick={() => setShowPreview(false)} className="sm:hidden text-ink3 hover:text-ink min-h-[44px] min-w-[44px] flex items-center justify-center -mr-2">
                  <X size={18} />
                </button>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="ghost"
                  icon={Download}
                  onClick={() => downloadAll(allFiles)}
                  className="flex-1 sm:flex-none justify-center"
                >
                  {t('loop.preview.download')}
                </Button>
                <button onClick={() => setShowPreview(false)} className="hidden sm:flex text-ink3 hover:text-ink items-center"><X size={18} /></button>
              </div>
            </div>

            {/* Tab switch */}
            <div className="flex gap-1 border-b border-line">
              <button
                onClick={() => setPreviewTab('files')}
                className={`px-4 py-2 text-xs font-medium transition-all ${
                  previewTab === 'files' ? 'text-black border-b-2 border-black -mb-px' : 'text-ink3 hover:text-ink'
                }`}
              >
                {t('loop.preview.tab.files')}
              </button>
              <button
                onClick={() => setPreviewTab('chat')}
                className={`px-4 py-2 text-xs font-medium transition-all ${
                  previewTab === 'chat' ? 'text-black border-b-2 border-black -mb-px' : 'text-ink3 hover:text-ink'
                }`}
              >
                {t('loop.preview.tab.chat')}
              </button>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
              {/* Files view */}
              {previewTab === 'files' && (
                <>
                  {/* File tree + health panel */}
                  <div className="w-full md:w-72 max-h-[40vh] md:max-h-none border-b md:border-b-0 md:border-r border-line overflow-y-auto p-3 shrink-0">
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
                </>
              )}

              {/* Chat comparison view */}
              {previewTab === 'chat' && (
                <div className="flex-1 flex flex-col">
                  {/* Input */}
                  <div className="p-4 border-b border-line">
                    <div className="flex gap-2">
                      <input
                        className="flex-1 input"
                        placeholder={t('loop.preview.chat.ph')}
                        value={chatQuestion}
                        onChange={(e) => setChatQuestion(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && simulateChat()}
                      />
                      <Button
                        variant="primary"
                        icon={chatLoading ? RefreshCw : Sparkles}
                        onClick={simulateChat}
                        disabled={chatLoading}
                        className={chatLoading ? 'animate-spin' : ''}
                      >
                        {chatLoading ? t('loop.preview.chat.asking') : t('loop.preview.chat.ask')}
                      </Button>
                    </div>
                    <p className="text-[10px] text-ink3 mt-2">{t('loop.preview.chat.hint')}</p>
                  </div>

                  {/* Results */}
                  {chatResult && (
                    <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
                      {/* Without */}
                      <div className="flex-1 border-b md:border-b-0 md:border-r border-line overflow-auto">
                        <div className="p-4 border-b border-line bg-bad/5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-bad/10 flex items-center justify-center">
                              <X size={10} className="text-bad" />
                            </div>
                            <span className="text-xs font-semibold text-bad">{t('loop.preview.chat.without')}</span>
                            <Chip tone="bad" className="ml-auto">{chatResult.withoutScore}%</Chip>
                          </div>
                        </div>
                        <div className="p-4">
                          <pre className="text-xs text-ink2 font-mono whitespace-pre-wrap">{chatResult.without}</pre>
                        </div>
                      </div>

                      {/* With */}
                      <div className="flex-1 overflow-auto">
                        <div className="p-4 border-b border-line bg-good/5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-good/10 flex items-center justify-center">
                              <Check size={10} className="text-good" />
                            </div>
                            <span className="text-xs font-semibold text-good">{t('loop.preview.chat.with')}</span>
                            <Chip tone="good" className="ml-auto">{chatResult.withScore}%</Chip>
                          </div>
                        </div>
                        <div className="p-4">
                          <pre className="text-xs text-ink2 font-mono whitespace-pre-wrap">{chatResult.with}</pre>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 错误提示（LLM 未配置或调用失败时显示） */}
                  {chatError && !chatLoading && (
                    <div className="flex-1 flex items-center justify-center p-6">
                      <div className="max-w-md w-full">
                        <div className="flex items-start gap-3 p-4 rounded-lg border border-bad/30 bg-bad/5">
                          <div className="w-8 h-8 rounded-lg bg-bad/10 flex items-center justify-center flex-shrink-0">
                            <AlertTriangle size={14} className="text-bad" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sm font-semibold text-bad">
                              {lang === 'zh' ? 'LLM 调用失败' : 'LLM Call Failed'}
                            </h3>
                            <p className="text-xs text-ink2 mt-1 break-words">{chatError}</p>
                            <Button
                              variant="ghost"
                              icon={ArrowRight}
                              onClick={() => window.location.href = '/settings'}
                              className="mt-3"
                            >
                              {lang === 'zh' ? '前往设置页配置密钥' : 'Go to Settings'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {!chatResult && !chatError && (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center">
                        <Sparkles size={24} className="text-ink3 mx-auto mb-3" />
                        <p className="text-sm text-ink3">{t('loop.preview.chat.empty')}</p>
                        <p className="text-xs text-ink3 mt-1">{t('loop.preview.chat.emptyDesc')}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
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
