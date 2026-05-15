'use client';

import { useMemo, useState } from 'react';
import { ConnectionType, Genome, NodeType } from '@/types/genome';

export interface NeuralInspectorProps {
  genome: Genome | null;
  activations: Map<number, number>;
}

// ── NetworkGraph ──────────────────────────────────────────────────────────────

interface NodePos {
  gene_id: number;
  type: NodeType;
  sensor_type?: string;
  x: number;
  y: number;
}

interface NetworkGraphProps {
  genome: Genome;
  activations: Map<number, number>;
  viewBox?: string;
  svgHeight?: number;
  colX?: { input: number; hidden: number; output: number };
  layoutH?: number;
  margin?: number;
  nodeR?: number;
  fontSize?: number;
}

function NetworkGraph({
  genome,
  activations,
  viewBox = '0 0 260 220',
  svgHeight = 180,
  colX = { input: 30, hidden: 130, output: 230 },
  layoutH = 220,
  margin = 30,
  nodeR = 10,
  fontSize = 9,
}: NetworkGraphProps) {
  const { nodes, edges } = useMemo(() => {
    const inputNodes = genome.node_genes.filter((n) => n.type === NodeType.INPUT);
    const hiddenNodes = genome.node_genes.filter((n) => n.type === NodeType.HIDDEN);
    const outputNodes = genome.node_genes.filter((n) => n.type === NodeType.OUTPUT);

    const positionColumn = (col: typeof inputNodes, x: number): NodePos[] =>
      col.map((n, i) => ({
        gene_id: n.gene_id,
        type: n.type,
        sensor_type: n.sensor_type,
        x,
        y:
          col.length === 1
            ? layoutH / 2
            : margin + (i * (layoutH - 2 * margin)) / (col.length - 1),
      }));

    const allPos: NodePos[] = [
      ...positionColumn(inputNodes, colX.input),
      ...positionColumn(hiddenNodes, colX.hidden),
      ...positionColumn(outputNodes, colX.output),
    ];

    const posMap = new Map(allPos.map((p) => [p.gene_id, p]));

    const edges = genome.connection_genes
      .filter((c) => c.conn_type === ConnectionType.SYNAPSE)
      .flatMap((s) => {
        const from = posMap.get(s.in_node);
        const to = posMap.get(s.out_node);
        if (!from || !to) return [];
        return [{ from, to, weight: s.weight ?? 0, enabled: s.enabled }];
      });

    return { nodes: allPos, edges };
  }, [genome, colX, layoutH, margin]);

  const SENSOR_LABELS: Record<string, string> = {
    BODY_ANGLE: 'angle',
    GROUND_CONTACT: 'contact',
    OSCILLATOR: 'osc',
    JOINT_ANGLE: 'joint',
    ANGULAR_VELOCITY: 'ang vel',
  };

  return (
    <svg viewBox={viewBox} width="100%" height={svgHeight} style={{ display: 'block' }}>
      {edges.map((e, i) => (
        <line
          key={i}
          x1={e.from.x}
          y1={e.from.y}
          x2={e.to.x}
          y2={e.to.y}
          stroke={e.weight >= 0 ? '#3b82f6' : '#ef4444'}
          strokeOpacity={e.enabled ? 0.8 : 0.2}
          strokeWidth={Math.min(4, Math.max(0.5, Math.abs(e.weight) * 2))}
        />
      ))}
      {nodes.map((n) => {
        const activation = activations.get(n.gene_id) ?? 0;
        const fill =
          n.type === NodeType.INPUT
            ? '#22c55e'
            : n.type === NodeType.OUTPUT
            ? '#ef4444'
            : '#6b7280';
        const label =
          n.type === NodeType.INPUT
            ? (SENSOR_LABELS[n.sensor_type ?? ''] ?? 'sensor')
            : n.type === NodeType.OUTPUT
            ? 'motor'
            : 'hidden';
        return (
          <g key={n.gene_id}>
            <circle
              cx={n.x}
              cy={n.y}
              r={nodeR}
              fill={fill}
              fillOpacity={0.3 + Math.abs(activation) * 0.7}
            />
            <text x={n.x} y={n.y + nodeR + 8} textAnchor="middle" fontSize={fontSize} fill="#94a3b8">
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── BodyDiagram ───────────────────────────────────────────────────────────────

interface SegPos {
  gene_id: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface BodyDiagramProps {
  genome: Genome;
  viewBox?: string;
  height?: number;
}

function BodyDiagram({ genome, viewBox = '0 0 260 100', height = 80 }: BodyDiagramProps) {
  const { segments, connections } = useMemo(() => {
    const parts = viewBox.split(' ').map(Number);
    const W = parts[2] ?? 260;
    const H = parts[3] ?? 100;
    const startX = W * (30 / 260);
    const depthStep = W * (70 / 260);

    const bodySegments = genome.node_genes.filter(
      (n) => n.type === NodeType.BODY_SEGMENT,
    );
    const jointGenes = genome.connection_genes.filter(
      (c) => c.conn_type === ConnectionType.JOINT,
    );

    if (bodySegments.length === 0) return { segments: [], connections: [] };

    // parent → children adjacency
    const children = new Map<number, number[]>();
    for (const jg of jointGenes) {
      if (!children.has(jg.in_node)) children.set(jg.in_node, []);
      children.get(jg.in_node)!.push(jg.out_node);
    }

    const segById = new Map(bodySegments.map((s) => [s.gene_id, s]));
    const scaleW = (w?: number) => ((w ?? 20) / 60) * 40 + 10;
    const scaleH = (h?: number) => ((h ?? 10) / 30) * 20 + 6;

    // BFS to count nodes per depth for vertical spacing
    const depthCount = new Map<number, number>();
    const visited = new Set<number>();
    const rootId = bodySegments[0].gene_id;

    const countBfs = (id: number, depth: number) => {
      if (visited.has(id)) return;
      visited.add(id);
      depthCount.set(depth, (depthCount.get(depth) ?? 0) + 1);
      for (const child of children.get(id) ?? []) countBfs(child, depth + 1);
    };
    countBfs(rootId, 0);
    visited.clear();

    const positions = new Map<number, { x: number; y: number }>();
    const depthIdx = new Map<number, number>();

    const layout = (id: number, depth: number) => {
      if (visited.has(id)) return;
      visited.add(id);
      const count = depthCount.get(depth) ?? 1;
      const idx = depthIdx.get(depth) ?? 0;
      depthIdx.set(depth, idx + 1);
      positions.set(id, {
        x: startX + depth * depthStep,
        y: (H / (count + 1)) * (idx + 1),
      });
      for (const child of children.get(id) ?? []) layout(child, depth + 1);
    };
    layout(rootId, 0);

    const segments: SegPos[] = bodySegments.flatMap((s) => {
      const pos = positions.get(s.gene_id);
      if (!pos) return [];
      return [{ gene_id: s.gene_id, ...pos, w: scaleW(s.width), h: scaleH(s.height) }];
    });

    const connections = jointGenes.flatMap((jg) => {
      const from = positions.get(jg.in_node);
      const to = positions.get(jg.out_node);
      if (!from || !to) return [];
      return [{ x1: from.x, y1: from.y, x2: to.x, y2: to.y }];
    });

    return { segments, connections };
  }, [genome, viewBox]);

  return (
    <svg viewBox={viewBox} width="100%" height={height} style={{ display: 'block' }}>
      {connections.map((c, i) => (
        <line key={i} x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} stroke="#94a3b8" strokeWidth={1} />
      ))}
      {segments.map((s) => (
        <rect
          key={s.gene_id}
          x={s.x - s.w / 2}
          y={s.y - s.h / 2}
          width={s.w}
          height={s.h}
          fill="rgba(34, 211, 238, 0.4)"
          stroke="#22d3ee"
          strokeWidth={1}
          rx={2}
        />
      ))}
    </svg>
  );
}

// ── NeuralInspector ───────────────────────────────────────────────────────────

export default function NeuralInspector({ genome, activations }: NeuralInspectorProps) {
  const [expanded, setExpanded] = useState(false);

  const bodySegments = genome?.node_genes.filter((n) => n.type === NodeType.BODY_SEGMENT) ?? [];
  const synapses = genome?.connection_genes.filter((c) => c.conn_type === ConnectionType.SYNAPSE) ?? [];

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div
        className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-[#161b22] transition-colors"
        style={{ borderBottom: '1px solid #21262d' }}
        onClick={() => setExpanded(true)}
      >
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#00d4ff' }} />
          <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#7d8590]">
            Neural Inspector
          </span>
        </div>
        <span className="font-mono text-[9px] text-[#7d8590]">⤢ expand</span>
      </div>

      {!genome ? (
        <div className="px-3 py-4 font-mono text-[10px] text-[#7d8590]">
          No creature selected
        </div>
      ) : (
        <>
          <div className="px-2 py-2">
            <NetworkGraph genome={genome} activations={activations} />
          </div>

          <div style={{ borderTop: '1px solid #21262d' }} />

          <div className="px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-1">
            {([
              ['LIMBS', bodySegments.length],
              ['SYNAPSES', synapses.length],
              ['SPECIES', genome.species_id],
              ['GEN', genome.generation],
            ] as [string, string | number][]).map(([label, value]) => (
              <div key={label} className="flex justify-between items-center">
                <span className="font-mono text-[10px] text-[#7d8590] tracking-wider">{label}</span>
                <span className="font-mono text-[11px] text-[#00d4ff] font-medium">{value}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {expanded && (
        <div
          className="fixed left-0 right-0 z-50 flex items-center justify-center"
          style={{
            top: '40px',
            bottom: '128px',
            background: 'rgba(0,0,0,0.85)',
          }}
          onClick={() => setExpanded(false)}
        >
          <div
            className="relative flex flex-col"
            style={{
              width: '600px',
              height: 'calc(100vh - 180px)',
              background: '#161b22',
              border: '1px solid #21262d',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div
              className="flex-shrink-0 px-4 py-3 flex items-center justify-between"
              style={{ borderBottom: '1px solid #21262d' }}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: '#00d4ff' }} />
                <span className="font-mono text-xs tracking-[0.2em] uppercase text-[#7d8590]">
                  Neural Inspector — {genome?.genome_id.slice(0, 8)}
                </span>
              </div>
              <button
                onClick={() => setExpanded(false)}
                className="font-mono text-xs text-[#7d8590] hover:text-[#e6edf3] transition-colors"
              >
                ✕ close
              </button>
            </div>

            {/* Scrollable middle content */}
            <div className="flex-1 overflow-y-auto">
              {/* Large network graph */}
              <div className="p-4">
                {genome && (
                  <div style={{ border: '1px solid #21262d' }}>
                    <NetworkGraph
                      genome={genome}
                      activations={activations}
                      viewBox="0 0 500 300"
                      svgHeight={280}
                      colX={{ input: 60, hidden: 250, output: 440 }}
                      layoutH={300}
                      nodeR={14}
                      fontSize={11}
                    />
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="mx-4" style={{ borderTop: '1px solid #21262d' }} />

              {/* Body structure */}
              <div className="px-4 py-3">
                <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-[#7d8590] mb-2">
                  Body Structure
                </div>
                <BodyDiagram genome={genome!} viewBox="0 0 500 150" height={130} />
              </div>
            </div>

            {/* Stats row — sticky at bottom, never scrolls */}
            <div
              className="flex-shrink-0 px-4 py-4 grid grid-cols-4 gap-4"
              style={{ borderTop: '1px solid #21262d' }}
            >
              {([
                ['LIMBS', genome?.node_genes.filter((n) => n.type === NodeType.BODY_SEGMENT).length ?? 0],
                ['SYNAPSES', genome?.connection_genes.filter((c) => c.conn_type === ConnectionType.SYNAPSE).length ?? 0],
                ['SPECIES', genome?.species_id ?? 0],
                ['GENERATION', genome?.generation ?? 0],
              ] as [string, number][]).map(([label, value]) => (
                <div key={label} className="flex flex-col gap-1">
                  <span className="font-mono text-[9px] tracking-wider text-[#7d8590]">{label}</span>
                  <span className="font-mono text-lg font-semibold text-[#00d4ff]">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
