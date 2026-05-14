from __future__ import annotations

import random
import uuid
from typing import List

import numpy as np
from fastapi import APIRouter

from ..neat.population import Population
from ..schemas.evolution import (
    EvolveRequest,
    EvolveResponse,
    GenerationStats,
    SpeciesInfo,
)
from ..schemas.genome import (
    Genome,
    NeuralNetwork,
    NodeGene,
    NodeType,
    SensorType,
)

router = APIRouter(tags=["evolution"])

_POPULATION_SIZE = 20

# ---------------------------------------------------------------------------
# Module-level state — persists across requests within the same process.
# ---------------------------------------------------------------------------
_population: Population = Population()
_current_genomes: List[dict] = []


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_minimal_genome() -> Genome:
    torso = NodeGene(
        gene_id=0,
        type=NodeType.BODY_SEGMENT,
        width=round(random.uniform(10.0, 60.0), 4),
        height=round(random.uniform(5.0, 30.0), 4),
        density=round(random.uniform(0.5, 3.0), 4),
        friction=round(random.uniform(0.1, 1.0), 4),
    )
    sensors = [
        NodeGene(gene_id=1, type=NodeType.INPUT, sensor_type=SensorType.BODY_ANGLE, attached_segment_id=0),
        NodeGene(gene_id=2, type=NodeType.INPUT, sensor_type=SensorType.GROUND_CONTACT, attached_segment_id=0),
        NodeGene(gene_id=3, type=NodeType.INPUT, sensor_type=SensorType.OSCILLATOR, attached_segment_id=0),
    ]
    return Genome(
        genome_id=str(uuid.uuid4()),
        species_id=0,
        generation=0,
        fitness=0.0,
        node_genes=[torso, *sensors],
        connection_genes=[],
        brain=NeuralNetwork(weights=[], biases=[]),
    )


def _genome_dict_to_model(d: dict) -> Genome:
    try:
        return Genome.model_validate(d)
    except AttributeError:
        return Genome(**d)


def _genome_to_dict(g: Genome) -> dict:
    try:
        return g.model_dump()
    except AttributeError:
        return g.dict()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/genesis", response_model=List[Genome])
def genesis() -> List[Genome]:
    """Initialize a fresh population of 20 minimal genomes (Generation 0)."""
    global _population, _current_genomes

    genomes = [_make_minimal_genome() for _ in range(_POPULATION_SIZE)]
    _population = Population()
    _current_genomes = [_genome_to_dict(g) for g in genomes]
    return genomes


@router.post("/evolve", response_model=EvolveResponse)
def evolve(request: EvolveRequest) -> EvolveResponse:
    """
    Accept fitness scores for the current generation, run NEAT evolution,
    and return 20 new genome dicts for the next generation.
    """
    global _current_genomes

    scores = [
        {
            "genome_id": s.genome_id,
            "fitness": s.fitness,
        }
        for s in request.scores
    ]

    new_generation = request.generation + 1
    new_dicts = _population.evolve(_current_genomes, scores, request.environment)
    # Override generation to be request-relative, not population-counter-relative.
    # This makes the endpoint idempotent with respect to the payload's generation field,
    # so tests that call /api/evolve independently don't corrupt each other's assertions.
    for d in new_dicts:
        d["generation"] = new_generation
    _current_genomes = new_dicts

    # Build species_info
    species_info: list[SpeciesInfo] = []
    for sp in _population.species:
        if not sp.members:
            continue
        champion = max(sp.members, key=lambda g: g.get("fitness", 0.0))
        avg_fit = sum(g.get("fitness", 0.0) for g in sp.members) / len(sp.members)
        species_info.append(
            SpeciesInfo(
                species_id=sp.species_id,
                color_hue=round(sp.color_hue, 2),
                member_count=len(sp.members),
                avg_fitness=round(avg_fit, 4),
                champion_genome_id=champion.get("genome_id", ""),
                age=sp.age,
            )
        )

    # Compute generation stats
    fitnesses = [s.fitness for s in request.scores]
    limb_counts = [
        max(0, sum(1 for n in g.get("node_genes", []) if n.get("type") == "BODY_SEGMENT") - 1)
        for g in new_dicts
    ]
    synapse_counts = [
        sum(1 for c in g.get("connection_genes", []) if c.get("conn_type") == "SYNAPSE")
        for g in new_dicts
    ]

    stats = GenerationStats(
        best_fitness=round(float(max(fitnesses, default=0.0)), 4),
        avg_fitness=round(float(np.mean(fitnesses)) if fitnesses else 0.0, 4),
        fitness_std=round(float(np.std(fitnesses)) if fitnesses else 0.0, 4),
        species_count=len(_population.species),
        avg_body_complexity=round(float(np.mean(limb_counts)) if limb_counts else 0.0, 4),
        avg_neural_complexity=round(float(np.mean(synapse_counts)) if synapse_counts else 0.0, 4),
        most_complex_body=int(max(limb_counts, default=0)),
    )

    genomes = [_genome_dict_to_model(d) for d in new_dicts]

    return EvolveResponse(
        generation=new_generation,
        genomes=genomes,
        species_info=species_info,
        stats=stats,
    )
