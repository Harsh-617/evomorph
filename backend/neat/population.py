from __future__ import annotations

import copy
import random
import uuid
from backend.neat import config
from backend.neat.innovation import InnovationTracker
from backend.neat.reproduction import crossover, mutate
from backend.neat.species import Species, compatibility_distance
from backend.schemas.evolution import EnvironmentConfig

_ADJUSTED = "_adjusted_fitness"


def _tournament_select(members: list[dict], k: int = 3) -> dict:
    """Select the fittest genome from a random sample of size k (tournament selection)."""
    contestants = random.sample(members, min(k, len(members)))
    return max(contestants, key=lambda g: g.get(_ADJUSTED, 0.0))


class Population:
    def __init__(self) -> None:
        self.species: list[Species] = []
        self.innovation_tracker: InnovationTracker = InnovationTracker()
        self.generation: int = 0
        self._next_species_id: int = 0  # starts at 0 so genesis species_id=0 is preserved
        self._last_scored_species: list = []

    # ------------------------------------------------------------------
    # Speciation
    # ------------------------------------------------------------------

    def speciate(self, genomes: list[dict]) -> None:
        """Assign each genome to a species; create new species when no match found."""
        for sp in self.species:
            sp.members = []

        for genome in genomes:
            placed = False
            for sp in self.species:
                if compatibility_distance(genome, sp.representative) < config.SPECIES_THRESHOLD:
                    sp.members.append(genome)
                    genome["species_id"] = sp.species_id
                    placed = True
                    break
            if not placed:
                new_sp = self._new_species(genome)
                new_sp.members.append(genome)
                genome["species_id"] = new_sp.species_id
                self.species.append(new_sp)

        # Prune extinct species
        self.species = [sp for sp in self.species if sp.members]

        # Elect new representatives
        for sp in self.species:
            sp.assign_representative()

    def _new_species(self, representative: dict) -> Species:
        sp = Species(self._next_species_id, representative)
        self._next_species_id += 1
        return sp

    # ------------------------------------------------------------------
    # Main evolution step
    # ------------------------------------------------------------------

    def evolve(
        self,
        genomes: list[dict],
        scores: list[dict],
        environment: EnvironmentConfig,
    ) -> list[dict]:
        """
        Run one generation of NEAT evolution.

        Steps
        -----
        1  Assign raw fitness scores from the simulation results.
        2  Speciate the current population.
        3  Compute adjusted fitness (raw / species_size).
        4  Kill the bottom 20 % of each species.
        5  Allocate offspring counts proportional to average adjusted fitness.
        6  Produce offspring (elitism + crossover 75 % / asexual 25 %).
        7  Re-speciate the new population.
        8  Reset the innovation tracker for the next generation.
        9  Return exactly POPULATION_SIZE new genome dicts.
        """
        # 1. Assign fitness scores
        score_map: dict[str, float] = {s["genome_id"]: s["fitness"] for s in scores}
        for g in genomes:
            g["fitness"] = max(0.0, score_map.get(g["genome_id"], 0.0))

        # 2. Speciate
        self.speciate(genomes)

        # Age surviving species exactly once per generation
        for sp in self.species:
            sp.age += 1

        # 3. Adjusted fitness
        for sp in self.species:
            size = max(len(sp.members), 1)
            for g in sp.members:
                g[_ADJUSTED] = g["fitness"] / size

        # Snapshot scored species before culling overwrites members
        self._last_scored_species = [
            {"species_id": sp.species_id, "members": list(sp.members)}
            for sp in self.species if sp.members
        ]

        # 4. Kill bottom 20 % within each species (keep top 80 %)
        for sp in self.species:
            sp.members.sort(key=lambda g: g[_ADJUSTED])
            kill = max(0, int(len(sp.members) * (1.0 - config.SURVIVAL_RATE)))
            sp.members = sp.members[kill:]

        # 4b. Elect representatives from surviving members (post-cull champions)
        for sp in self.species:
            if sp.members:
                sp.representative = max(sp.members, key=lambda g: g.get("fitness", 0.0))

        # 5. Allocate offspring
        species_avgs = [
            (sp, sum(g[_ADJUSTED] for g in sp.members) / max(len(sp.members), 1))
            for sp in self.species
            if sp.members
        ]
        total_avg = sum(avg for _, avg in species_avgs)

        if total_avg <= 0.0 or not species_avgs:
            # All zero fitness: equal allocation
            per = config.POPULATION_SIZE // max(len(species_avgs), 1)
            allocations = [(sp, per) for sp, _ in species_avgs]
        else:
            remaining = config.POPULATION_SIZE
            allocations: list[tuple[Species, int]] = []
            for i, (sp, avg) in enumerate(species_avgs):
                if i == len(species_avgs) - 1:
                    cnt = max(0, remaining)
                else:
                    cnt = min(max(int(round(avg / total_avg * config.POPULATION_SIZE)), 0), remaining)
                allocations.append((sp, cnt))
                remaining -= cnt

        # Guarantee sum == POPULATION_SIZE
        total_alloc = sum(c for _, c in allocations)
        deficit = config.POPULATION_SIZE - total_alloc
        if deficit != 0 and allocations:
            best_idx = max(range(len(allocations)), key=lambda i: len(allocations[i][0].members))
            sp, cnt = allocations[best_idx]
            allocations[best_idx] = (sp, max(0, cnt + deficit))

        # 6. Produce offspring
        self.generation += 1
        new_genomes: list[dict] = []

        for sp, offspring_count in allocations:
            if not sp.members or offspring_count <= 0:
                continue

            sp.members.sort(key=lambda g: g[_ADJUSTED], reverse=True)
            champion = sp.members[0]

            # Elitism: copy champion for species with 5+ members
            if len(sp.members) >= config.ELITISM_THRESHOLD and offspring_count >= 1:
                elite = copy.deepcopy(champion)
                elite["genome_id"] = str(uuid.uuid4())
                elite["generation"] = self.generation
                elite["fitness"] = 0.0
                elite.pop(_ADJUSTED, None)
                new_genomes.append(elite)
                offspring_count -= 1

            for _ in range(offspring_count):
                if random.random() < config.CROSSOVER_RATE and len(sp.members) >= 2:
                    pa = _tournament_select(sp.members)
                    pb = _tournament_select(sp.members)
                    if pb[_ADJUSTED] > pa[_ADJUSTED]:
                        pa, pb = pb, pa
                    child = crossover(pa, pb)
                else:
                    child = copy.deepcopy(_tournament_select(sp.members))

                child = mutate(child, self.innovation_tracker)
                child["genome_id"] = str(uuid.uuid4())
                child["generation"] = self.generation
                child["fitness"] = 0.0
                child.pop(_ADJUSTED, None)
                new_genomes.append(child)

        # Pad to exactly POPULATION_SIZE if rounding left us short
        all_survivors = [g for sp in self.species for g in sp.members]
        while len(new_genomes) < config.POPULATION_SIZE and all_survivors:
            parent = random.choice(all_survivors)
            child = mutate(copy.deepcopy(parent), self.innovation_tracker)
            child["genome_id"] = str(uuid.uuid4())
            child["generation"] = self.generation
            child["fitness"] = 0.0
            child.pop(_ADJUSTED, None)
            new_genomes.append(child)

        new_genomes = new_genomes[: config.POPULATION_SIZE]

        # 7. Re-speciate the offspring
        self.speciate(new_genomes)

        # 8. Reset per-generation innovation history
        self.innovation_tracker.reset_generation()

        # Clean internal keys before returning
        for g in new_genomes:
            g.pop(_ADJUSTED, None)

        return new_genomes
