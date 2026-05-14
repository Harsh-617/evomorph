"use client";

import { useEffect, useState } from "react";
import { useSimulationStore } from "../store/simulationStore";
import { fetchGenesis } from "../services/api";
import PhysicsArena from "../components/arena/PhysicsArena";

export default function Home() {
  const { population, setPopulation, generation, isPlaying, togglePlay } =
    useSimulationStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (population.length === 0) {
      setLoading(true);
      fetchGenesis()
        .then((genomes) => setPopulation(genomes))
        .finally(() => setLoading(false));
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      <header className="h-16 flex items-center justify-between px-6 bg-slate-800">
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold">EvoMorph</span>
          <span className="text-slate-400 text-sm">Gen: {generation}</span>
        </div>
        <button
          onClick={togglePlay}
          className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition-colors"
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
      </header>

      <main className="flex-grow flex items-center justify-center">
        {loading ? (
          <p className="text-slate-400 text-sm">Initializing EvoMorph Engine...</p>
        ) : (
          <PhysicsArena />
        )}
      </main>
    </div>
  );
}
