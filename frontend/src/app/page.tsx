"use client";

import { useEffect, useRef, useState } from "react";
import { fetchGenesis, evolvePopulation } from "@/services/api";
import { useSimulationStore } from "@/store/simulationStore";
import PhysicsArena from "@/components/arena/PhysicsArena";
import GodModePanel from "@/components/godmode/GodModePanel";
import NeuralInspector from "@/components/inspector/NeuralInspector";
import Leaderboard, { LeaderboardEntry } from "@/components/leaderboard/Leaderboard";
import PhylogenyTimeline from "@/components/phylogeny/PhylogenyTimeline";
import { CreatureResult, Genome } from "@/types/genome";
import { SimulationEngine } from "@/engine/SimulationLoop";

export default function Home() {
  const {
    population,
    setPopulation,
    generation,
    bestFitness,
    allTimeRecord,
    isPlaying,
    simulationSpeed,
    setSimulationSpeed,
    togglePlay,
  } = useSimulationStore();

  const handleReset = async () => {
    generationRunning.current = false;
    setTimer(15.0);
    const genomes = await fetchGenesis();
    setPopulation(genomes);
    useSimulationStore.setState({ generation: 0, bestFitness: 0, history: [] });
  };

  const [loading, setLoading] = useState(true);
  const [timer, setTimer] = useState(15.0);
  const [inspectorData, setInspectorData] = useState<{
    genome: Genome;
    activations: Map<number, number>;
  } | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const engineRef = useRef<SimulationEngine | null>(null);
  const generationRunning = useRef(false);
  const simulationSpeedRef = useRef(simulationSpeed);
  useEffect(() => {
    simulationSpeedRef.current = simulationSpeed;
  }, [simulationSpeed]);

  useEffect(() => {
    if (population.length === 0) {
      fetchGenesis().then((genomes) => {
        setPopulation(genomes);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isPlaying || population.length === 0) return;
    if (generationRunning.current) return;
    generationRunning.current = true;

    let elapsed = 0;
    const GENERATION_TIME = 15.0;
    const interval = setInterval(async () => {
      elapsed += 0.1 * simulationSpeedRef.current;
      setTimer(Math.max(0, GENERATION_TIME - elapsed));

      if (elapsed >= GENERATION_TIME) {
        clearInterval(interval);
        generationRunning.current = false;

        const results: CreatureResult[] = engineRef.current
          ? engineRef.current.getResults()
          : population.map((g) => ({
              genome_id: g.genome_id,
              fitness: 0,
              max_x_position: 0,
              time_upright: 0,
              cumulative_torque: 0,
              head_ground_time: 0,
              num_joints: 0,
              max_torque: 0,
              final_x: 0,
              final_y: 0,
              alive: true,
            }));

        try {
          const { gravity: g, friction: fr, terrain: t, generation: gen } = useSimulationStore.getState();
          const response = await evolvePopulation(gen, results, { gravity: g, friction: fr, terrain: t });
          useSimulationStore.getState().nextGeneration(response.genomes, response.stats.best_fitness);
          useSimulationStore.getState().addHistoryRecord({
            generation: gen,
            bestFitness: response.stats.best_fitness,
            avgFitness: response.stats.avg_fitness,
            speciesCount: response.stats.species_count,
            environment: { gravity: g, friction: fr, terrain: t },
          });
          setTimer(15.0);
        } catch (err) {
          console.error('[EvoMorph] Evolution failed:', err);
          generationRunning.current = false;
        }
      }
    }, 100);

    return () => {
      clearInterval(interval);
      generationRunning.current = false;
    };
  }, [isPlaying, population, generation]);

  if (loading) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-[#0d1117]">
        <div className="border border-[#00d4ff] px-8 py-6 flex flex-col items-center gap-4">
          <div className="text-[#00d4ff] font-mono text-xs tracking-[0.3em] uppercase">
            EvoMorph
          </div>
          <div className="text-[#7d8590] font-mono text-xs animate-pulse">
            Initializing evolution engine...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: '#0d1117' }}>

      {/* PHYSICS ARENA */}
      <div className="absolute left-0 right-0 arena-scanlines"
        style={{ top: '40px', bottom: '128px' }}>
        <PhysicsArena
          onEngineReady={(engine) => { engineRef.current = engine; }}
          onActivationsUpdate={(genome, activations) => setInspectorData({ genome, activations })}
          onLeaderboardUpdate={setLeaderboardData}
        />
      </div>

      {/* TOP BAR — minimal HUD strip */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 h-10"
        style={{ background: 'rgba(13,17,23,0.85)', borderBottom: '1px solid #21262d' }}>

        {/* Left: Logo + metrics */}
        <div className="flex items-center gap-6">
          <span className="font-mono text-xs font-semibold tracking-[0.2em] text-[#00d4ff] uppercase">
            EvoMorph
          </span>
          <div className="flex items-center gap-4 font-mono text-xs">
            <span className="text-[#7d8590]">GEN <span className="text-[#e6edf3]">{generation.toString().padStart(3, '0')}</span></span>
            <span className="text-[#7d8590]">BEST <span className="text-[#00d4ff]">{bestFitness.toFixed(1)}</span></span>
            <span className="text-[#7d8590]">RECORD <span className="text-[#f59e0b]">{allTimeRecord.toFixed(1)}</span></span>
          </div>
        </div>

        {/* Center: Timer */}
        <div className="font-mono text-sm font-semibold"
          style={{ color: timer < 3 ? '#ff4444' : '#e6edf3' }}>
          {timer.toFixed(1)}s
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-3">
          {/* Speed buttons */}
          <div className="flex items-center gap-1">
            {([1, 2, 5] as const).map((speed) => (
              <button
                key={speed}
                onClick={() => setSimulationSpeed(speed)}
                className="font-mono text-xs px-2 py-0.5 transition-colors"
                style={{
                  border: '1px solid',
                  borderColor: simulationSpeed === speed ? '#00d4ff' : '#21262d',
                  color: simulationSpeed === speed ? '#00d4ff' : '#7d8590',
                  background: simulationSpeed === speed ? 'rgba(0,212,255,0.08)' : 'transparent',
                }}
              >
                {speed}×
              </button>
            ))}
          </div>

          {/* New Population */}
          <button
            onClick={handleReset}
            className="font-mono text-xs px-3 py-0.5 transition-colors text-[#7d8590] hover:text-[#e6edf3]"
            style={{ border: '1px solid #21262d' }}
          >
            RESET
          </button>

          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="font-mono text-xs px-4 py-0.5 font-semibold transition-colors"
            style={{
              border: '1px solid #00d4ff',
              color: isPlaying ? '#0d1117' : '#00d4ff',
              background: isPlaying ? '#00d4ff' : 'transparent',
            }}
          >
            {isPlaying ? 'PAUSE' : 'PLAY'}
          </button>
        </div>
      </div>

      {/* LEFT PANEL — Neural Inspector, pinned to left edge */}
      <div className="absolute left-0 top-10 bottom-32 z-10 w-56 overflow-y-auto"
        style={{ background: 'rgba(13,17,23,0.9)', borderRight: '1px solid #21262d' }}>
        <NeuralInspector
          genome={inspectorData?.genome ?? null}
          activations={inspectorData?.activations ?? new Map()}
        />
      </div>

      {/* RIGHT PANEL — God Mode + Leaderboard */}
      <div className="absolute right-0 top-10 bottom-32 z-10 w-52 overflow-y-auto flex flex-col"
        style={{ background: 'rgba(13,17,23,0.9)', borderLeft: '1px solid #21262d' }}>
        <GodModePanel />
        <div style={{ borderTop: '1px solid #21262d' }}>
          <Leaderboard entries={leaderboardData} />
        </div>
      </div>

      {/* BOTTOM STRIP — Phylogeny Timeline */}
      <div className="absolute bottom-0 left-0 right-0 z-10 h-32"
        style={{ background: 'rgba(13,17,23,0.9)', borderTop: '1px solid #21262d' }}>
        <PhylogenyTimeline />
      </div>

    </div>
  );
}
