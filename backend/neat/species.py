from __future__ import annotations

import math
from typing import List

from backend.neat import config


# ---------------------------------------------------------------------------
# Compatibility distance
# ---------------------------------------------------------------------------

def compatibility_distance(genome_a: dict, genome_b: dict) -> float:
    """
    δ = (C1 * E / N) + (C2 * D / N) + (C3 * W)

    E  = number of excess connection genes
    D  = number of disjoint connection genes
    W  = average weight difference over matching connection genes
    N  = max(|connections_a|, |connections_b|, 1)
    """
    conns_a: dict[int, dict] = {
        c["innovation_id"]: c for c in genome_a.get("connection_genes", [])
    }
    conns_b: dict[int, dict] = {
        c["innovation_id"]: c for c in genome_b.get("connection_genes", [])
    }

    if not conns_a and not conns_b:
        return 0.0

    N = max(len(conns_a), len(conns_b), 1)
    max_a = max(conns_a.keys()) if conns_a else -1
    max_b = max(conns_b.keys()) if conns_b else -1

    excess = 0
    disjoint = 0
    weight_diffs: list[float] = []

    all_ids = set(conns_a.keys()) | set(conns_b.keys())
    for iid in all_ids:
        in_a = iid in conns_a
        in_b = iid in conns_b

        if in_a and in_b:
            weight_diffs.append(_conn_diff(conns_a[iid], conns_b[iid]))
        elif in_a:
            if iid > max_b:
                excess += 1
            else:
                disjoint += 1
        else:
            if iid > max_a:
                excess += 1
            else:
                disjoint += 1

    W = sum(weight_diffs) / len(weight_diffs) if weight_diffs else 0.0
    return (config.C1 * excess / N) + (config.C2 * disjoint / N) + (config.C3 * W)


def _conn_diff(conn_a: dict, conn_b: dict) -> float:
    """Compute weight difference between two matching connection genes, normalized by max possible range."""
    if conn_a["conn_type"] == "SYNAPSE":
        wa = conn_a.get("weight") or 0.0
        wb = conn_b.get("weight") or 0.0
        return abs(wa - wb)
    # JOINT: euclidean distance over (angle_limit_min, angle_limit_max, torque_normalized)
    min_a = conn_a.get("angle_limit_min") or 0.0
    max_a = conn_a.get("angle_limit_max") or 0.0
    torque_a = conn_a.get("max_motor_torque") or 275.0
    min_b = conn_b.get("angle_limit_min") or 0.0
    max_b = conn_b.get("angle_limit_max") or 0.0
    torque_b = conn_b.get("max_motor_torque") or 275.0
    return math.sqrt(
        (min_a - min_b) ** 2
        + (max_a - max_b) ** 2
        + ((torque_a - torque_b) / 450.0) ** 2  # normalize to ~[0,1] scale
    )


# ---------------------------------------------------------------------------
# Species class
# ---------------------------------------------------------------------------

class Species:
    """A cluster of genomes with similar topology."""

    def __init__(self, species_id: int, representative: dict) -> None:
        self.species_id: int = species_id
        self.representative: dict = representative
        self.members: List[dict] = []
        self.age: int = 0
        # Evenly-spaced hues using the golden angle for perceptual separation
        self.color_hue: float = (species_id * 137.508) % 360.0

    def assign_representative(self) -> None:
        if self.members:
            self.representative = max(self.members, key=lambda g: g.get("fitness", 0.0))
