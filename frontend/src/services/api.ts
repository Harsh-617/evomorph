import { Genome, CreatureResult } from "../types/genome";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface EvolveResponse {
  genomes: Genome[];
  stats: {
    best_fitness: number;
    avg_fitness: number;
    species_count: number;
  };
}

export async function fetchGenesis(): Promise<Genome[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/genesis`);
    if (!res.ok) {
      throw new Error(`GET /api/genesis failed with status ${res.status}`);
    }
    return res.json() as Promise<Genome[]>;
  } catch (err) {
    console.error("fetchGenesis error:", err);
    throw err;
  }
}

export interface EnvironmentParams {
  gravity: number;
  friction: number;
  terrain: string;
}

export async function evolvePopulation(
  generation: number,
  scores: CreatureResult[],
  environment: EnvironmentParams = { gravity: 1.0, friction: 0.6, terrain: "flat" }
): Promise<EvolveResponse> {
  try {
    const res = await fetch(`${BASE_URL}/api/evolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generation, scores, environment }),
    });
    if (!res.ok) {
      throw new Error(`POST /api/evolve failed with status ${res.status}`);
    }
    return res.json() as Promise<EvolveResponse>;
  } catch (err) {
    console.error("evolvePopulation error:", err);
    throw err;
  }
}
