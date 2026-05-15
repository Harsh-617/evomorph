from __future__ import annotations

import copy
import random

from backend.neat import config
from backend.neat.innovation import InnovationTracker


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def crossover(parent_a: dict, parent_b: dict) -> dict:
    """
    parent_a must be the fitter parent (or random if equal).

    Matching genes  → inherited randomly from either parent.
    Disjoint/excess → inherited only from parent_a (the fitter parent).
    Node list       → parent_a's full node list, plus any nodes from parent_b
                      that are referenced by the child's chosen connection genes
                      but absent from parent_a.
    """
    child = copy.deepcopy(parent_a)
    child["connection_genes"] = []

    conns_a: dict[int, dict] = {
        c["innovation_id"]: c for c in parent_a["connection_genes"]
    }
    conns_b: dict[int, dict] = {
        c["innovation_id"]: c for c in parent_b["connection_genes"]
    }
    nodes_b: dict[int, dict] = {n["gene_id"]: n for n in parent_b["node_genes"]}
    nodes_a_ids = {n["gene_id"] for n in parent_a["node_genes"]}

    for iid in sorted(set(conns_a.keys()) | set(conns_b.keys())):
        in_a = iid in conns_a
        in_b = iid in conns_b

        if in_a and in_b:
            chosen = copy.deepcopy(random.choice([conns_a[iid], conns_b[iid]]))
            # If either parent disabled this gene, 75 % chance it stays disabled
            if not conns_a[iid]["enabled"] or not conns_b[iid]["enabled"]:
                chosen["enabled"] = random.random() > 0.75
            child["connection_genes"].append(chosen)
        elif in_a:
            child["connection_genes"].append(copy.deepcopy(conns_a[iid]))
        # Disjoint/excess from the less-fit parent_b are discarded

    # Supplement node list with any nodes from parent_b that the child's
    # connections reference but parent_a doesn't have.
    referenced_ids = set()
    for conn in child["connection_genes"]:
        referenced_ids.add(conn["in_node"])
        referenced_ids.add(conn["out_node"])

    for gid in referenced_ids:
        if gid not in nodes_a_ids and gid in nodes_b:
            child["node_genes"].append(copy.deepcopy(nodes_b[gid]))

    return child


def mutate(genome: dict, innovation_tracker: InnovationTracker) -> dict:
    """
    Apply all mutation operators independently with their configured rates.
    Returns a (deep-copied) mutated genome dict.
    """
    g = copy.deepcopy(genome)

    # Neural mutations
    if random.random() < config.MUTATE_WEIGHT_RATE:
        _mutate_weights(g)

    if random.random() < config.ADD_SYNAPSE_RATE:
        _add_synapse(g, innovation_tracker)

    if random.random() < config.ADD_NODE_RATE:
        _add_node_split(g, innovation_tracker)

    if random.random() < config.TOGGLE_ENABLE_RATE:
        _toggle_enable(g)

    # Body mutations
    if random.random() < config.ADD_LIMB_RATE:
        _add_limb(g, innovation_tracker)

    if random.random() < config.REMOVE_LIMB_RATE:
        _remove_limb(g)

    if random.random() < config.MUTATE_SEGMENT_RATE:
        _mutate_segment(g)

    if random.random() < config.MUTATE_JOINT_RATE:
        _mutate_joint(g)

    if random.random() < config.ADD_SENSOR_RATE:
        _add_sensor(g)

    return g


# ---------------------------------------------------------------------------
# Neural mutations
# ---------------------------------------------------------------------------

def _mutate_weights(genome: dict) -> None:
    """Perturb or replace synapse weights using Gaussian noise."""
    for conn in genome["connection_genes"]:
        if conn["conn_type"] != "SYNAPSE" or not conn["enabled"]:
            continue
        if random.random() < config.WEIGHT_PERTURB_PROBABILITY:
            conn["weight"] = _clamp(
                (conn.get("weight") or 0.0) + random.gauss(0.0, config.WEIGHT_PERTURB_SIGMA),
                *config.SYNAPSE_WEIGHT_RANGE,
            )
        else:
            conn["weight"] = round(random.uniform(*config.SYNAPSE_WEIGHT_RANGE), 4)


