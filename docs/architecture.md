# EvoMorph — Technical Architecture

## System Overview

EvoMorph is a hybrid browser/server artificial-life sandbox: all real-time
physics and neural-network evaluation run in the browser (Next.js + planck.js)
at 60 FPS, while a Python FastAPI backend owns the evolutionary algorithm —
speciation, crossover, and mutation — and returns the next generation of
genomes after each 15-second evaluation window. The split keeps the hot loop
entirely client-side while offloading the stateful NEAT bookkeeping to a
language better suited for scientific computing.

```
┌─────────────────────────────────────┐
│              Browser                │
│                                     │
│  Next.js 14 + TypeScript            │
│  ┌─────────────┐  ┌───────────────┐ │
│  │ React UI    │  │ Simulation    │ │
│  │ Components  │  │ Engine (TS)   │ │
│  │ (Zustand)   │  │ planck.js     │ │
│  └──────┬──────┘  └──────┬────────┘ │
│         └────────┬────────┘         │
│                  │ REST (fetch)     │
└──────────────────┼──────────────────┘
                   │
         ┌─────────▼─────────┐
         │   FastAPI Backend  │
         │                   │
         │  GET  /api/genesis │
         │  POST /api/evolve  │
         │                   │
         │  ┌─────────────┐  │
         │  │ NEAT Engine │  │
         │  │ (Python)    │  │
         │  └─────────────┘  │
         └───────────────────┘
```

---

## Frontend Architecture

### Next.js 14 App Structure

```
frontend/src/
├── app/
│   ├── layout.tsx          # Root layout, font loading
│   ├── page.tsx            # Entry point, mounts arena + panels
│   └── globals.css
├── components/
│   ├── arena/              # PhysicsArena.tsx — canvas + loop driver
│   ├── godmode/            # GodModePanel.tsx — gravity/friction/terrain
│   ├── inspector/          # NeuralInspector.tsx — live network graph
│   ├── leaderboard/        # Leaderboard.tsx — per-generation rankings
│   ├── phylogeny/          # PhylogenyTimeline.tsx — species history
│   └── topbar/             # Generation counter, speed controls
├── engine/                 # Pure TS physics + neural evaluation
├── services/
│   └── api.ts              # Fetch wrappers for /api/genesis and /api/evolve
├── store/
│   └── simulationStore.ts  # Zustand global state
└── types/
    └── genome.ts           # TypeScript mirror of backend Pydantic schemas
```

### Key Engine Files

**`engine/SimulationLoop.ts`** — `SimulationEngine` class, the physics
orchestrator. Owns the `requestAnimationFrame` loop, holds references to all
active creature bodies, and sequences Read → Think → Actuate → Step on every
tick. Coordinates `SensorReader`, `MotorController`, and `FitnessCalculator`.

**`engine/CreatureBuilder.ts`** — `createPhysicsCreature()`. Translates a
`Genome` JSON into planck.js rigid bodies and revolute joints using a BFS
traversal of the connection graph. Sets `PIXELS_PER_METER = 30` for the
coordinate-space conversion.

**`engine/NeuralNetwork.ts`** — `evaluateNetwork()`. Performs a forward pass
over the network encoded in the genome's connection genes. Builds a
topological sort at evaluation time to support acyclic edges; recurrent edges
are fed the previous tick's activations.

**`engine/SensorReader.ts`** — Reads joint angles, ground-contact flags, body
angle, and angular velocity directly from planck.js body/joint objects and
packages them as a float array for network input.

**`engine/MotorController.ts`** — Converts the network's output activations
into `applyAngularImpulse` calls on the corresponding revolute joints.

**`engine/FitnessCalculator.ts`** — `calculateFitness()`. Accumulates
displacement from spawn position, efficiency bonuses (low cumulative torque),
and applies them at generation end.

**`engine/PhysicsWorld.ts`** — Thin planck.js wrapper that constructs the
world, ground plane, and terrain fixtures (flat / hurdles / stairs / hills)
from the current `EnvironmentConfig`.

**`components/arena/PhysicsArena.tsx`** — React canvas component. Mounts a
`SimulationEngine` instance, subscribes to Zustand for physics parameters, and
renders creature bodies each frame. Camera follows the creature with the
highest cumulative displacement.

**`store/simulationStore.ts`** — Zustand store. Holds:

| Field | Type | Purpose |
|---|---|---|
| `generation` | number | Current generation index |
| `bestFitness` | number | Best score this generation |
| `allTimeRecord` | number | All-time best fitness |
| `population` | Genome[] | Active genome array |
| `history` | GenerationStats[] | Per-generation summary for charts |
| `gravity` / `friction` / `terrain` | primitives | God Mode physics params |
| `isPlaying` | boolean | Pause/play toggle |
| `simulationSpeed` | number | Speed multiplier (0.5×–4×) |

