from __future__ import annotations

import math
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

_HALF_PI = math.pi / 2  # ±π/2 joint angle boundary ≈ 1.5708


class NodeType(str, Enum):
    BODY_SEGMENT = "BODY_SEGMENT"
    INPUT = "INPUT"
    OUTPUT = "OUTPUT"
    HIDDEN = "HIDDEN"


class SensorType(str, Enum):
    JOINT_ANGLE = "JOINT_ANGLE"
    GROUND_CONTACT = "GROUND_CONTACT"
    BODY_ANGLE = "BODY_ANGLE"
    ANGULAR_VELOCITY = "ANGULAR_VELOCITY"
    OSCILLATOR = "OSCILLATOR"


class ActivationType(str, Enum):
    TANH = "tanh"
    RELU = "relu"
    SIGMOID = "sigmoid"


class ConnectionType(str, Enum):
    JOINT = "JOINT"
    SYNAPSE = "SYNAPSE"


class NodeGene(BaseModel):
    gene_id: int = Field(..., description="Globally unique identifier across the population")
    type: NodeType

    # Body segment morphology — valid only when type == BODY_SEGMENT
    width: Optional[float] = Field(None, ge=10.0, le=60.0)
    height: Optional[float] = Field(None, ge=5.0, le=30.0)
    density: Optional[float] = Field(None, ge=0.5, le=3.0)
    friction: Optional[float] = Field(None, ge=0.1, le=1.0)

    # Neural properties
    activation: Optional[ActivationType] = None          # HIDDEN nodes only
    attached_segment_id: Optional[int] = None            # INPUT / OUTPUT nodes
    sensor_type: Optional[SensorType] = None             # INPUT nodes only


class ConnectionGene(BaseModel):
    innovation_id: int = Field(..., description="Globally unique historical marker; aligns genes during NEAT crossover")
    in_node: int
    out_node: int
    conn_type: ConnectionType
    enabled: bool

    # Joint properties — valid only when conn_type == JOINT
    angle_limit_min: Optional[float] = Field(None, ge=-_HALF_PI, le=0.0)
    angle_limit_max: Optional[float] = Field(None, ge=0.0, le=_HALF_PI)
    max_motor_torque: Optional[float] = Field(None, ge=50.0, le=500.0)

    # Synapse properties — valid only when conn_type == SYNAPSE
    weight: Optional[float] = Field(None, ge=-3.0, le=3.0)


class NeuralNetwork(BaseModel):
    weights: list[list[float]] = Field(default_factory=list)
    biases: list[float] = Field(default_factory=list)


class Genome(BaseModel):
    genome_id: str
    species_id: int
    generation: int = Field(..., ge=0)
    fitness: float = Field(default=0.0, ge=0.0)
    node_genes: list[NodeGene] = Field(default_factory=list)
    connection_genes: list[ConnectionGene] = Field(default_factory=list)
    brain: NeuralNetwork = Field(default_factory=NeuralNetwork)
