'use client';

import { useSimulationStore } from '@/store/simulationStore';

export default function GodModePanel() {
  const { gravity, friction, terrain, updatePhysics, setTerrain } =
    useSimulationStore();

  return (
    <div className="flex flex-col gap-6 p-4 bg-slate-800 rounded-xl border border-slate-700">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
        God Mode
      </h3>

      {/* Gravity Slider */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-300">Gravity</span>
          <span className="text-cyan-400 font-mono">{gravity.toFixed(1)}x</span>
        </div>
        <input
          type="range" min="0.1" max="3.0" step="0.1"
          value={gravity}
          onChange={(e) => updatePhysics(parseFloat(e.target.value), friction)}
          className="w-full accent-cyan-400"
        />
        <div className="flex justify-between text-xs text-slate-500">
          <span>0.1x</span><span>3.0x</span>
        </div>
      </div>

      {/* Friction Slider */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-300">Friction</span>
          <span className="text-cyan-400 font-mono">{friction.toFixed(2)}</span>
        </div>
        <input
          type="range" min="0.0" max="1.0" step="0.05"
          value={friction}
          onChange={(e) => updatePhysics(gravity, parseFloat(e.target.value))}
          className="w-full accent-cyan-400"
        />
        <div className="flex justify-between text-xs text-slate-500">
          <span>Ice 0.0</span><span>Rubber 1.0</span>
        </div>
      </div>

      {/* Terrain Selector */}
      <div className="flex flex-col gap-2">
        <span className="text-sm text-slate-300">Terrain</span>
        <div className="grid grid-cols-2 gap-2">
          {(['flat', 'hurdles', 'stairs', 'hills'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTerrain(t)}
              className={`py-2 px-3 rounded-lg text-xs font-medium capitalize transition-colors ${
                terrain === t
                  ? 'bg-cyan-500 text-slate-900'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Change indicator */}
      {(gravity !== 1.0 || friction !== 0.6 || terrain !== 'flat') && (
        <p className="text-xs text-amber-400 text-center">
          ⚡ Changes apply next generation
        </p>
      )}
    </div>
  );
}