### The 60 FPS Tick Loop

```
requestAnimationFrame
  │
  ▼
SensorReader.read(bodies)     → float[]   (joint angles, contact, angle, ω)
  │
  ▼
NeuralNetwork.evaluate(net, inputs) → float[]  (one output per motor)
  │
  ▼
MotorController.actuate(joints, outputs)      (applyAngularImpulse)
  │
  ▼
world.step(1/60)                              (planck.js physics step)
  │
  ▼
FitnessCalculator.accumulate(bodies)          (track displacement + torque)
  │
  ▼ (repeat until 15 s elapsed)
api.evolve(results) → next generation genomes
```

### Camera Follow System

`PhysicsArena.tsx` recomputes the leading creature (highest `body.getPosition().x`
displacement from spawn) every frame and translates the canvas context so that
creature stays centred. The follow target switches immediately when leadership
changes.

---

## Backend Architecture

### FastAPI App Structure

```
backend/
├── main.py                  # App init, CORS, router mount at /api
├── routers/
│   └── evolution.py         # GET /api/genesis, POST /api/evolve
├── schemas/
│   ├── genome.py            # NodeGene, ConnectionGene, Genome (Pydantic)
│   └── evolution.py         # CreatureResult, EvolveRequest, EvolveResponse
└── neat/
    ├── config.py            # All hyperparameters (constants)
    ├── innovation.py        # InnovationTracker — global innovation counter
    ├── species.py           # Species class, compatibility_distance()
    ├── reproduction.py      # crossover(), mutate(), 9 mutation operators
    └── population.py        # Population class — 9-step NEAT evolution loop
```

### Key Backend Modules

**`schemas/genome.py`** — Pydantic models that define the unified chromosome:
`NodeGene` (body segment or neuron, discriminated by `NodeType` enum),
`ConnectionGene` (joint or synapse, discriminated by `ConnectionType` enum),
`NeuralNetwork`, and the top-level `Genome`. Enums: `NodeType`, `SensorType`,
`ActivationType`, `ConnectionType`.

**`schemas/evolution.py`** — Request/response envelope models:
`CreatureResult` (fitness stats from the browser), `EnvironmentConfig`
(gravity/friction/terrain), `EvolveRequest`, `EvolveResponse`,
`SpeciesInfo`, `GenerationStats`.

**`neat/config.py`** — Single source of truth for all hyperparameters:
`POPULATION_SIZE`, `SPECIES_THRESHOLD`, compatibility coefficients `C1/C2/C3`,
`SURVIVAL_RATE`, `CROSSOVER_RATE`, `ELITISM_THRESHOLD`, and per-operator
mutation rates and parameter ranges.

**`neat/innovation.py`** — `InnovationTracker` singleton. `get_innovation()`
returns an existing innovation number for a (in_node, out_node) pair or mints
a new one, guaranteeing that the same structural mutation in the same
generation gets the same ID across all offspring. `reset_generation()` clears
the within-generation cache while preserving historical IDs.

**`neat/species.py`** — `compatibility_distance()` implements the NEAT δ
formula (see below). `Species` class holds a representative genome and its
member list; `assign_representative()` picks a random survivor each generation
to prevent species drift.

**`neat/reproduction.py`** — `crossover(parent_a, parent_b)` aligns genes by
innovation ID and inherits disjoint/excess genes from the fitter parent.
`mutate(genome)` dispatches to one or more of the 9 operators listed below.

**`neat/population.py`** — `Population` class. Module-level singleton so
species history survives across HTTP requests. Runs the 9-step NEAT loop on
`evolve()`:

1. Score genomes from `CreatureResult` payloads
2. Speciate (assign each genome to closest compatible species)
3. Compute adjusted fitness (fitness sharing within species)
4. Rank species by mean adjusted fitness
5. Cull low-fitness species below survival threshold
6. Elect elites (top-N per species copied unchanged)
7. Fill remainder via crossover + mutation
8. Update species representatives
9. Increment generation counter

**`routers/evolution.py`** — Stateless HTTP handlers. `genesis()` builds 20
minimal genomes via `_make_minimal_genome()` (1 torso + 1 limb + 1 synapse)
and seeds the module-level `Population`. `evolve()` deserialises
`EvolveRequest`, calls `population.evolve()`, and serialises the response.

---

## API Contract

### `GET /api/genesis`

Returns 20 seed genomes for generation 0. No request body.

```json
// Response — EvolveResponse
{
  "genomes": [ /* 20 × Genome */ ],
  "generation": 0,
  "species_info": [ /* SpeciesInfo[] */ ],
  "stats": { /* GenerationStats */ }
}
```

Each genome has: `genome_id`, `species_id`, `generation`, `fitness`,
`node_genes: NodeGene[]`, `connection_genes: ConnectionGene[]`.

