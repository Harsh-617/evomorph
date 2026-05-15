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
    isPlaying,
    togglePlay,
    nextGeneration,
    addHistoryRecord,
    gravity,
    friction,
    terrain,
  } = useSimulationStore();

  const [loading, setLoading] = useState(true);
  const [timer, setTimer] = useState(15.0);
  const [inspectorData, setInspectorData] = useState<{
    genome: Genome;
    activations: Map<number, number>;
  } | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const engineRef = useRef<SimulationEngine | null>(null);
  const generationRunning = useRef(false);

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
      elapsed += 0.1;
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
          const response = await evolvePopulation(generation, results, { gravity, friction, terrain });
          nextGeneration(response.genomes, response.stats.best_fitness);
          addHistoryRecord({
            generation,
            bestFitness: response.stats.best_fitness,
            avgFitness: response.stats.avg_fitness,
            speciesCount: response.stats.species_count,
          });
          setTimer(15.0);
        } catch (err) {
          console.error("Evolution failed:", err);
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <span className="text-cyan-400 font-mono animate-pulse">
          Initializing EvoMorph Engine...
        </span>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="h-16 flex-shrink-0 flex items-center justify-between px-6 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-6">
          <span className="text-xl font-bold text-white">EvoMorph</span>
          <span className="text-slate-400 text-sm">Gen: {generation}</span>
          <span className="text-slate-400 text-sm">
            Best: {bestFitness.toFixed(1)}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-cyan-400 font-mono text-sm">
            {timer.toFixed(1)}s
          </span>
          <button
            onClick={togglePlay}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-row overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <PhysicsArena
            onEngineReady={(engine) => {
              engineRef.current = engine;
            }}
            onActivationsUpdate={(genome, activations) =>
              setInspectorData({ genome, activations })
            }
            onLeaderboardUpdate={setLeaderboardData}
          />
        </div>
        <aside className="w-80 flex-shrink-0 min-h-0 overflow-y-auto flex flex-col gap-4 p-4 bg-slate-900 border-l border-slate-700">
          <NeuralInspector
            genome={inspectorData?.genome ?? null}
            activations={inspectorData?.activations ?? new Map()}
          />
          <GodModePanel />
          <Leaderboard entries={leaderboardData} />
        </aside>
      </main>

      <div className="h-40 flex-shrink-0">
        <PhylogenyTimeline />
      </div>
    </div>
  );
}
