import random
import uuid
from typing import List

from fastapi import APIRouter

from ..schemas.genome import (
    Genome,
    NeuralNetwork,
    NodeGene,
    NodeType,
    SensorType,
)

router = APIRouter(tags=["evolution"])

_POPULATION_SIZE = 20


def generate_minimal_genome() -> Genome:
    torso = NodeGene(
        gene_id=0,
        type=NodeType.BODY_SEGMENT,
        width=round(random.uniform(10.0, 60.0), 4),
        height=round(random.uniform(5.0, 30.0), 4),
        density=round(random.uniform(0.5, 3.0), 4),
        friction=round(random.uniform(0.1, 1.0), 4),
    )

    sensors = [
        NodeGene(
            gene_id=1,
            type=NodeType.INPUT,
            sensor_type=SensorType.BODY_ANGLE,
            attached_segment_id=0,
        ),
        NodeGene(
            gene_id=2,
            type=NodeType.INPUT,
            sensor_type=SensorType.GROUND_CONTACT,
            attached_segment_id=0,
        ),
        NodeGene(
            gene_id=3,
            type=NodeType.INPUT,
            sensor_type=SensorType.OSCILLATOR,
            attached_segment_id=0,
        ),
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


@router.get("/genesis", response_model=List[Genome])
def genesis() -> List[Genome]:
    return [generate_minimal_genome() for _ in range(_POPULATION_SIZE)]
