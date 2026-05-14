from __future__ import annotations

from typing import List

from pydantic import BaseModel

from backend.schemas.genome import Genome


class CreatureResult(BaseModel):
    genome_id: str
    fitness: float
    max_x_position: float
    time_upright: float
    cumulative_torque: float
    head_ground_time: float
    num_joints: int
    max_torque: float
    final_x: float
    final_y: float
    alive: bool


class EnvironmentConfig(BaseModel):
    gravity: float = 1.0
    friction: float = 0.6
    terrain: str = "flat"


class EvolveRequest(BaseModel):
    generation: int
    scores: List[CreatureResult]
    environment: EnvironmentConfig


class SpeciesInfo(BaseModel):
    species_id: int
    color_hue: float
    member_count: int
    avg_fitness: float
    champion_genome_id: str
    age: int


class GenerationStats(BaseModel):
    best_fitness: float
    avg_fitness: float
    fitness_std: float
    species_count: int
    avg_body_complexity: float
    avg_neural_complexity: float
    most_complex_body: int


class EvolveResponse(BaseModel):
    generation: int
    genomes: List[Genome]
    species_info: List[SpeciesInfo]
    stats: GenerationStats
