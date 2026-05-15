"use client";

import {
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { useSimulationStore } from "@/store/simulationStore";

export default function PhylogenyTimeline() {
  const history = useSimulationStore((s) => s.history);

  if (history.length === 0) {
    return (
      <div className="h-32 flex-shrink-0 bg-slate-900 border-t border-slate-700 flex items-center justify-center">
        <span className="text-slate-500 font-mono text-sm">
          Waiting for first generation...
        </span>
      </div>
    );
  }

  const changePoints = history.reduce((acc, record, i) => {
    if (i === 0) return acc;
    const prev = history[i - 1];
    if (
      prev.environment.gravity !== record.environment.gravity ||
      prev.environment.friction !== record.environment.friction ||
      prev.environment.terrain !== record.environment.terrain
    ) {
      acc.push({ generation: record.generation, label: record.environment.terrain });
    }
    return acc;
  }, [] as Array<{ generation: number; label: string }>);

  return (
    <div className="w-full h-40 bg-slate-900 border-t border-slate-700 px-4 pt-2 pb-1 flex-shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={history}
          margin={{ top: 8, right: 16, bottom: 4, left: 0 }}
        >
          <XAxis
            dataKey="generation"
            tick={{ fill: "#64748b", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis yAxisId="fitness" hide />
          <YAxis yAxisId="species" hide />
          <Tooltip
            contentStyle={{
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: 4,
              fontSize: 11,
              color: "#e2e8f0",
            }}
            itemStyle={{ color: "#e2e8f0" }}
            labelStyle={{ color: "#94a3b8" }}
          />
          <Area
            type="monotone"
            dataKey="avgFitness"
            fill="#1e3a5f"
            stroke="#3b82f6"
            fillOpacity={0.4}
            strokeWidth={1}
            dot={false}
            name="Avg Fitness"
            yAxisId="fitness"
          />
          <Line
            type="monotone"
            dataKey="bestFitness"
            stroke="#22d3ee"
            strokeWidth={2}
            dot={false}
            name="Best Fitness"
            yAxisId="fitness"
          />
          <Bar
            dataKey="speciesCount"
            fill="#1e3a5f"
            opacity={0.6}
            yAxisId="species"
            name="Species"
          />
          {changePoints.map((cp) => (
            <ReferenceLine
              key={cp.generation}
              x={cp.generation}
              stroke="#f59e0b"
              strokeDasharray="3 3"
              label={{ value: cp.label, fill: "#f59e0b", fontSize: 9 }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
