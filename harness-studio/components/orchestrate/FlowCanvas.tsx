'use client';

// ============================================================
// FlowCanvas — React Flow surface (client-only, no SSR)
// Extracted so the orchestrate canvas page can dynamic-import
// with ssr:false (React Flow touches window/document).
// ============================================================
import { useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Connection,
  NodeChange,
  EdgeChange,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Bot } from 'lucide-react';
import type { LoopNodeData } from '@/lib/orchestrator/compiler';

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

interface Props {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (conn: Connection) => void;
  onNodeClick: (id: string) => void;
}

export default function FlowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
}: Props) {
  // Stable reference — inline nodeTypes remounts every render and breaks React Flow
  const nodeTypes = useMemo(() => ({ agent: AgentNode }), []);

  return (
    <div style={{ height: '600px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, n) => onNodeClick(n.id)}
        nodeTypes={nodeTypes}
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
  );
}