def _add_synapse(genome: dict, tracker: InnovationTracker) -> None:
    """Insert a new enabled synapse between two previously unconnected neurons."""
    neurons = [
        n for n in genome["node_genes"]
        if n["type"] in ("INPUT", "OUTPUT", "HIDDEN")
    ]
    if len(neurons) < 2:
        return

    existing_pairs = {
        (c["in_node"], c["out_node"])
        for c in genome["connection_genes"]
        if c["conn_type"] == "SYNAPSE"
    }

    # Allow recurrent connections; only disallow INPUT as a target
    candidates = [
        (a["gene_id"], b["gene_id"])
        for a in neurons
        for b in neurons
        if a["gene_id"] != b["gene_id"]
        and b["type"] != "INPUT"
        and (a["gene_id"], b["gene_id"]) not in existing_pairs
    ]
    if not candidates:
        return

    in_id, out_id = random.choice(candidates)
    iid = tracker.get_innovation(in_id, out_id, "SYNAPSE")
    genome["connection_genes"].append(
        _make_synapse(iid, in_id, out_id, round(random.uniform(*config.SYNAPSE_WEIGHT_RANGE), 4))
    )


def _add_node_split(genome: dict, tracker: InnovationTracker) -> None:
    """Split an existing synapse by inserting a new hidden neuron."""
    enabled_synapses = [
        c for c in genome["connection_genes"]
        if c["conn_type"] == "SYNAPSE" and c["enabled"]
    ]
    if not enabled_synapses:
        return

    synapse = random.choice(enabled_synapses)
    original_weight = synapse.get("weight") or 1.0
    synapse["enabled"] = False

    new_node_id = tracker.get_node_id(synapse["in_node"], synapse["out_node"])
    existing_ids = {n["gene_id"] for n in genome["node_genes"]}
    # Guard against ID collision (can happen when tracker returned a previously seen ID)
    if new_node_id in existing_ids:
        new_node_id = max(existing_ids) + 1

    genome["node_genes"].append(
        _make_hidden_node(new_node_id, random.choice(["tanh", "relu", "sigmoid"]))
    )

    iid_in = tracker.get_innovation(synapse["in_node"], new_node_id, "SYNAPSE")
    genome["connection_genes"].append(
        _make_synapse(iid_in, synapse["in_node"], new_node_id, 1.0)
    )

    iid_out = tracker.get_innovation(new_node_id, synapse["out_node"], "SYNAPSE")
    genome["connection_genes"].append(
        _make_synapse(iid_out, new_node_id, synapse["out_node"], original_weight)
    )


def _toggle_enable(genome: dict) -> None:
    """Flip the enabled flag on a randomly chosen synapse."""
    synapses = [c for c in genome["connection_genes"] if c["conn_type"] == "SYNAPSE"]
    if synapses:
        conn = random.choice(synapses)
        conn["enabled"] = not conn["enabled"]


# ---------------------------------------------------------------------------
# Body mutations
# ---------------------------------------------------------------------------

