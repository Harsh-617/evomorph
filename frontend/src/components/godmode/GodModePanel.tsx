'use client';

import { useSimulationStore } from '@/store/simulationStore';

export default function GodModePanel() {
  const { gravity, friction, terrain, updatePhysics, setTerrain } =
    useSimulationStore();

  return (
    <div className="flex flex-col">

      {/* Header */}
      <div className="px-3 py-2 flex items-center gap-2 flex-shrink-0"
        style={{ borderBottom: '1px solid #21262d' }}>
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#00d4ff' }} />
        <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#7d8590]">
          God Mode
        </span>
      </div>

      <div className="p-3 flex flex-col gap-4">

        {/* Gravity */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <span className="font-mono text-[10px] text-[#7d8590] uppercase tracking-wider">Gravity</span>
            <span className="font-mono text-[11px] text-[#00d4ff]">{gravity.toFixed(1)}×</span>
          </div>
          <input type="range" min="0.1" max="3.0" step="0.1"
            value={gravity}
            onChange={(e) => updatePhysics(parseFloat(e.target.value), friction)}
            className="w-full h-0.5 appearance-none cursor-pointer"
            style={{ accentColor: '#00d4ff' }}
          />
          <div className="flex justify-between font-mono text-[9px] text-[#4a5568]">
            <span>0.1×</span><span>3.0×</span>
          </div>
        </div>

        {/* Friction */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <span className="font-mono text-[10px] text-[#7d8590] uppercase tracking-wider">Friction</span>
            <span className="font-mono text-[11px] text-[#00d4ff]">{friction.toFixed(2)}</span>
          </div>
          <input type="range" min="0.0" max="1.0" step="0.05"
            value={friction}
            onChange={(e) => updatePhysics(gravity, parseFloat(e.target.value))}
            className="w-full h-0.5 appearance-none cursor-pointer"
            style={{ accentColor: '#00d4ff' }}
          />
          <div className="flex justify-between font-mono text-[9px] text-[#4a5568]">
            <span>ICE</span><span>RUBBER</span>
          </div>
        </div>

        {/* Terrain */}
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] text-[#7d8590] uppercase tracking-wider">Terrain</span>
          <div className="grid grid-cols-2 gap-1">
            {(['flat', 'hurdles', 'stairs', 'hills'] as const).map((t) => (
              <button key={t} onClick={() => setTerrain(t)}
                className="font-mono text-[9px] uppercase tracking-wider py-1.5 transition-colors"
                style={{
                  border: '1px solid',
                  borderColor: terrain === t ? '#00d4ff' : '#21262d',
                  color: terrain === t ? '#00d4ff' : '#7d8590',
                  background: terrain === t ? 'rgba(0,212,255,0.06)' : 'transparent',
                }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Change indicator */}
        {(gravity !== 1.0 || friction !== 0.6 || terrain !== 'flat') && (
          <div className="font-mono text-[9px] text-[#f59e0b] text-center py-1"
            style={{ border: '1px solid rgba(245,158,11,0.3)' }}>
            ⚡ NEXT GENERATION
          </div>
        )}
      </div>
    </div>
  );
}
