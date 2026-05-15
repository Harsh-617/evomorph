import { useState, useEffect } from 'react';
import { Genome } from '@/types/genome';

interface LiveNeuralVizProps {
  genome: Genome | null;
  activations: Map<number, number>;
  history: Map<number, number[]>;
  onClose: () => void;
}

export default function LiveNeuralViz({ genome, activations, history, onClose }: LiveNeuralVizProps) {
  const [pulseOffset, setPulseOffset] = useState(0);

  useEffect(() => {
    let raf: number;
    const animate = () => {
      setPulseOffset(prev => (prev + 0.02) % 1);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!genome) return null;

  const standardDev = (arr: number[]) => {
    const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
    return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length);
  };

  const inputNodes = genome.node_genes.filter(n => n.type === 'INPUT');
  const hiddenNodes = genome.node_genes.filter(n => n.type === 'HIDDEN');
  const outputNodes = genome.node_genes.filter(n => n.type === 'OUTPUT');
  const synapses = genome.connection_genes.filter(c => c.conn_type === 'SYNAPSE' && c.enabled);

  // Layout constants
  const H = 500;
  const COL = { input: 120, hidden: 380, output: 640 };
  const NODE_R = 18;

  // Node positions
  const nodePos = new Map<number, { x: number; y: number }>();
  const placeNodes = (nodes: typeof inputNodes, x: number) => {
    const spacing = H / (nodes.length + 1);
    nodes.forEach((n, i) => nodePos.set(n.gene_id, { x, y: spacing * (i + 1) }));
  };
  placeNodes(inputNodes, COL.input);
  placeNodes(hiddenNodes, COL.hidden);
  placeNodes(outputNodes, COL.output);

  // Stats
  const totalEnergy = [...activations.values()].reduce((s, v) => s + Math.abs(v), 0);
  const networkDepth = hiddenNodes.length > 0 ? 3 : 2;
  const activeEdges = synapses.filter(s => Math.abs(activations.get(s.out_node) ?? 0) > 0.1).length;

  // Label shortener
  const nodeLabel = (n: typeof inputNodes[0]) => {
    if (n.type === 'OUTPUT') return 'motor';
    if (n.type === 'HIDDEN') return 'hidden';
    const map: Record<string, string> = {
      BODY_ANGLE: 'angle', GROUND_CONTACT: 'contact',
      OSCILLATOR: 'osc', JOINT_ANGLE: 'joint', ANGULAR_VELOCITY: 'ang vel'
    };
    return map[n.sensor_type ?? ''] ?? 'sensor';
  };

  return (
    <div className="flex flex-col h-full" style={{ background: '#0d1117' }}>

      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2"
        style={{ borderBottom: '1px solid #21262d' }}>
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#00d4ff' }} />
          <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#7d8590]">
            Live Neural Visualization
          </span>
          <span className="font-mono text-[9px] text-[#4a5568]">
            {genome.genome_id.slice(0, 8).toUpperCase()}
          </span>
        </div>
        <button onClick={onClose}
          className="font-mono text-[10px] text-[#7d8590] hover:text-[#e6edf3] transition-colors px-2 py-1"
          style={{ border: '1px solid #21262d' }}>
          ✕ CLOSE
        </button>
      </div>

      {/* Stats bar */}
      <div className="flex-shrink-0 grid grid-cols-5 font-mono"
        style={{ borderBottom: '1px solid #21262d' }}>
        {[
          ['NODES', genome.node_genes.filter(n => n.type !== 'BODY_SEGMENT').length],
          ['SYNAPSES', synapses.length],
          ['ENERGY', totalEnergy.toFixed(3)],
          ['DEPTH', networkDepth],
          ['EFFICIENCY', (() => {
            const outputEnergy = outputNodes.reduce((s, n) =>
              s + Math.abs(activations.get(n.gene_id) ?? 0), 0);
            return totalEnergy > 0
              ? ((outputEnergy / totalEnergy) * 100).toFixed(1) + '%'
              : '0.0%';
          })()],
        ].map(([label, value]) => (
          <div key={String(label)} className="flex flex-col px-4 py-2"
            style={{ borderRight: '1px solid #21262d' }}>
            <span className="text-[10px] text-[#4a5568] tracking-wider">{label}</span>
            <span className="text-xl font-bold text-[#00d4ff]">{value}</span>
          </div>
        ))}
      </div>

      {/* Main area — network graph + oscilloscopes */}
      <div className="flex-1 grid overflow-hidden" style={{ gridTemplateColumns: '1fr 260px' }}>

        {/* LEFT: Network graph — full height */}
        <div className="relative overflow-hidden" style={{ borderRight: '1px solid #21262d' }}>
          <svg width="100%" height="100%" viewBox="0 0 760 500"
            style={{ display: 'block' }}>

            {/* Grid lines */}
            {[COL.input, COL.hidden, COL.output].map(x => (
              <line key={x} x1={x} y1={20} x2={x} y2={H - 20}
                stroke="#161b22" strokeWidth="1" strokeDasharray="4 4" />
            ))}

            {/* Column labels */}
            {[['INPUT', COL.input], ['HIDDEN', COL.hidden], ['OUTPUT', COL.output]].map(([label, x]) => (
              <text key={String(label)} x={Number(x)} y={14} textAnchor="middle"
                fill="#4a5568" fontSize="13" fontFamily="monospace" letterSpacing="2">
                {label}
              </text>
            ))}

            {/* Edges — draw before nodes */}
            {synapses.map(s => {
              const from = nodePos.get(s.in_node);
              const to = nodePos.get(s.out_node);
              if (!from || !to) return null;
              const w = s.weight ?? 0;
              const activation = activations.get(s.out_node) ?? 0;
              const isActive = Math.abs(activation) > 0.1;
              return (
                <g key={s.innovation_id}>
                  <line
                    x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                    stroke={w > 0 ? '#00d4ff' : '#ff4444'}
                    strokeWidth={Math.max(0.5, Math.min(3, Math.abs(w) * 1.5))}
                    strokeOpacity={isActive ? 0.8 : 0.15}
                  />
                  <text
                    key={`w-${s.innovation_id}`}
                    x={(from.x + to.x) / 2}
                    y={(from.y + to.y) / 2 - 6}
                    textAnchor="middle"
                    fill={w > 0 ? '#00d4ff' : '#ff4444'}
                    fontSize="11"
                    fontFamily="monospace"
                    fillOpacity="0.8"
                  >
                    {w > 0 ? '+' : ''}{w.toFixed(3)}
                  </text>
                </g>
              );
            })}

            {/* Signal pulses */}
            {synapses.filter(s => {
              const act = Math.abs(activations.get(s.out_node) ?? 0);
              return act > 0.1;
            }).map(s => {
              const from = nodePos.get(s.in_node);
              const to = nodePos.get(s.out_node);
              if (!from || !to) return null;
              const w = s.weight ?? 0;
              const t = pulseOffset;
              const px = from.x + (to.x - from.x) * t;
              const py = from.y + (to.y - from.y) * t;
              return (
                <circle key={`pulse-${s.innovation_id}`}
                  cx={px} cy={py} r={3}
                  fill={w > 0 ? '#00d4ff' : '#ff4444'}
                  fillOpacity={0.9}
                />
              );
            })}

            {/* Nodes */}
            {genome.node_genes
              .filter(n => n.type !== 'BODY_SEGMENT')
              .map(n => {
                const pos = nodePos.get(n.gene_id);
                if (!pos) return null;
                const activation = activations.get(n.gene_id) ?? 0;
                const nodeColor = n.type === 'INPUT' ? '#00ff88'
                  : n.type === 'OUTPUT' ? '#ff4444' : '#7d8590';
                const glowOpacity = 0.15 + Math.abs(activation) * 0.85;

                return (
                  <g key={n.gene_id}>
                    {/* Glow ring */}
                    <circle cx={pos.x} cy={pos.y} r={NODE_R + 4}
                      fill={nodeColor} fillOpacity={Math.abs(activation) * 0.15} />
                    {/* Node circle */}
                    <circle cx={pos.x} cy={pos.y} r={NODE_R}
                      fill={nodeColor} fillOpacity={glowOpacity}
                      stroke={nodeColor} strokeWidth="1" strokeOpacity="0.5" />
                    {/* Activation value */}
                    <text x={pos.x} y={pos.y + 1} textAnchor="middle"
                      dominantBaseline="middle" fill="#0d1117"
                      fontSize="11" fontFamily="monospace" fontWeight="bold">
                      {activation.toFixed(2)}
                    </text>
                    {/* Label */}
                    <text x={pos.x} y={pos.y + NODE_R + 10} textAnchor="middle"
                      fill="#7d8590" fontSize="13" fontFamily="monospace">
                      {nodeLabel(n)}
                    </text>
                  </g>
                );
              })}
          </svg>
        </div>

        {/* RIGHT: Oscilloscopes — scrollable */}
        <div className="overflow-y-auto flex flex-col">
          <div className="px-3 py-2 font-mono text-[10px] tracking-[0.2em] uppercase text-[#4a5568] flex-shrink-0"
            style={{ borderBottom: '1px solid #21262d' }}>
            Activation Traces
          </div>
          {genome.node_genes
            .filter(n => n.type !== 'BODY_SEGMENT')
            .map(n => {
              const hist = history.get(n.gene_id) ?? [];
              const activation = activations.get(n.gene_id) ?? 0;
              const nodeColor = n.type === 'INPUT' ? '#00ff88'
                : n.type === 'OUTPUT' ? '#ff4444' : '#7d8590';
              const W_OSC = 180, H_OSC = 48;

              // Build SVG path for oscilloscope trace
              const points = hist.map((v, i) => {
                const x = (i / Math.max(hist.length - 1, 1)) * W_OSC;
                const y = H_OSC / 2 - (v * H_OSC * 0.45);
                return `${x},${y}`;
              }).join(' ');

              return (
                <div key={n.gene_id} className="px-2 py-1.5 flex-shrink-0"
                  style={{ borderBottom: '1px solid #161b22' }}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-mono text-[10px]" style={{ color: nodeColor }}>
                      {nodeLabel(n)}
                    </span>
                    <span className="font-mono text-[10px] text-[#4a5568]">
                      {activation.toFixed(3)}
                    </span>
                  </div>
                  <svg width={W_OSC} height={H_OSC}
                    style={{ display: 'block', background: '#0a0f18' }}>
                    {/* Zero line */}
                    <line x1="0" y1={H_OSC / 2} x2={W_OSC} y2={H_OSC / 2}
                      stroke="#21262d" strokeWidth="0.5" />
                    {/* Trace */}
                    {points && (
                      <polyline points={points}
                        fill="none" stroke={nodeColor}
                        strokeWidth="1" strokeOpacity="0.9" />
                    )}
                    {/* Current value indicator */}
                    <circle cx={W_OSC - 2}
                      cy={H_OSC / 2 - (activation * H_OSC * 0.45)}
                      r="2" fill={nodeColor} />
                  </svg>
                  {hist.length > 0 && (
                    <div className="flex justify-between font-mono text-[10px]"
                      style={{ color: '#4a5568' }}>
                      <span>min {Math.min(...hist).toFixed(2)}</span>
                      <span>max {Math.max(...hist).toFixed(2)}</span>
                      <span>σ {standardDev(hist).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* BOTTOM: Forward Pass + Weight Matrix — fixed height */}
      <div className="flex-shrink-0 flex"
        style={{ height: '180px', borderTop: '1px solid #21262d', background: '#080c10' }}>

        {/* Forward Pass — wider */}
        <div className="flex-1 px-4 py-3 flex flex-col gap-1 overflow-y-auto"
          style={{ borderRight: '1px solid #21262d' }}>
          <div className="font-mono text-[10px] text-[#4a5568] tracking-[0.2em] uppercase mb-2 flex-shrink-0">
            Forward Pass — Current Tick
          </div>
          <div className="flex flex-col gap-1">
            {synapses.map(s => {
              const fromNode = genome.node_genes.find(n => n.gene_id === s.in_node);
              const toNode = genome.node_genes.find(n => n.gene_id === s.out_node);
              const inAct = activations.get(s.in_node) ?? 0;
              const w = s.weight ?? 0;
              const contribution = inAct * w;
              return (
                <div key={s.innovation_id} className="flex items-center gap-2 text-[12px]">
                  <span style={{ color: '#7d8590' }}>{nodeLabel(fromNode!)}</span>
                  <span style={{ color: '#4a5568' }}>×</span>
                  <span style={{ color: w > 0 ? '#00d4ff' : '#ff4444' }}>
                    {w > 0 ? '+' : ''}{w.toFixed(4)}
                  </span>
                  <span style={{ color: '#4a5568' }}>=</span>
                  <span style={{ color: Math.abs(contribution) > 0.1 ? '#00ff88' : '#4a5568' }}>
                    {contribution > 0 ? '+' : ''}{contribution.toFixed(4)}
                  </span>
                  <span style={{ color: '#4a5568' }}>→</span>
                  <span style={{ color: '#7d8590' }}>{nodeLabel(toNode!)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weight Matrix — fixed width */}
        <div className="px-4 py-3 flex flex-col gap-2 flex-shrink-0" style={{ width: '300px' }}>
          <div className="font-mono text-[10px] text-[#4a5568] tracking-[0.2em] uppercase flex-shrink-0">
            Weight Matrix
          </div>
          <svg width="260" height="120">
            {inputNodes.concat(hiddenNodes).map((inNode, row) =>
              outputNodes.concat(hiddenNodes).map((outNode, col) => {
                const synapse = synapses.find(
                  s => s.in_node === inNode.gene_id && s.out_node === outNode.gene_id
                );
                const w = synapse?.weight ?? 0;
                const cellW = 260 / Math.max(outputNodes.length + hiddenNodes.length, 1);
                const cellH = 120 / Math.max(inputNodes.length + hiddenNodes.length, 1);
                const isActive = Math.abs(activations.get(outNode.gene_id) ?? 0) > 0.1;
                return (
                  <rect key={`${inNode.gene_id}-${outNode.gene_id}`}
                    x={col * cellW + 1} y={row * cellH + 1}
                    width={cellW - 2} height={cellH - 2}
                    fill={w !== 0 ? (w > 0 ? '#00d4ff' : '#ff4444') : '#161b22'}
                    fillOpacity={w !== 0 ? Math.min(Math.abs(w) / 3, 1) * (isActive ? 1 : 0.4) : 1}
                    stroke={isActive && w !== 0 ? '#ffffff' : 'none'}
                    strokeWidth="0.5"
                  />
                );
              })
            )}
          </svg>
          <div className="flex items-center gap-3 font-mono text-[10px] text-[#4a5568]">
            <span style={{ color: '#00d4ff' }}>■</span> positive weight
            <span style={{ color: '#ff4444' }}>■</span> negative weight
            <span>opacity = |w|</span>
          </div>
        </div>
      </div>

      {/* Bottom stats row */}
      <div className="flex-shrink-0 flex items-center gap-6 px-4 py-2 font-mono"
        style={{ borderTop: '1px solid #21262d' }}>
        <span className="text-xs text-[#4a5568]">
          ACTIVE EDGES <span style={{ color: '#00d4ff' }}>{activeEdges}/{synapses.length}</span>
        </span>
        <span className="text-xs text-[#4a5568]">
          SPECIES <span style={{ color: '#00d4ff' }}>{genome.species_id}</span>
        </span>
        <span className="text-xs text-[#4a5568]">
          GEN <span style={{ color: '#00d4ff' }}>{genome.generation}</span>
        </span>
      </div>
    </div>
  );
}