def _add_limb(genome: dict, tracker: InnovationTracker) -> None:
    body_segments = [n for n in genome["node_genes"] if n["type"] == "BODY_SEGMENT"]
    if not body_segments:
        return

    parent_seg = random.choice(body_segments)
    base_id = max(n["gene_id"] for n in genome["node_genes"]) + 1

    new_seg_id = base_id
    motor_id = base_id + 1
    sensor_id = base_id + 2

    # New child body segment
    genome["node_genes"].append({
        "gene_id": new_seg_id,
        "type": "BODY_SEGMENT",
        "width": round(random.uniform(*config.SEGMENT_WIDTH_RANGE), 4),
        "height": round(random.uniform(*config.SEGMENT_HEIGHT_RANGE), 4),
        "density": round(random.uniform(*config.SEGMENT_DENSITY_RANGE), 4),
        "friction": round(random.uniform(*config.SEGMENT_FRICTION_RANGE), 4),
        "activation": None,
        "attached_segment_id": None,
        "sensor_type": None,
    })

    # JOINT connecting parent → new child segment
    joint_iid = tracker.get_innovation(parent_seg["gene_id"], new_seg_id, "JOINT")
    genome["connection_genes"].append({
        "innovation_id": joint_iid,
        "in_node": parent_seg["gene_id"],
        "out_node": new_seg_id,
        "conn_type": "JOINT",
        "enabled": True,
        "angle_limit_min": round(random.uniform(config.JOINT_ANGLE_RANGE[0], 0.0), 4),
        "angle_limit_max": round(random.uniform(0.0, config.JOINT_ANGLE_RANGE[1]), 4),
        "max_motor_torque": round(random.uniform(*config.JOINT_TORQUE_RANGE), 4),
        "weight": None,
    })

    # OUTPUT motor neuron for the new joint
    genome["node_genes"].append({
        "gene_id": motor_id,
        "type": "OUTPUT",
        "attached_segment_id": new_seg_id,
        "width": None,
        "height": None,
        "density": None,
        "friction": None,
        "activation": None,
        "sensor_type": None,
    })

    # INPUT joint-angle sensor for proprioception
    genome["node_genes"].append({
        "gene_id": sensor_id,
        "type": "INPUT",
        "sensor_type": "JOINT_ANGLE",
        "attached_segment_id": new_seg_id,
        "width": None,
        "height": None,
        "density": None,
        "friction": None,
        "activation": None,
    })

    # Immediately wire a random INPUT → new OUTPUT synapse so the limb is controllable
    input_nodes = [n for n in genome["node_genes"] if n["type"] == "INPUT"]
    if input_nodes:
        src = random.choice(input_nodes)
        syn_iid = tracker.get_innovation(src["gene_id"], motor_id, "SYNAPSE")
        genome["connection_genes"].append(
            _make_synapse(syn_iid, src["gene_id"], motor_id, round(random.uniform(*config.SYNAPSE_WEIGHT_RANGE), 4))
        )

    # Wire proprioceptive sensor → motor so the new limb has self-feedback
    prop_iid = tracker.get_innovation(sensor_id, motor_id, "SYNAPSE")
    genome["connection_genes"].append(
        _make_synapse(prop_iid, sensor_id, motor_id,
                      round(random.uniform(*config.SYNAPSE_WEIGHT_RANGE), 4))
    )


def _remove_limb(genome: dict) -> None:
    """Remove a random leaf BODY_SEGMENT and all its associated genes."""
    body_ids = {n["gene_id"] for n in genome["node_genes"] if n["type"] == "BODY_SEGMENT"}
    if len(body_ids) <= 1:
        return  # never remove the root / only segment

    # Segments that ARE the out_node of a JOINT are non-root children
    joint_child_ids = {
        c["out_node"]
        for c in genome["connection_genes"]
        if c["conn_type"] == "JOINT"
    }
    # Segments that ARE the in_node of a JOINT have children — not leaves
    joint_parent_ids = {
        c["in_node"]
        for c in genome["connection_genes"]
        if c["conn_type"] == "JOINT"
    }

    leaf_ids = body_ids & joint_child_ids - joint_parent_ids
    if not leaf_ids:
        return

    leaf_id = random.choice(list(leaf_ids))

    # Neurons attached to the leaf segment
    doomed_neurons = {
        n["gene_id"]
        for n in genome["node_genes"]
        if n["type"] in ("INPUT", "OUTPUT")
        and n.get("attached_segment_id") == leaf_id
    }

    genome["node_genes"] = [
        n for n in genome["node_genes"]
        if n["gene_id"] != leaf_id and n["gene_id"] not in doomed_neurons
    ]
    genome["connection_genes"] = [
        c for c in genome["connection_genes"]
        if not (c["conn_type"] == "JOINT" and c["out_node"] == leaf_id)
        and not (
            c["conn_type"] == "SYNAPSE"
            and (c["in_node"] in doomed_neurons or c["out_node"] in doomed_neurons)
        )
    ]


