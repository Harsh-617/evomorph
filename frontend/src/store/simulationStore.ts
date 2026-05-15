import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Genome } from '../types/genome';

export interface GenerationRecord {
  generation: number;
  bestFitness: number;
  avgFitness: number;
  speciesCount: number;
}

interface SimulationState {
  // Simulation progress
  generation: number;
  bestFitness: number;
  allTimeRecord: number;
  population: Genome[];
  history: GenerationRecord[];

  // God Mode sliders
  gravity: number;
  friction: number;
  terrain: string;

  // UI state
  isPlaying: boolean;
  simulationSpeed: 1 | 2 | 5;

  // Actions
  setPopulation: (genomes: Genome[]) => void;
  updatePhysics: (gravity: number, friction: number) => void;
  setTerrain: (type: string) => void;
  nextGeneration: (newGenomes: Genome[], fitness: number) => void;
  togglePlay: () => void;
  addHistoryRecord: (record: GenerationRecord) => void;
  setSimulationSpeed: (speed: 1 | 2 | 5) => void;
}

export const useSimulationStore = create<SimulationState>()(
  persist(
    (set) => ({
      generation: 0,
      bestFitness: 0,
      allTimeRecord: 0,
      population: [],
      history: [],

      gravity: 1.0,
      friction: 0.6,
      terrain: 'flat',

      isPlaying: false,
      simulationSpeed: 1,

      setPopulation: (genomes) => set({ population: genomes }),

      updatePhysics: (gravity, friction) => set({ gravity, friction }),

      setTerrain: (type) => set({ terrain: type }),

      nextGeneration: (newGenomes, fitness) =>
        set((state) => ({
          generation: state.generation + 1,
          population: newGenomes,
          bestFitness: fitness,
          allTimeRecord: Math.max(state.allTimeRecord, fitness),
        })),

      togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

      addHistoryRecord: (record) =>
        set((state) => ({ history: [...state.history, record] })),

      setSimulationSpeed: (speed) => set({ simulationSpeed: speed }),
    }),
    {
      name: 'evomorph-simulation',
      partialize: (state) => ({ allTimeRecord: state.allTimeRecord }),
    }
  )
);
