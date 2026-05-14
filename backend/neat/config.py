from __future__ import annotations

from typing import Tuple

# Population
POPULATION_SIZE: int = 20
GENERATION_TIME: float = 15.0

# NEAT speciation
SPECIES_THRESHOLD: float = 3.0
C1: float = 1.0   # Excess gene coefficient
C2: float = 1.0   # Disjoint gene coefficient
C3: float = 0.4   # Weight difference coefficient

# Selection
SURVIVAL_RATE: float = 0.80
CROSSOVER_RATE: float = 0.75
ELITISM_THRESHOLD: int = 5

# Body mutation rates
ADD_LIMB_RATE: float = 0.08
REMOVE_LIMB_RATE: float = 0.03
MUTATE_SEGMENT_RATE: float = 0.15
MUTATE_JOINT_RATE: float = 0.15
ADD_SENSOR_RATE: float = 0.05

# Neural mutation rates
MUTATE_WEIGHT_RATE: float = 0.80
ADD_SYNAPSE_RATE: float = 0.10
ADD_NODE_RATE: float = 0.05
TOGGLE_ENABLE_RATE: float = 0.03

# Body parameter ranges
SEGMENT_WIDTH_RANGE: Tuple[float, float] = (10.0, 60.0)
SEGMENT_HEIGHT_RANGE: Tuple[float, float] = (5.0, 30.0)
SEGMENT_DENSITY_RANGE: Tuple[float, float] = (0.5, 3.0)
SEGMENT_FRICTION_RANGE: Tuple[float, float] = (0.1, 1.0)
JOINT_TORQUE_RANGE: Tuple[float, float] = (50.0, 500.0)
JOINT_ANGLE_RANGE: Tuple[float, float] = (-1.57, 1.57)
SYNAPSE_WEIGHT_RANGE: Tuple[float, float] = (-3.0, 3.0)