def _mutate_segment(genome: dict) -> None:
    """Apply Gaussian perturbation to a random body segment's physical properties."""
    segs = [n for n in genome["node_genes"] if n["type"] == "BODY_SEGMENT"]
    if not segs:
        return
    seg = random.choice(segs)
    seg["width"] = round(_clamp((seg.get("width") or (config.SEGMENT_WIDTH_RANGE[0] + config.SEGMENT_WIDTH_RANGE[1]) / 2) + random.gauss(0, 5), *config.SEGMENT_WIDTH_RANGE), 4)
    seg["height"] = round(_clamp((seg.get("height") or (config.SEGMENT_HEIGHT_RANGE[0] + config.SEGMENT_HEIGHT_RANGE[1]) / 2) + random.gauss(0, 3), *config.SEGMENT_HEIGHT_RANGE), 4)
    seg["density"] = round(_clamp((seg.get("density") or (config.SEGMENT_DENSITY_RANGE[0] + config.SEGMENT_DENSITY_RANGE[1]) / 2) + random.gauss(0, 0.2), *config.SEGMENT_DENSITY_RANGE), 4)
    seg["friction"] = round(_clamp((seg.get("friction") or (config.SEGMENT_FRICTION_RANGE[0] + config.SEGMENT_FRICTION_RANGE[1]) / 2) + random.gauss(0, 0.1), *config.SEGMENT_FRICTION_RANGE), 4)


def _mutate_joint(genome: dict) -> None:
    """Apply Gaussian perturbation to a random joint's angle limits and motor torque."""
    joints = [c for c in genome["connection_genes"] if c["conn_type"] == "JOINT"]
    if not joints:
        return
    joint = random.choice(joints)
    joint["max_motor_torque"] = round(
        _clamp((joint.get("max_motor_torque") or (config.JOINT_TORQUE_RANGE[0] + config.JOINT_TORQUE_RANGE[1]) / 2) + random.gauss(0, 30), *config.JOINT_TORQUE_RANGE), 4
    )
    joint["angle_limit_min"] = round(
        _clamp((joint.get("angle_limit_min") or (config.JOINT_ANGLE_RANGE[0] + 0.0) / 2) + random.gauss(0, 0.2), config.JOINT_ANGLE_RANGE[0], 0.0), 4
    )
    joint["angle_limit_max"] = round(
        _clamp((joint.get("angle_limit_max") or (0.0 + config.JOINT_ANGLE_RANGE[1]) / 2) + random.gauss(0, 0.2), 0.0, config.JOINT_ANGLE_RANGE[1]), 4
    )


def _add_sensor(genome: dict) -> None:
    """Attach a new INPUT sensor node to a random body segment."""
    segs = [n for n in genome["node_genes"] if n["type"] == "BODY_SEGMENT"]
    if not segs:
        return
    seg = random.choice(segs)
    sensor_type = random.choice(["GROUND_CONTACT", "ANGULAR_VELOCITY"])
    new_id = max(n["gene_id"] for n in genome["node_genes"]) + 1
    genome["node_genes"].append({
        "gene_id": new_id,
        "type": "INPUT",
        "sensor_type": sensor_type,
        "attached_segment_id": seg["gene_id"],
        "width": None,
        "height": None,
        "density": None,
        "friction": None,
        "activation": None,
    })


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _make_synapse(iid: int, in_node: int, out_node: int, weight: float) -> dict:
    return {
        "innovation_id": iid,
        "in_node": in_node,
        "out_node": out_node,
        "conn_type": "SYNAPSE",
        "enabled": True,
        "weight": round(_clamp(weight, *config.SYNAPSE_WEIGHT_RANGE), 4),
        "angle_limit_min": None,
        "angle_limit_max": None,
        "max_motor_torque": None,
    }


def _make_hidden_node(gene_id: int, activation: str) -> dict:
    return {
        "gene_id": gene_id,
        "type": "HIDDEN",
        "activation": activation,
        "width": None,
        "height": None,
        "density": None,
        "friction": None,
        "attached_segment_id": None,
        "sensor_type": None,
    }