### `POST /api/evolve`

Accepts fitness results from the browser, runs NEAT selection/crossover/
mutation, returns the next generation.

```json
// Request — EvolveRequest
{
  "results": [
    {
      "genome_id": "...",
      "fitness": 12.4,
      "distance_traveled": 8.1,
      "time_alive": 15.0,
      "joints_used": 3
    }
    // × 20
  ],
  "environment": {
    "gravity": 9.8,
    "friction": 0.5,
    "terrain": "flat"
  }
}

// Response — EvolveResponse (same shape as /genesis)
```

---

## NEAT Algorithm (Custom Implementation)

### Historical Markings

Every structural gene (node or connection) carries an **innovation number**
assigned by `InnovationTracker`. When two genomes share a gene with the same
innovation number, those genes are **aligned** — they describe the same
evolutionary event. Genes present in one parent but not the other are
**disjoint** (within the range of the other parent's IDs) or **excess**
(beyond it).

### Speciation

```
δ = (C1 × E / N) + (C2 × D / N) + (C3 × W̄)
```

| Symbol | Meaning |
|---|---|
| E | Number of excess genes |
| D | Number of disjoint genes |
| N | Number of genes in the larger genome |
| W̄ | Mean absolute weight difference of matching genes |
| C1, C2, C3 | Compatibility coefficients (tuned in `neat/config.py`) |

A genome joins the first species whose representative satisfies `δ < SPECIES_THRESHOLD`.
If none qualifies, a new species is created.

### Fitness Sharing

```
adjusted_fitness = raw_fitness / |species|
```

Prevents any single species from monopolising offspring slots by normalising
each member's contribution by species size.

### Crossover

Genes are zipped by innovation ID:

- **Matching genes** — inherited randomly from either parent.
- **Disjoint / excess genes** — inherited from the fitter parent only.
- Connection enable state — a disabled gene in either parent has a chance of
  remaining disabled in the offspring.

### 9 Mutation Operators (`neat/reproduction.py`)

| Operator | Effect |
|---|---|
| `_mutate_weights` | Perturb or randomise synapse / joint-limit weights |
| `_add_synapse` | Insert a new connection gene between existing nodes |
| `_add_node_split` | Split an existing connection, inserting a hidden neuron |
| `_toggle_enable` | Enable or disable a connection gene |
| `_add_limb` | Append a new body-segment node + connecting joint |
| `_remove_limb` | Delete a leaf body-segment and its joint |
| `_mutate_segment` | Resize a body segment (width / height / mass) |
| `_mutate_joint` | Adjust joint limits or motor speed |
| `_add_sensor` | Attach a new sensor input node to the network |

---

## Fitness Function

```
fitness = displacement × 5
        + efficiency_bonus   (0 – 10, inversely proportional to cumulative torque)
```

- **Primary signal** — displacement from spawn position (metres, measured along
  the x-axis). The ×5 multiplier makes it the overwhelming selection pressure.
- **Efficiency bonus** — rewards creatures that travel far using low cumulative
  motor torque, encouraging smooth gaits over thrashing.
- **No upright penalty** — distance is the sole morphological constraint.
  Crawling, slithering, and rolling are equally valid locomotion strategies.
- **Displacement not absolute position** — all 20 creatures spawn at x = 0, so
  displacement and absolute position are equivalent and competition is fair
  regardless of spawn order.

---

## Key Engineering Decisions

### Physics runs client-side (planck.js)

A server-side physics step would add a REST round-trip (~200 ms) per frame,
capping the simulation at ~5 FPS. Running planck.js in the browser delivers
consistent 60 FPS with no network dependency during evaluation.

### REST not WebSockets

One HTTP request per 15-second generation is the entire protocol. WebSocket
overhead (connection management, reconnection logic, backpressure) is not
justified for a 0.067 req/s workload.

### Unified chromosome

Body genes (`NodeGene` with `NodeType.BODY_SEGMENT`) and brain genes
(`NodeGene` with `NodeType.HIDDEN`/`INPUT`/`OUTPUT`) live in a single
`node_genes` array, and joints/synapses share `connection_genes`. A single
crossover operation therefore co-evolves morphology and controller together.
There is no separate "body genotype" that could drift out of sync with the
neural genotype.

### Module-level Population singleton

`Population` is instantiated at module import time in `routers/evolution.py`.
FastAPI's single-process Uvicorn worker keeps the object alive between
requests, so species history, innovation counters, and generation numbers
persist without a database. This is intentional for local use; a multi-worker
or multi-process deployment would require externalising state.

### Type mirroring between Python and TypeScript

`schemas/genome.py` (Pydantic) and `types/genome.ts` define the same enums
and data shapes in their respective languages. Changes to the genome schema
must be applied to both files manually — there is no code-generation step.
