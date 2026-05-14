'use client';

import { useMemo } from 'react';
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

function NetworkGraph({
  genome,
  activations,
}: {
  genome: Genome;
  activations: Map<number, number>;
}) {
  const { nodes, edges } = useMemo(() => {
    const W = 300;
    const H = 200;
    const margin = 30;

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
            ? H / 2
            : margin + (i * (H - 2 * margin)) / (col.length - 1),
      }));

    const allPos: NodePos[] = [
      ...positionColumn(inputNodes, margin),
      ...positionColumn(hiddenNodes, W / 2),
      ...positionColumn(outputNodes, W - margin),
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
  }, [genome]);

  return (
    <svg viewBox="0 0 300 200" width="100%" style={{ display: 'block' }}>
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
            ? (n.sensor_type ?? 'sensor').toLowerCase().replace(/_/g, ' ')
            : n.type === NodeType.OUTPUT
            ? 'motor'
            : 'hidden';
        return (
          <g key={n.gene_id}>
            <circle
              cx={n.x}
              cy={n.y}
              r={8}
              fill={fill}
              fillOpacity={0.3 + Math.abs(activation) * 0.7}
            />
            <text x={n.x} y={n.y + 18} textAnchor="middle" fontSize={6} fill="#94a3b8">
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

function BodyDiagram({ genome }: { genome: Genome }) {
  const { segments, connections } = useMemo(() => {
    const W = 300;
    const H = 120;
    const startX = 30;

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
        x: startX + depth * 70,
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
  }, [genome]);

  return (
    <svg viewBox="0 0 300 120" width="100%" style={{ display: 'block' }}>
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

// ── CreatureStats ─────────────────────────────────────────────────────────────

function CreatureStats({ genome }: { genome: Genome }) {
  const bodySegments = genome.node_genes.filter((n) => n.type === NodeType.BODY_SEGMENT);
  const synapses = genome.connection_genes.filter((c) => c.conn_type === ConnectionType.SYNAPSE);

  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="text-slate-400">Limbs</div>
      <div className="text-cyan-400">{bodySegments.length}</div>
      <div className="text-slate-400">Synapses</div>
      <div className="text-cyan-400">{synapses.length}</div>
      <div className="text-slate-400">Species</div>
      <div className="text-cyan-400">{genome.species_id}</div>
      <div className="text-slate-400">Generation</div>
      <div className="text-cyan-400">{genome.generation}</div>
    </div>
  );
}

// ── NeuralInspector ───────────────────────────────────────────────────────────

export default function NeuralInspector({ genome, activations }: NeuralInspectorProps) {
  return (
    <div className="flex flex-col gap-4 p-4 bg-slate-800 rounded-xl border border-slate-700">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
        Neural Inspector
      </h3>
      {!genome ? (
        <p className="text-xs text-slate-500 text-center py-4">No creature selected</p>
      ) : (
        <>
          <NetworkGraph genome={genome} activations={activations} />
          <BodyDiagram genome={genome} />
          <CreatureStats genome={genome} />
        </>
      )}
    </div>
  );
}
