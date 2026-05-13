# EvoMorph — Product Requirements Document (PRD)

**Version:** 1.0
**Target:** Shortcut Asia Internship Challenge 2026

---

## Table of Contents

1. [Product Definition](#1-product-definition)
2. [The Genome: Unified Chromosome](#2-the-genome-unified-chromosome)
3. [NEAT Evolution Engine](#3-neat-evolution-engine)
4. [Simulation Engine (Browser-Side Physics)](#4-simulation-engine-browser-side-physics)
5. [God Mode: Environment Stress Tester](#5-god-mode-environment-stress-tester)
6. [Visualization & Inspection](#6-visualization--inspection)
7. [Dashboard & Metrics](#7-dashboard--metrics)
8. [UI/UX Layout](#8-uiux-layout)
9. [Technical Architecture](#9-technical-architecture)
10. [Scope Boundaries](#10-scope-boundaries)

---

## 1. Product Definition

### 1.1 One-Liner

EvoMorph is a browser-based artificial life sandbox that co-evolves the bodies and brains of 2D creatures using NEAT neuroevolution, letting users manipulate physics in real time and watch entirely new locomotion strategies emerge from nothing.

### 1.2 Why This Project

This project demonstrates mastery across four dimensions simultaneously:

- **Advanced AI/ML:** A custom NEAT implementation built from scratch — not a library call, not a pretrained model. Real neuroevolution with speciation, historical markings, and complexification. This is research-grade ML that no other hackathon applicant will attempt.
- **Complex systems architecture:** A Python evolutionary engine communicating with a browser-based physics simulation via REST. Two computational systems synchronized across a network boundary with real-time feedback.
- **Browser performance engineering:** Running a 2D physics engine (planck.js) at 60 FPS while simultaneously computing neural network forward passes for 20 creatures, rendering animated bodies, and updating live dashboards.
- **Product design:** Despite the technical complexity, the interface is immediately understandable. Creatures move. Sliders change physics. Evolution happens visually. A judge understands what's happening within 3 seconds of opening the page.

### 1.3 Why It Wins

Among a pool of habit trackers, expense splitters, and CRUD apps, EvoMorph is a living system on screen. The judge doesn't need domain expertise (unlike fintech tools). They don't need to read documentation (unlike developer tools). They watch creatures learn to walk. That's a 3-second hook that no other project will match.

The technical depth survives scrutiny: NEAT is a real published algorithm (Stanley & Miikkulainen, 2002). Co-evolution of morphology and control is an active research topic. The fitness function design, speciation mechanics, and mutation operators are all defensible engineering decisions with clear rationale.

### 1.4 Primary User

**The Demo Judge / Technical Recruiter** — needs to be instantly captivated within 3 seconds of the page loading. They need to see the complexity of what's happening (AI creatures learning physics) without reading anything. The interface must be highly visual, with sliders that yield immediate, chaotic, and eventually optimized results.

### 1.5 Core Loop

1. **The Genesis Drop:** The simulation initializes. 20 randomly generated creatures — chaotic arrays of limbs and joints — drop onto flat terrain.
2. **The Flop & Filter:** Generation 1 thrashes wildly. A 15-second timer counts down. Most creatures go nowhere. A few accidentally fall forward.
3. **The Purge:** At 0 seconds, the engine scores them by distance traveled. The losers are culled. The winners are crossed over and mutated.
4. **Emergence:** By Generation 15-25, distinct species emerge. Some drag themselves. Others develop rhythmic crawling, inchworm movement, or hopping mechanics.
5. **God Mode:** The user drags the gravity slider up, or toggles ice terrain.
6. **Extinction & Adaptation:** Reigning champion strategies fail instantly. The genetic algorithm pivots over the next 10 generations, evolving entirely new body plans for the new physics.
7. **Deep Inspection:** The user clicks any creature mid-run to open the Neural Inspector — a live SVG graph showing neurons firing and weights pulsing in real time.
8. **Repeat:** Change another slider. Watch evolution restart. Discover what body plans emerge on stairs, under high gravity, on ice.

### 1.6 Zero-Data Dependency

No external APIs. No datasets. No databases. No seed data. The simulation generates its own data through evolution. The user opens the page, evolution starts, creatures appear. The judge sees a working simulation within 3 seconds of page load.

### 1.7 The Feeling

"I'm watching alien creatures learn to walk for the first time, and I can play god with their universe."

---

## 2. The Genome: Unified Chromosome

All inheritable information — body structure and brain wiring — lives in a single linear sequence of genes. This is the most academically rigorous choice: it ensures that morphology and neural control are never out of sync, because they evolve together as one entity.

### 2.1 Gene Types

#### 2.1.1 Node Genes

Each node gene represents either a physical body segment or a neuron.

```typescript
interface NodeGene {
  gene_id: number;                // Globally unique identifier
  type: NodeType;
  // Body segment properties (only for BODY_SEGMENT type)
  width?: number;                 // Range: 10–60 pixels
  height?: number;                // Range: 5–30 pixels
  density?: number;               // Range: 0.5–3.0 (affects mass)
  friction?: number;              // Range: 0.1–1.0 (surface grip)
  // Neuron properties
  activation?: ActivationType;    // For HIDDEN nodes: 'tanh' | 'relu' | 'sigmoid'
  attached_segment_id?: number;   // For INPUT nodes: which body segment this sensor is on
  sensor_type?: SensorType;       // For INPUT nodes: what this sensor measures
}

enum NodeType {
  BODY_SEGMENT,   // A physical rigid body in the world
  INPUT,          // A sensor neuron (reads from physics)
  OUTPUT,         // A motor neuron (applies torque to a joint)
  HIDDEN          // An internal processing neuron
}

enum SensorType {
  JOINT_ANGLE,        // Current angle of the attached joint
  GROUND_CONTACT,     // Boolean: is this segment touching the ground? (0.0 or 1.0)
  BODY_ANGLE,         // Absolute rotation angle of the root segment
  ANGULAR_VELOCITY,   // Rotation speed of the root segment
  OSCILLATOR          // sin(phase) — provides a rhythmic clock signal
}

enum ActivationType {
  TANH,       // Default for hidden nodes: smooth, bounded [-1, 1]
  RELU,       // Rectified linear: useful for motor outputs
  SIGMOID     // Bounded [0, 1]: useful for binary-like signals
}
```

#### 2.1.2 Connection Genes

Each connection gene represents either a physical joint (connecting two body segments) or a neural synapse (connecting two neurons).

```typescript
interface ConnectionGene {
  innovation_id: number;          // Globally unique historical marker (critical for NEAT crossover)
  in_node: number;                // gene_id of the source node
  out_node: number;               // gene_id of the target node
  conn_type: ConnectionType;
  enabled: boolean;               // Can be toggled by mutation
  // Joint properties (only for JOINT type)
  angle_limit_min?: number;       // Radians, range: -π/2 to 0
  angle_limit_max?: number;       // Radians, range: 0 to π/2
  max_motor_torque?: number;      // Range: 50–500 (force the motor can exert)
  // Synapse properties (only for SYNAPSE type)
  weight?: number;                // Range: -3.0 to 3.0
}

enum ConnectionType {
  JOINT,      // Physical revolute joint between two body segments
  SYNAPSE     // Neural connection between two neurons
}
```

### 2.2 Automatic Binding: Body ↔ Brain

This is a critical design decision. When the genome mutates, the body and brain stay in sync automatically:

**When a new JOINT connection gene is created** (a new limb sprouts):
1. A new BODY_SEGMENT node gene is created (the new limb).
2. A new OUTPUT node gene is created (the motor neuron controlling that joint).
3. A new INPUT node gene is created (joint angle sensor for proprioception).
4. The output neuron is bound to the joint. The input neuron is bound to the joint angle.

**When a BODY_SEGMENT is deleted** (a limb is lost):
1. The associated JOINT connection gene is removed.
2. The associated OUTPUT neuron (motor) is removed.
3. All INPUT neurons (sensors) attached to that segment are removed.
4. All SYNAPSE connections to/from the removed neurons are removed.

This means the neural network's input/output dimensions always match the body's physical structure. There's no mismatch. There's no manual wiring. The genome enforces consistency.

### 2.3 Body Topology Constraint

The body is a **rooted tree** (directed acyclic graph with a single root). The root node is the **torso** — the creature's core segment that is never deleted. All other segments branch outward from the torso through joint connections.

No cycles are allowed in the body graph. This prevents physically impossible configurations (a limb attached to itself) and ensures stable physics simulation.

### 2.4 Genome Serialization

The genome is serialized as JSON for transport between backend and frontend:

```json
{
  "genome_id": "gen42-creature07",
  "species_id": 3,
  "generation": 42,
  "fitness": 0,
  "node_genes": [
    { "gene_id": 0, "type": "BODY_SEGMENT", "width": 40, "height": 15, "density": 1.2, "friction": 0.6 },
    { "gene_id": 1, "type": "BODY_SEGMENT", "width": 25, "height": 10, "density": 1.0, "friction": 0.8 },
    { "gene_id": 2, "type": "INPUT", "sensor_type": "BODY_ANGLE", "attached_segment_id": 0 },
    { "gene_id": 3, "type": "INPUT", "sensor_type": "GROUND_CONTACT", "attached_segment_id": 0 },
    { "gene_id": 4, "type": "INPUT", "sensor_type": "JOINT_ANGLE", "attached_segment_id": 1 },
    { "gene_id": 5, "type": "INPUT", "sensor_type": "OSCILLATOR" },
    { "gene_id": 6, "type": "OUTPUT", "attached_segment_id": 1 },
    { "gene_id": 7, "type": "HIDDEN", "activation": "tanh" }
  ],
  "connection_genes": [
    { "innovation_id": 0, "in_node": 0, "out_node": 1, "conn_type": "JOINT", "enabled": true, "angle_limit_min": -1.2, "angle_limit_max": 1.2, "max_motor_torque": 200 },
    { "innovation_id": 1, "in_node": 2, "out_node": 7, "conn_type": "SYNAPSE", "enabled": true, "weight": 0.85 },
    { "innovation_id": 2, "in_node": 5, "out_node": 7, "conn_type": "SYNAPSE", "enabled": true, "weight": -1.2 },
    { "innovation_id": 3, "in_node": 7, "out_node": 6, "conn_type": "SYNAPSE", "enabled": true, "weight": 1.45 }
  ]
}
```

### 2.5 Initial Creature (Generation 0)

Every creature in the initial population starts minimal:

- **1 BODY_SEGMENT** (torso): root node, random size within range
- **0 additional limbs**: no joints, no motors
- **Innate sensors:**
  - BODY_ANGLE (absolute torso rotation)
  - GROUND_CONTACT (is torso touching ground?)
  - OSCILLATOR (rhythmic clock signal: `sin(2π * t / period)`)
- **0 hidden neurons**
- **0 synapses** (or minimal random wiring from inputs to a single output if a joint exists)

Generation 0 creatures are essentially inert blocks that flop and do nothing. This is by design. Everything — limbs, joints, sensors, neural connections, hidden neurons — must be discovered by evolution. The emergence from nothing is the entire point.

---

## 3. NEAT Evolution Engine

The NEAT (NeuroEvolution of Augmenting Topologies) algorithm runs on the Python backend. It is implemented from scratch, not using a library — this is a deliberate choice to demonstrate ML engineering capability.

### 3.1 Algorithm Overview

NEAT has three core innovations over naive neuroevolution:

1. **Historical markings (innovation numbers):** Every new gene gets a globally unique ID. This enables meaningful crossover between genomes of different topologies — genes with the same innovation number are "the same gene" across the population.
2. **Speciation:** Genomes are clustered into species based on structural similarity. Species protect topological innovations from being prematurely eliminated by competition with already-optimized simpler structures.
3. **Complexification:** Networks start minimal and grow. Mutations add nodes and connections over time. This prevents the "competing conventions" problem where different network topologies encode the same behavior but can't cross over productively.

### 3.2 Global Innovation Counter

```python
class InnovationTracker:
    """
    Tracks all structural mutations that have ever occurred.
    If the same structural mutation happens independently in two genomes
    within the same generation, they get the same innovation number.
    """
    def __init__(self):
        self.counter = 0
        self.history = {}  # (in_node, out_node, conn_type) → innovation_id

    def get_innovation(self, in_node: int, out_node: int, conn_type: str) -> int:
        key = (in_node, out_node, conn_type)
        if key not in self.history:
            self.history[key] = self.counter
            self.counter += 1
        return self.history[key]

    def reset_generation(self):
        """Clear history at generation end so same mutations in
        different generations get different IDs."""
        self.history = {}
```

### 3.3 Compatibility Distance & Speciation

Two genomes are compared by aligning their connection genes by innovation number:

- **Matching genes:** Same innovation number in both genomes
- **Disjoint genes:** Innovation numbers present in one genome but within the range of the other
- **Excess genes:** Innovation numbers beyond the range of the shorter genome

```python
def compatibility_distance(genome_a, genome_b) -> float:
    """
    δ = (c1 * E / N) + (c2 * D / N) + (c3 * W)

    E = number of excess genes
    D = number of disjoint genes
    W = average weight difference of matching genes
    N = max(len(genome_a.connections), len(genome_b.connections), 1)

    For weight difference on body genes:
      Euclidean distance over (width, height, density, friction) for segments
      Euclidean distance over (torque, angle_limits) for joints
    For weight difference on synapse genes:
      Absolute difference of synapse weight
    """
    # ... implementation ...

# Coefficients (tuned for this application)
C1 = 1.0   # Excess gene penalty
C2 = 1.0   # Disjoint gene penalty
C3 = 0.4   # Weight difference penalty (lower because weight differences are continuous)

SPECIES_THRESHOLD = 3.0  # δ < 3.0 → same species
```

**Speciation process per generation:**

1. Clear all species member lists.
2. For each genome, compare it against the representative of each existing species.
3. If `compatibility_distance < SPECIES_THRESHOLD`, assign to that species.
4. If no species matches, create a new species with this genome as representative.
5. Each species elects a new representative (random member).

### 3.4 Fitness Sharing

Raw fitness is adjusted by species size to prevent a single dominant species from taking over:

```python
adjusted_fitness = raw_fitness / len(species.members)
```

This ensures that a new species with a single member that found an innovative (but not yet optimized) strategy is protected from being outcompeted by a large, optimized species.

### 3.5 Selection & Reproduction

Per generation:

1. **Rank species** by average adjusted fitness.
2. **Kill the bottom 20%** of each species (lowest adjusted fitness members removed).
3. **Allocate offspring** to each species proportional to its average adjusted fitness. Species with higher average fitness get more offspring.
4. **Elitism:** The champion of each species with 5+ members is copied directly to the next generation without mutation.
5. **Reproduction within each species:**
   - 75% of offspring: crossover between two parents selected via tournament selection (k=3) within the species, followed by mutation.
   - 25% of offspring: asexual reproduction (clone a parent, then mutate).

### 3.6 Crossover

Two parent genomes are aligned by innovation number:

```python
def crossover(parent_a, parent_b) -> Genome:
    """
    parent_a is the fitter parent (or random if equal fitness).

    Matching genes: inherited randomly from either parent.
    Disjoint/excess genes: inherited ONLY from the fitter parent.

    This preserves the structural innovations of successful genomes.
    """
    child = Genome()

    for innovation_id in all_innovation_ids(parent_a, parent_b):
        gene_a = parent_a.get_connection(innovation_id)
        gene_b = parent_b.get_connection(innovation_id)

        if gene_a and gene_b:
            # Matching gene — inherit randomly
            child.add_connection(random.choice([gene_a, gene_b]).copy())
        elif gene_a:
            # Excess/disjoint from fitter parent — inherit
            child.add_connection(gene_a.copy())
        # Disjoint/excess from less fit parent — discard

    # Node genes: include all nodes referenced by the child's connections
    # plus the root body segment
    child.rebuild_node_list()

    return child
```

### 3.7 Mutation Operators

All mutations operate on the unified chromosome. Mutation rates are applied independently (a single genome can receive multiple mutations in one generation).

#### 3.7.1 Body Mutations

| Mutation | Rate | Description |
|----------|------|-------------|
| **Add limb** | 8% | Pick a random BODY_SEGMENT. Create a child segment attached via a new JOINT. Auto-create OUTPUT neuron (motor) and INPUT neuron (joint angle sensor). New segment has random size within range. |
| **Remove limb** | 3% | Pick a random leaf BODY_SEGMENT (not the root, no children). Remove it, its JOINT, its associated OUTPUT neuron, all INPUT sensors on it, and all SYNAPSE connections to/from removed neurons. |
| **Mutate segment** | 15% | Pick a random BODY_SEGMENT. Apply Gaussian perturbation to width (σ=5), height (σ=3), density (σ=0.2), friction (σ=0.1). Clamp to valid ranges. |
| **Mutate joint** | 15% | Pick a random JOINT. Apply Gaussian perturbation to max_motor_torque (σ=30), angle_limit_min (σ=0.2), angle_limit_max (σ=0.2). Clamp to valid ranges. |
| **Add sensor** | 5% | Pick a random BODY_SEGMENT. Attach a new INPUT node (sensor type: GROUND_CONTACT or ANGULAR_VELOCITY, chosen randomly). |

#### 3.7.2 Neural Mutations

| Mutation | Rate | Description |
|----------|------|-------------|
| **Mutate synapse weight** | 80% | For each enabled SYNAPSE: 90% chance of Gaussian perturbation (σ=0.5), 10% chance of complete reset to random value in [-3, 3]. |
| **Add synapse** | 10% | Pick two previously unconnected neuron nodes. Create a new SYNAPSE with a random weight. Recurrent connections are ALLOWED (enables rhythmic oscillation patterns). |
| **Add hidden node (split)** | 5% | Pick a random enabled SYNAPSE. Disable it. Create a new HIDDEN node. Create two new SYNAPSE connections: `in → hidden` (weight 1.0) and `hidden → out` (original weight). This preserves existing behavior while adding capacity. |
| **Toggle enable** | 3% | Pick a random SYNAPSE connection gene. Flip its `enabled` flag. Disabled genes can be re-enabled later, acting as a form of memory. |

### 3.8 Configuration Constants

```python
# Population
POPULATION_SIZE = 20              # Creatures per generation
GENERATION_TIME = 15.0            # Seconds of simulation per generation

# NEAT
SPECIES_THRESHOLD = 3.0
C1 = 1.0                         # Excess gene coefficient
C2 = 1.0                         # Disjoint gene coefficient
C3 = 0.4                         # Weight difference coefficient

# Selection
SURVIVAL_RATE = 0.80              # Top 80% survive within each species
CROSSOVER_RATE = 0.75             # 75% offspring from crossover
ELITISM_THRESHOLD = 5             # Species with 5+ members preserve champion

# Body mutation rates
ADD_LIMB_RATE = 0.08
REMOVE_LIMB_RATE = 0.03
MUTATE_SEGMENT_RATE = 0.15
MUTATE_JOINT_RATE = 0.15
ADD_SENSOR_RATE = 0.05

# Neural mutation rates
MUTATE_WEIGHT_RATE = 0.80
ADD_SYNAPSE_RATE = 0.10
ADD_NODE_RATE = 0.05
TOGGLE_ENABLE_RATE = 0.03

# Body parameter ranges
SEGMENT_WIDTH_RANGE = (10, 60)    # pixels
SEGMENT_HEIGHT_RANGE = (5, 30)    # pixels
SEGMENT_DENSITY_RANGE = (0.5, 3.0)
SEGMENT_FRICTION_RANGE = (0.1, 1.0)
JOINT_TORQUE_RANGE = (50, 500)
JOINT_ANGLE_RANGE = (-1.57, 1.57) # ±π/2 radians
SYNAPSE_WEIGHT_RANGE = (-3.0, 3.0)
```

---

## 4. Simulation Engine (Browser-Side Physics)

All physics computation runs in the browser using **planck.js** (a JavaScript port of Box2D). This ensures zero-latency creature movement, 60 FPS rendering, and no server dependency during the simulation phase.

### 4.1 Physics World Configuration

```typescript
const world = planck.World({
  gravity: planck.Vec2(0, -10 * gravityMultiplier)  // Default: -10 m/s²
});

// Ground plane
const ground = world.createBody();
ground.createFixture(planck.Edge(
  planck.Vec2(-1000, 0),
  planck.Vec2(1000, 0)
), { friction: terrainFriction }  // Default: 0.6
);
```

### 4.2 Creature Instantiation from Genome

When the frontend receives a genome JSON from the backend, it builds the physical creature:

```
For each BODY_SEGMENT node gene:
  1. Create a planck.js dynamic body at the correct position
     (relative to parent segment, offset by parent's size + joint)
  2. Create a rectangular fixture with (width, height, density, friction)
  3. Store reference: segment_id → planck body

For each JOINT connection gene:
  1. Look up the two BODY_SEGMENT bodies
  2. Create a planck.js RevoluteJoint between them
  3. Set angle limits (angle_limit_min, angle_limit_max)
  4. Enable the motor with max_motor_torque
  5. Store reference: joint_id → planck joint

Build the neural network in memory:
  1. Create node activation slots for all INPUT, HIDDEN, OUTPUT nodes
  2. Build adjacency list from SYNAPSE connection genes
  3. Topological sort for feedforward evaluation
     (or iterative evaluation if recurrent connections exist)
```

### 4.3 The Tick Loop (Per Frame, 60 FPS)

Every animation frame (via `requestAnimationFrame`), for each of the 20 creatures:

```
1. READ SENSORS
   For each INPUT node gene:
     - JOINT_ANGLE: read current angle from the planck RevoluteJoint
     - GROUND_CONTACT: raycast downward from segment center, check if < 2px
     - BODY_ANGLE: read rotation angle of root body
     - ANGULAR_VELOCITY: read angular velocity of root body
     - OSCILLATOR: compute sin(2π * simTime / oscillatorPeriod)
   Store sensor values as neural input activations.

2. THINK (Neural Network Forward Pass)
   If feedforward topology:
     Process nodes in topological order.
     For each node: activation = activationFn(Σ(input * weight))
   If recurrent connections exist:
     Run one iteration of activation propagation.
     (Recurrent connections use the PREVIOUS tick's activation value.)

3. ACTUATE
   For each OUTPUT node gene:
     Read the output activation value (range: -1 to 1 after tanh)
     Map to motor speed: motorSpeed = activation * maxMotorSpeed
     Apply to the corresponding planck RevoluteJoint motor.

4. ADVANCE PHYSICS
   world.step(1/60)  // Step physics by one frame
```

### 4.4 Neural Network Forward Pass (Detailed)

```typescript
function evaluateNetwork(genome: Genome, sensorValues: Map<number, number>): Map<number, number> {
  const activations = new Map<number, number>();

  // Initialize input nodes with sensor values
  for (const [nodeId, value] of sensorValues) {
    activations.set(nodeId, value);
  }

  // Process nodes in topological order (hidden nodes first, then output)
  // For recurrent connections: use previous tick's activation for the recurrent source
  for (const node of genome.getProcessingOrder()) {
    let sum = 0;
    for (const synapse of genome.getIncomingSynapses(node.gene_id)) {
      if (!synapse.enabled) continue;
      const inputActivation = activations.get(synapse.in_node) ?? previousActivations.get(synapse.in_node) ?? 0;
      sum += inputActivation * synapse.weight;
    }
    activations.set(node.gene_id, applyActivation(sum, node.activation ?? 'tanh'));
  }

  // Store for next tick (recurrent connections)
  previousActivations = new Map(activations);

  return activations;  // OUTPUT node activations are the motor commands
}

function applyActivation(x: number, type: ActivationType): number {
  switch (type) {
    case 'tanh':    return Math.tanh(x);
    case 'relu':    return Math.max(0, x);
    case 'sigmoid': return 1 / (1 + Math.exp(-x));
  }
}
```

### 4.5 The Fitness Function

At the end of the 15-second simulation window, every creature is scored:

```python
def calculate_fitness(creature_result: CreatureResult) -> float:
    """
    fitness = max_x_distance
              + upright_bonus
              - energy_penalty
              - head_touch_penalty

    All components are non-negative. Fitness is floored at 0.
    """

    # Primary objective: how far right did you get?
    max_x = creature_result.max_x_position  # Furthest X reached by root segment

    # Bonus for staying upright (root segment above ground)
    # Calculated as: fraction of time the root center was above a threshold
    upright_fraction = creature_result.time_upright / GENERATION_TIME
    upright_bonus = upright_fraction * 50  # Max 50 bonus points

    # Penalty for wasting energy (prevents violent flailing)
    # Sum of |torque applied| across all joints across all frames, normalized
    total_torque = creature_result.cumulative_torque
    max_possible_torque = (
        creature_result.num_joints
        * creature_result.max_torque
        * GENERATION_TIME
        * 60  # frames per second
    )
    energy_ratio = total_torque / max(max_possible_torque, 1)
    energy_penalty = energy_ratio * 30  # Max 30 penalty points

    # Fatal penalty: if root segment touches ground for >0.5 cumulative seconds
    if creature_result.head_ground_time > 0.5:
        head_touch_penalty = max_x * 0.9  # Lose 90% of distance score
    else:
        head_touch_penalty = 0

    fitness = max(0, max_x + upright_bonus - energy_penalty - head_touch_penalty)
    return round(fitness, 2)
```

**Why this fitness function works:**

- `max_x_distance` as the primary reward encourages forward movement — the entire point.
- `upright_bonus` encourages creatures that stand rather than roll (combined with head-touch penalty, this forces evolution of legs/stilts).
- `energy_penalty` prevents the degenerate strategy of flailing violently, which sometimes accidentally moves a creature forward. Efficient movers are rewarded.
- `head_touch_penalty` is the strongest selective pressure. Creatures that drag along the ground on their torso lose 90% of their score. This is what forces the evolution of limbs that lift the body off the ground. The 0.5-second grace period prevents instant death from wobbling.

### 4.6 Creature Result Data (Sent Back to Server)

```typescript
interface CreatureResult {
  genome_id: string;
  fitness: number;
  max_x_position: number;
  time_upright: number;         // seconds
  cumulative_torque: number;
  head_ground_time: number;     // seconds
  num_joints: number;
  max_torque: number;
  final_x: number;              // X position at end of simulation
  final_y: number;              // Y position at end of simulation
  alive: boolean;               // Did it survive the full 15 seconds?
}
```

---

## 5. God Mode: Environment Stress Tester

This is the interactive hero feature — the equivalent of Sim-Logistics' demand slider, but applied to the laws of physics.

### 5.1 Physics Sliders

| Slider | Label | Range | Default | Step | Effect |
|--------|-------|-------|---------|------|--------|
| **Gravity** | `GRAVITY` | 0.1x – 3.0x | 1.0x | 0.1x | Multiplies the gravity vector. High gravity → creatures need stockier limbs and more torque. Low gravity → bouncy, energy-efficient movement. |
| **Friction** | `FRICTION` | 0.0 (Ice) – 1.0 (Rubber) | 0.6 | 0.05 | Changes ground surface friction. Ice (0.0) destroys bipedal walkers — they can't grip. Creatures evolve crawling or dragging strategies. Rubber (1.0) enables strong grip for jumping. |

**Behavior:**

- Slider changes take effect **at the start of the next generation** (not mid-simulation). This is a deliberate design choice: mid-simulation changes would invalidate fitness comparisons within a generation. The user changes gravity, sees a message "Gravity changed! Adapting next generation...", and watches the next generation struggle under new physics.
- Alternative: if we want mid-generation drama for the demo, allow mid-generation changes but mark that generation's fitness scores as "transitional" (not used for selection). The following generation uses the new physics cleanly. This is a UX decision to finalize during build.

### 5.2 Terrain Types

Radio button selection (one active at a time):

| Terrain | Visual | Effect on Evolution |
|---------|--------|-------------------|
| **Flat** | Flat horizontal surface | Default. Allows any locomotion strategy. |
| **Hurdles** | Rectangular blocks (10px high, spaced every 100px) | Forces evolution of high-stepping or jumping mechanics. Low-crawlers get stuck. |
| **Stairs** | Ascending steps (8px rise, 40px run) | Forces climbing morphologies. Often produces hook-like front limbs and strong rear pushers. |
| **Hills** | Perlin noise terrain (smooth rolling hills, amplitude 30px) | Tests balance and terrain adaptation. Creatures evolved on flat ground often fail on hills. |

**Terrain generation is deterministic per generation** — all 20 creatures in a generation face the same terrain. This ensures fair fitness comparison within a generation.

### 5.3 Demo Narrative

The God Mode creates a natural story for the pitch:

1. **Act 1 (Flat, Normal Gravity):** "These creatures started as inert blocks. Over 20 generations, they discovered limbs and locomotion from nothing. Watch this one — it evolved a rhythmic crawling gait."

2. **Act 2 (Toggle to Ice):** "Now I remove friction. Watch — the champion immediately fails. It can't grip the ground anymore. But look at Generation 25... this new species evolved a completely different strategy. It drags itself using body weight instead of leg grip."

3. **Act 3 (Crank Gravity to 3x):** "Triple gravity. Everything collapses. The creatures are too heavy for their limbs. But by Generation 35... evolution produced stocky, low-to-ground designs with powerful torque. Entirely different body plans from what worked at 1x gravity."

This three-act demo is 3-4 minutes and is impossible to look away from.

---

## 6. Visualization & Inspection

### 6.1 Creature Rendering (Canvas)

Each creature is rendered on an HTML5 Canvas (or WebGL for performance):

- **Body segments:** Semi-transparent colored rectangles, positioned according to planck.js body positions and rotations. Color coded by species (each species gets a distinct hue).
- **Joints:** Small circles at joint pivot points, with a subtle arc showing the angle limit range.
- **Current leader:** Highlighted with a glowing stroke (blue, 2px) and a small crown/star icon above it.
- **Dead creatures:** When a creature's head touches ground for >0.5s (fatal penalty triggered), it flickers red briefly and becomes more transparent (ghost state). It continues simulating but is visually deprioritized.

### 6.2 Camera System

- **Default:** Camera automatically follows the current leader (creature with the highest real-time X position).
- **User override:** Click any creature to pin the camera to it. A "Follow Leader" button returns to auto-follow mode.
- **Smooth tracking:** Camera position interpolates toward the target (lerp factor 0.05 per frame) for smooth panning.
- **Zoom:** Scroll to zoom in/out. Default zoom shows approximately 400px of horizontal terrain.

### 6.3 Neural Inspector (Right Panel)

When the user clicks a creature (or it's auto-selected as leader), the Neural Inspector panel shows a live visualization of its brain:

**Network Graph (SVG):**

- **Nodes:** Circles arranged in columns by layer (inputs → hidden → outputs).
  - INPUT nodes: green, labeled with sensor type (e.g., "θ body", "ground", "osc")
  - HIDDEN nodes: gray
  - OUTPUT nodes: red, labeled with joint name (e.g., "joint_1 motor")
  - Node size proportional to current activation magnitude
- **Edges:** Lines between connected nodes.
  - Thickness proportional to |weight| (thicker = stronger connection)
  - Color: blue for positive weight, red for negative weight
  - Opacity: 0.3 for disabled connections
- **Live animation:** Every tick, node circles pulse (opacity changes based on activation value). When a node fires strongly, it briefly flashes bright. This creates a live "thinking" visualization — you can see neural activity ripple through the network as the creature moves.

**Body Diagram (SVG):**

Below the neural graph, a simplified structural diagram of the creature's body DAG:
- Nodes as rectangles (proportional to segment size)
- Edges as lines (joints)
- Highlighted in the species color
- Shows the tree structure clearly, even if the physics view is chaotic

### 6.4 Phylogeny Viewer (Bottom Strip)

A horizontal timeline showing the evolutionary history:

- **X-axis:** Generation number (0 to current)
- **Y-axis:** Best fitness of each generation
- **Line chart:** Fitness curve showing improvement over time
- **Scrubber:** The user can scrub backward through generations. At each generation, a tooltip shows the champion's body diagram (a mini structural view) and fitness score.
- **Species bands:** Below the fitness curve, colored horizontal bands show which species existed during which generations. Species appear, grow, shrink, and go extinct. New terrain/physics changes create visible extinction events and speciation bursts.

This is one of the most visually impressive features: the user scrubs through evolutionary history and watches body plans change over time.

---

## 7. Dashboard & Metrics

### 7.1 Top Bar Metrics

Always-visible numbers in the top bar:

| Metric | Format | Description |
|--------|--------|-------------|
| **Generation** | `Gen 42` | Current generation number |
| **Best Fitness** | `Best: 342.5` | Highest fitness in the current generation |
| **All-Time Best** | `Record: 891.2` | Highest fitness ever achieved |
| **Species Count** | `Species: 5` | Number of active species |
| **Timer** | `12.3s / 15.0s` | Time remaining in current generation simulation |

### 7.2 Leaderboard (Right Panel, Below Neural Inspector)

Real-time ranking of all 20 creatures in the current generation:

```
┌─────────────────────────────────┐
│  🏆 Generation 42 Leaderboard   │
├─────────────────────────────────┤
│  1. ████████████████  342.5  ●  │  ← Species 3 (blue)
│  2. ████████████      278.1  ●  │  ← Species 3 (blue)
│  3. ██████████        231.8  ●  │  ← Species 1 (green)
│  4. ████████          198.4  ●  │  ← Species 5 (red)
│  ...                            │
│ 20. █                  12.3  ●  │  ← Species 2 (yellow)
└─────────────────────────────────┘
```

- Bars show relative fitness (proportional to best in generation)
- Species color dot on the right for each creature
- Updates in real-time during simulation (bars grow/shrink as creatures move)
- Click any entry to pin camera to that creature and open its Neural Inspector
- Current leader has a subtle glow animation

### 7.3 Per-Generation Stats (Bottom Panel)

After each generation completes:

| Stat | Description |
|------|-------------|
| **Average fitness** | Mean fitness across all 20 creatures |
| **Fitness std dev** | Diversity indicator — high std dev means varied strategies |
| **Best body complexity** | Number of limbs on the champion |
| **Average body complexity** | Mean limb count across population |
| **Neural complexity** | Total connections in champion's brain |
| **Species breakdown** | Pie chart of species sizes |

---

## 8. UI/UX Layout

### 8.1 Spatial Arrangement

```
┌──────────────────────────────────────────────────────────────────┐
│                           TOP BAR                                │
│ EvoMorph | Gen:42 | Best:342.5 | Record:891.2 | ▶ ⏸ ⏹ | 1x 2x 5x│
├──────────────────────────────────────────────┬───────────────────┤
│                                              │                   │
│                                              │  NEURAL INSPECTOR │
│         PHYSICS ARENA                        │  (Live SVG graph) │
│         (HTML5 Canvas / WebGL)               │                   │
│                                              ├───────────────────┤
│         Camera follows leader                │                   │
│         Click creature to inspect            │  GOD MODE PANEL   │
│                                              │  Gravity ═══●═══  │
│                                              │  Friction ═══●═══ │
│                                              │  Terrain: [Flat]  │
│                                              │           [Hills] │
│                                              │           [Hurdle]│
│                                              │           [Stair] │
│                                              ├───────────────────┤
│                                              │                   │
│                                              │  LEADERBOARD      │
│                                              │  1. ████ 342.5    │
│                                              │  2. ███  278.1    │
│                                              │  ...              │
├──────────────────────────────────────────────┴───────────────────┤
│                      PHYLOGENY TIMELINE                          │
│  ═══════════════════════════●════  Gen 42 / Fitness curve        │
│  Species bands: ████ ████ ███████ ████████ ████                  │
└──────────────────────────────────────────────────────────────────┘
```

### 8.2 Top Bar

**Spans full width.** Contains:

- **Left:** App logo "EvoMorph" in a clean sans-serif font
- **Center-left:** Generation counter, best fitness, all-time record, species count
- **Center:** Simulation controls: Play ▶ / Pause ⏸ / Reset ⏹ + Speed selector (1x / 2x / 5x)
- **Center-right:** Generation timer (countdown from 15.0s)
- **Right:** "New Population" button (restart from Generation 0)

### 8.3 Physics Arena (Main Area)

**Largest zone, occupies ~70% of screen width.**

- Dark background (`#0f172a`) with subtle grid pattern for ground reference
- Terrain rendered as a filled polygon (ground line)
- 20 creatures simulating simultaneously
- Camera auto-follows leader with smooth interpolation
- Click any creature to select it (highlighted outline) and open Neural Inspector
- Minimap in bottom-left corner showing the full terrain with creature positions as dots

### 8.4 Right Panel (~300px wide)

**Three collapsible sections, stacked vertically:**

**Section 1: Neural Inspector** (expanded when a creature is selected)
- Live network SVG graph with firing neurons
- Body structure diagram
- Creature stats: limb count, synapse count, species ID, current fitness
- "Not selected" placeholder when no creature is clicked

**Section 2: God Mode Controls**
- Gravity slider with value label
- Friction slider with value label
- Terrain type radio buttons with small preview icons
- "Environment changed" indicator when sliders differ from current simulation

**Section 3: Leaderboard**
- Real-time fitness ranking of all 20 creatures
- Species color coding
- Click to select/inspect

### 8.5 Bottom Strip: Phylogeny Timeline

**Horizontal strip, ~120px tall, spans full width.**

- Fitness curve (line chart): generations on X, best fitness on Y
- Species bands below: horizontal colored bands showing species lifetimes
- Scrubber: drag handle to review past generations
- Current generation marker: vertical line at current position
- Environment change markers: vertical dashed lines where physics/terrain changed, with tooltip labels ("Gravity → 2x", "Terrain → Ice")

### 8.6 Design Direction

**Visual Style: Dark, neon-accented, immersive. A virtual terrarium.**

**Design Rules:**

1. **One font family:** Inter or Geist Mono (monospace for numbers/metrics, sans for labels).
2. **Accent color:** Species colors are auto-generated (evenly spaced hues from HSL color wheel, saturation 70%, lightness 60%). UI accent: cyan (`#22d3ee`) for interactive elements.
3. **Dark background everywhere.** The arena is the darkest (`#0a0f1a`). Panels are slightly lighter (`#1e293b`). This makes the colorful creatures pop.
4. **Creature rendering is the visual star.** Everything else stays muted and supportive.
5. **Smooth animations everywhere:** creature movement (physics-driven), camera tracking (lerp), leaderboard bar growth (CSS transition 300ms), neural node pulsing (opacity transition 100ms).
6. **No emoji in UI.** Use Lucide icons for all interface elements.
7. **The arena must feel alive.** Even when paused, subtle particle effects on the ground or a gentle camera drift prevent the screen from ever feeling static.

---

## 9. Technical Architecture

### 9.1 Stack Overview

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14 + TypeScript | UI rendering, state management |
| **Physics** | planck.js | 2D deterministic physics (Box2D port) |
| **Arena Rendering** | HTML5 Canvas (2D context) | Creature and terrain drawing at 60 FPS |
| **Neural Viz** | SVG (React components) | Live neural network graph |
| **Charts** | Recharts | Phylogeny timeline, species charts |
| **State** | Zustand | Global state (generation, sliders, selection) |
| **Icons** | Lucide React | UI iconography |
| **Styling** | Tailwind CSS | Utility-first CSS |
| **Backend** | FastAPI (Python) | NEAT evolution engine, API gateway |
| **ML Engine** | Custom NEAT (Python) | Genetic algorithm, crossover, speciation |
| **Frontend Hosting** | Vercel | Next.js deployment |
| **Backend Hosting** | Railway | FastAPI deployment |

### 9.2 Communication Protocol

The frontend and backend communicate via REST API. WebSockets were considered but are unnecessary — the communication is a simple request-response cycle once per generation (every 15 seconds of simulation time).

```
┌─────────────────────────────────────────────────────┐
│              Browser (Client-Side)                    │
│                                                     │
│  ┌──────────────┐    ┌────────────────────────────┐ │
│  │  planck.js    │───→│  Per-frame tick loop        │ │
│  │  Physics World│    │  Read sensors → NN pass →   │ │
│  │               │←───│  Apply torques → Step world │ │
│  └──────────────┘    └────────────────────────────┘ │
│                                                     │
│  ┌──────────────┐    ┌────────────────────────────┐ │
│  │  Zustand Store│    │  Canvas Renderer            │ │
│  │  (state)      │───→│  Draw creatures, terrain,   │ │
│  │               │    │  camera tracking             │ │
│  └──────┬───────┘    └────────────────────────────┘ │
│         │                                           │
│         │  After 15s: collect fitness scores         │
│         │                                           │
└─────────┼───────────────────────────────────────────┘
          │
          │  POST /api/evolve
          │  { generation: 42, scores: [...], environment: {...} }
          │
          ▼
┌─────────────────────────────────────────────────────┐
│              FastAPI Backend (Railway)                │
│                                                     │
│  ┌────────────────────────────────────────────────┐ │
│  │  1. Receive fitness scores                      │ │
│  │  2. Assign fitness to genomes                   │ │
│  │  3. Run speciation                              │ │
│  │  4. Fitness sharing                             │ │
│  │  5. Selection (tournament, k=3)                 │ │
│  │  6. Crossover (75%) + Asexual (25%)            │ │
│  │  7. Mutation (body + neural)                    │ │
│  │  8. Return 20 new genomes                       │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  In-memory state:                                   │
│  - Current population (20 genomes)                  │
│  - Species list + representatives                   │
│  - Innovation counter                               │
│  - Generation history (JSONL append log)            │
│                                                     │
│  POST /api/evolve → returns 20 new genome JSONs     │
│  GET /api/lineage → returns fitness history          │
│  POST /api/reset → restart from Generation 0        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 9.3 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/genesis` | Initialize a new population. Returns 20 minimal genomes (Generation 0). Also returns default environment settings. |
| `POST` | `/api/evolve` | Accept fitness scores for current generation + current environment settings. Run NEAT selection, crossover, mutation. Return 20 new genomes for the next generation. |
| `GET` | `/api/lineage` | Return the full evolutionary history: per-generation best fitness, species timeline, champion genome of each generation. |
| `POST` | `/api/reset` | Clear all state. Reinitialize population. Return fresh Generation 0. |
| `GET` | `/api/champion/{generation}` | Return the champion genome of a specific past generation (for replay). |

### 9.4 API Request/Response Schemas

#### POST /api/evolve

**Request:**

```typescript
interface EvolveRequest {
  generation: number;
  scores: CreatureResult[];       // 20 creature results
  environment: {
    gravity: number;              // Current gravity multiplier
    friction: number;             // Current ground friction
    terrain: TerrainType;         // Current terrain type
  };
}
```

**Response:**

```typescript
interface EvolveResponse {
  generation: number;             // New generation number
  genomes: Genome[];              // 20 new genomes
  species_info: SpeciesInfo[];    // Current species breakdown
  stats: GenerationStats;         // Aggregate stats
}

interface SpeciesInfo {
  species_id: number;
  color_hue: number;              // HSL hue for visualization
  member_count: number;
  avg_fitness: number;
  champion_genome_id: string;
  age: number;                    // How many generations this species has existed
}

interface GenerationStats {
  best_fitness: number;
  avg_fitness: number;
  fitness_std: number;
  species_count: number;
  avg_body_complexity: number;    // Mean limb count
  avg_neural_complexity: number;  // Mean synapse count
  most_complex_body: number;      // Max limb count in population
}
```

#### GET /api/lineage

**Response:**

```typescript
interface LineageResponse {
  history: GenerationRecord[];
}

interface GenerationRecord {
  generation: number;
  best_fitness: number;
  avg_fitness: number;
  species_count: number;
  species_ids: number[];          // Which species existed
  champion_genome_id: string;
  environment: {
    gravity: number;
    friction: number;
    terrain: TerrainType;
  };
}
```

### 9.5 Performance Budget

| Operation | Target | Approach |
|-----------|--------|----------|
| Physics + NN per frame (20 creatures) | < 16ms (60 FPS) | planck.js is optimized Box2D. NN forward pass is simple matrix ops in JS. 20 small networks is trivial. |
| Canvas render per frame | < 5ms | Direct Canvas 2D context drawing. No DOM manipulation. Batch draw calls. |
| Neural Inspector SVG update | < 10ms | Only update for the selected creature. Throttle to 10 FPS (visual update is perceptual, not physical). |
| POST /api/evolve round trip | < 1000ms | NEAT on 20 genomes is fast. Speciation + crossover + mutation is pure Python computation. Network latency ~200ms. Total ~500ms typical. |
| Full generation cycle | ~16s | 15s simulation + ~1s evolution + genome transfer. |

### 9.6 Deployment Architecture

```
GitHub Repository (monorepo)
├── /frontend        → Vercel (auto-deploy on push)
│   ├── Next.js 14 app
│   ├── planck.js physics engine integration
│   ├── Canvas renderer
│   ├── Neural Inspector (SVG)
│   └── Zustand state
├── /backend         → Railway (auto-deploy on push)
│   ├── FastAPI app
│   ├── neat/
│   │   ├── genome.py          # Genome data structures
│   │   ├── population.py      # Population management
│   │   ├── species.py         # Speciation logic
│   │   ├── reproduction.py    # Selection, crossover, mutation
│   │   ├── innovation.py      # Innovation number tracker
│   │   └── config.py          # All NEAT constants
│   └── lineage/
│       └── history.py         # JSONL append-only log
└── /docs
    ├── PRD.md
    ├── architecture.md
    └── neat_reference.md      # NEAT algorithm explanation
```

**Environment Variables:**

| Variable | Where | Value |
|----------|-------|-------|
| `NEXT_PUBLIC_API_URL` | Frontend (Vercel) | `https://evomorph-api.railway.app` |
| `ALLOWED_ORIGINS` | Backend (Railway) | `https://evomorph.vercel.app` |

**No database.** Evolution state lives in backend memory. Lineage history is appended to a JSONL file. If the server restarts, evolution begins from Generation 0. This is acceptable for a demo — and can be acknowledged as a "V2: add persistence" item.

---

## 10. Scope Boundaries

### 10.1 Explicitly IN Scope

**NEAT Evolution Engine (Backend):**

- Custom NEAT implementation from scratch in Python
- Unified genome with historical innovation markers
- Speciation with compatibility distance
- Fitness sharing (adjusted fitness by species size)
- Crossover aligned by innovation number
- 5 body mutations: add limb, remove limb, mutate segment, mutate joint, add sensor
- 4 neural mutations: mutate weights, add synapse, add node (split), toggle enable
- Recurrent neural connections allowed
- Elitism (champion preservation for species with 5+ members)
- Generation history stored as in-memory JSONL

**Simulation Engine (Frontend):**

- planck.js 2D physics running at 60 FPS
- Creature instantiation from genome JSON (body segments → planck bodies, joints → planck joints)
- Per-frame tick loop: read sensors → neural network forward pass → apply motor torques → step physics
- 15-second generation timer
- Fitness calculation: max X distance + upright bonus - energy penalty - head touch penalty
- 20 creatures simulating simultaneously

**God Mode:**

- Gravity slider (0.1x – 3.0x)
- Friction slider (0.0 – 1.0)
- 4 terrain types: Flat, Hurdles, Stairs, Hills
- Changes take effect at next generation start

**Visualization:**

- Canvas-rendered creatures with species color coding
- Camera auto-follow on leader with smooth interpolation
- Click-to-select any creature
- Neural Inspector: live SVG graph with firing neurons (node opacity = activation, edge thickness = weight magnitude)
- Body structure diagram (SVG)
- Real-time leaderboard with species colors and fitness bars
- Phylogeny timeline: fitness curve + species bands + environment change markers + scrubber

**Dashboard:**

- Top bar: generation counter, best fitness, all-time record, species count, timer
- Per-generation stats: avg fitness, body complexity, neural complexity, species breakdown

**Simulation Controls:**

- Play / Pause / Reset
- Speed multiplier (1x / 2x / 5x) — at higher speeds, physics steps are batched per frame
- "New Population" button to restart from Generation 0

### 10.2 Explicitly OUT of Scope

1. **Authentication / User accounts** — no login. Opens directly into the simulation.
2. **Database persistence** — no PostgreSQL. Server restart means evolution restarts. Acceptable for a demo.
3. **User-drawn creatures** — users cannot manually design creatures. They can only manipulate the environment to guide evolution.
4. **3D rendering** — strictly 2D physics and rendering. 3D would take weeks and add nothing to the AI/ML story.
5. **WebSockets** — REST polling at generation boundaries is sufficient. One request per 15 seconds does not justify WebSocket complexity.
6. **Multiplayer / Shared evolution** — single user, single simulation instance.
7. **Mobile responsiveness** — desktop only. The arena needs screen real estate.
8. **Creature-vs-creature competition** — all creatures compete against the environment, not each other. PvP evolution is a strong V2 feature.
9. **Sound / Audio** — no sound effects for creature movement or evolution events.
10. **Export / Save evolution** — no ability to download genomes or replay files. V2 feature.
11. **Custom fitness functions** — the fitness function is hardcoded. No user-configurable objectives.

---

## Appendix A: NEAT Reference (For Documentation)

The NEAT algorithm (NeuroEvolution of Augmenting Topologies) was published by Kenneth O. Stanley and Risto Miikkulainen in 2002. It solves three key problems in neuroevolution:

1. **The competing conventions problem:** Different network topologies can encode the same behavior. NEAT uses historical markings (innovation numbers) to align genomes during crossover, ensuring that crossover is meaningful even between structurally different networks.

2. **Protecting innovation:** New topological innovations (a new node, a new connection) are initially unoptimized and perform poorly. Without protection, they're eliminated before they can be refined. NEAT uses speciation to group similar topologies together, so innovations compete only against similar structures.

3. **Minimizing dimensionality:** Starting with minimal networks and complexifying through mutations prevents searching high-dimensional weight spaces unnecessarily. This makes the search more efficient than starting with large, randomly initialized networks.

In EvoMorph, we extend NEAT to co-evolve morphology (body structure) alongside neural topology. This is achieved by including body genes in the same chromosome as neural genes, with shared innovation numbers enabling meaningful crossover of the entire organism.

**Paper:** Stanley, K.O. & Miikkulainen, R. (2002). "Evolving Neural Networks through Augmenting Topologies." *Evolutionary Computation*, 10(2), 99-127.

---

## Appendix B: Terrain Generation Reference

### Flat
```
Ground: y = 0 for all x
```

### Hurdles
```
Ground: y = 0 everywhere, with rectangular blocks:
  Block at x = 100, 200, 300, ...
  Block dimensions: width=15px, height=10px
  Spacing: every 100px
```

### Stairs
```
Ground: ascending steps
  Step width: 40px
  Step height: 8px
  Total: 25 steps (200px total rise over 1000px run)
```

### Hills (Perlin Noise)
```
Ground: y = perlinNoise(x * frequency) * amplitude
  Frequency: 0.01 (smooth, rolling hills)
  Amplitude: 30px (gentle elevation changes)
  Seed: randomized per generation reset, fixed within a run
```

---

## Appendix C: Project Repository Structure

```
evomorph/
├── README.md
├── PRD.md
│
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── next.config.js
│   └── src/
│       ├── app/
│       │   ├── layout.tsx
│       │   └── page.tsx
│       ├── components/
│       │   ├── arena/
│       │   │   ├── PhysicsArena.tsx         # Main canvas component
│       │   │   ├── CreatureRenderer.ts      # Draw creatures on canvas
│       │   │   ├── TerrainRenderer.ts       # Draw terrain on canvas
│       │   │   ├── CameraController.ts      # Camera follow + zoom logic
│       │   │   └── Minimap.tsx              # Overview minimap
│       │   ├── topbar/
│       │   │   ├── TopBar.tsx
│       │   │   ├── SimControls.tsx           # Play/Pause/Reset/Speed
│       │   │   └── MetricsBadges.tsx         # Generation, fitness, species count
│       │   ├── inspector/
│       │   │   ├── NeuralInspector.tsx       # Live SVG neural graph
│       │   │   ├── NeuralNode.tsx            # Individual neuron component
│       │   │   ├── NeuralEdge.tsx            # Synapse line component
│       │   │   ├── BodyDiagram.tsx           # Structural SVG diagram
│       │   │   └── CreatureStats.tsx         # Limb count, synapses, species
│       │   ├── godmode/
│       │   │   ├── GodModePanel.tsx
│       │   │   ├── GravitySlider.tsx
│       │   │   ├── FrictionSlider.tsx
│       │   │   └── TerrainSelector.tsx
│       │   ├── leaderboard/
│       │   │   ├── Leaderboard.tsx
│       │   │   └── LeaderboardEntry.tsx
│       │   └── phylogeny/
│       │       ├── PhylogenyTimeline.tsx     # Fitness curve + species bands
│       │       ├── GenerationScrubber.tsx
│       │       └── SpeciesBands.tsx
│       ├── engine/
│       │   ├── PhysicsWorld.ts               # planck.js world setup
│       │   ├── CreatureBuilder.ts            # Genome → planck bodies + joints
│       │   ├── NeuralNetwork.ts              # NN forward pass in JS
│       │   ├── SensorReader.ts               # Read physics state → sensor values
│       │   ├── MotorController.ts            # NN outputs → joint torques
│       │   ├── FitnessCalculator.ts          # Score creature after simulation
│       │   └── SimulationLoop.ts             # Master tick loop orchestrator
│       ├── store/
│       │   └── simulationStore.ts            # Zustand global state
│       ├── services/
│       │   └── api.ts                        # Backend API client
│       └── types/
│           ├── genome.ts                     # Genome TypeScript interfaces
│           ├── simulation.ts                 # Simulation state interfaces
│           └── environment.ts                # Environment config interfaces
│
├── backend/
│   ├── requirements.txt
│   ├── main.py                               # FastAPI entry point
│   ├── config.py                             # Environment config + NEAT constants
│   ├── routers/
│   │   ├── evolution.py                      # /api/genesis, /api/evolve, /api/reset
│   │   └── lineage.py                        # /api/lineage, /api/champion/{gen}
│   ├── neat/
│   │   ├── __init__.py
│   │   ├── genome.py                         # Genome class (node genes, connection genes)
│   │   ├── population.py                     # Population manager
│   │   ├── species.py                        # Species class, compatibility distance
│   │   ├── reproduction.py                   # Selection, crossover, mutation operators
│   │   ├── innovation.py                     # Global innovation number tracker
│   │   └── config.py                         # All NEAT hyperparameters
│   ├── fitness/
│   │   └── evaluator.py                      # Fitness calculation (receives raw scores)
│   ├── lineage/
│   │   └── history.py                        # JSONL append-only generation log
│   └── schemas/
│       ├── genome.py                         # Pydantic genome schemas
│       ├── evolution.py                      # Evolve request/response schemas
│       └── lineage.py                        # Lineage response schemas
│
└── docs/
    ├── PRD.md                                # This document
    ├── architecture.md                       # Technical architecture overview
    ├── neat_reference.md                     # NEAT algorithm explanation
    └── demo_script.md                        # Pitch script for the presentation
```

---

## Appendix D: Key Libraries & Versions

| Library | Purpose | Install |
|---------|---------|---------|
| `next` | Frontend framework | `npm install next@14` |
| `react` | UI library | `npm install react react-dom` |
| `planck-js` | 2D physics engine (Box2D port) | `npm install planck-js` |
| `zustand` | State management | `npm install zustand` |
| `recharts` | Charts (phylogeny timeline) | `npm install recharts` |
| `lucide-react` | Icons | `npm install lucide-react` |
| `tailwindcss` | Styling | `npm install -D tailwindcss` |
| `fastapi` | Backend API | `pip install fastapi` |
| `uvicorn` | ASGI server | `pip install uvicorn` |
| `pydantic` | Validation | `pip install pydantic` |
| `numpy` | Numerical computation (crossover, mutation) | `pip install numpy` |

---
