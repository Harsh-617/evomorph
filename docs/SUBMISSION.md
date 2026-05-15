# EvoMorph — Shortcut Asia Internship Challenge 2026

**Submitted by:** Harsh Kumar  
**Email:** harshkudu67@gmail.com  
**GitHub:** https://github.com/Harsh-617/evomorph  
**Date:** 2026-05-15

---

## 1. Project Overview

EvoMorph is a browser-based artificial life sandbox that co-evolves the bodies
and brains of 2D creatures in real time. Each creature has a **body** (physical
segments and joints) and a **brain** (neural network). Both evolve
simultaneously using a custom implementation of NEAT (NeuroEvolution of
Augmenting Topologies), the landmark 2002 algorithm by Stanley & Miikkulainen.

The simulation runs at **60 FPS** entirely in the browser using the planck.js
physics engine (a Box2D port). After 15 seconds of physics evaluation, fitness
scores are sent to a Python/FastAPI backend which runs genetic selection,
crossover, and mutation, returning the next generation of genomes. No locomotion
logic is ever hand-coded — everything emerges from selection pressure on the
single fitness signal: **how far did you move?**

By generation 20–30, creatures reliably develop multi-limb bodies and rhythmic
gaits without any programmer guidance on what a good body plan looks like.

---

## 2. Approach & Planning

Development followed a strict build-order discipline: no frontend work until
the backend was fully tested, no visual polish until the core loop was proven.

1. **PRD first** — wrote a full product requirements document defining genome
   schema, NEAT hyperparameters, fitness function, and UI feature set before
   writing any code
2. **Data models** — defined Pydantic schemas (Python) and TypeScript interfaces
   in parallel, establishing the JSON contract before either side existed
3. **Backend NEAT engine** — implemented the full 9-step evolution loop with
   22 pytest tests passing before touching the frontend
4. **Physics bridge** — `CreatureBuilder.ts` translates genome JSON into
   planck.js rigid bodies; `SimulationLoop.ts` runs the 60 FPS tick loop
5. **REST integration** — connected frontend to backend with two endpoints;
   verified end-to-end with real genomes before adding any UI chrome
6. **Iterative UI** — God Mode, Neural Inspector, Leaderboard, Phylogeny
   Timeline added one at a time, each verified against the running simulation
7. **Code quality pass** — systematic audit (critical → medium → low) removing
   debug prints, dead code, magic numbers, and stale docstrings

---

## 3. Why These Tools

| Technology | Reason |
|---|---|
| **Next.js 14 + TypeScript** | Type safety is critical when genome data structures cross the network boundary. TypeScript catches schema drift at compile time rather than at runtime during a 15-second evaluation window. |
| **planck.js (Box2D)** | Mature rigid-body physics running at 60 FPS in the browser without any server round-trips during evaluation. The alternative (server-side physics) would cap the simulation at ~5 FPS due to HTTP latency. |
| **FastAPI** | Async Python, automatic OpenAPI docs at `/docs`, and Pydantic validation that rejects malformed genomes before they corrupt the evolution state. |
| **Zustand** | Minimal React state management with no boilerplate. The simulation engine is a plain TypeScript class; Zustand bridges it to the React component tree without forcing unnecessary re-renders. |
| **Custom NEAT from scratch** | No ML library. Implementing the full 2002 Stanley & Miikkulainen paper — historical markings, compatibility distance, speciation, fitness sharing, crossover alignment by innovation number — demonstrates deep algorithmic understanding rather than calling `.fit()`. |
| **pytest + Jest** | 43 tests total. Backend tests verify the evolution invariants (population size, species survival, generation counter). Frontend tests cover the physics-to-fitness pipeline in Node.js with a planck.js mock. |

---

## 4. Key Technical Decisions

**Physics runs client-side.**  
A server-side physics step would add ~200 ms per frame, capping the simulation
at 5 FPS. planck.js in the browser delivers consistent 60 FPS with zero network
dependency during the 15-second evaluation window.

**REST not WebSockets.**  
One HTTP request per 15-second generation is the entire protocol — 0.067 req/s.
WebSocket overhead (connection management, reconnection logic, backpressure) is
not justified for this workload.

**Unified chromosome.**  
Body genes (`NodeGene` with `NodeType.BODY_SEGMENT`) and brain genes
(`NodeGene` with `NodeType.HIDDEN/INPUT/OUTPUT`) live in the same array.
Joints and synapses share `connection_genes`. A single crossover operation
co-evolves morphology and controller simultaneously — there is no separate body
genotype that could drift out of sync with the neural genotype.

**Displacement not absolute position.**  
Fitness measures how far a creature moved from its spawn point, not its
absolute x-coordinate. All 8 creatures spawn at x = 0 so comparison is fair
regardless of spawn order, but the formula is robust to any spawn layout.

**Module-level Population singleton.**  
`Population` is instantiated at module import time in `routers/evolution.py`.
FastAPI's single-process Uvicorn worker keeps the object alive between requests,
so species history, innovation counters, and generation numbers persist across
HTTP calls without a database. This is intentional for local use.

---

## 5. Flowcharts

### Flowchart 1 — Per-Tick Simulation Loop (60 FPS)

```
┌─────────────────────────────────────────────────────────────┐
│                  requestAnimationFrame tick                  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
              ┌─────────────────────────────┐
              │         Read Sensors         │
              │  joint angles, ground contact│
              │  body angle, angular velocity│
              └──────────────┬──────────────┘
                             │  float[]
                             ▼
              ┌─────────────────────────────┐
              │    Neural Forward Pass       │
              │  topological sort, tanh/relu │
              │  recurrent: prev activations │
              └──────────────┬──────────────┘
                             │  float[] (outputs)
                             ▼
              ┌─────────────────────────────┐
              │       Actuate Motors         │
              │  applyAngularImpulse per     │
              │  revolute joint every tick   │
              └──────────────┬──────────────┘
                             │
                             ▼
              ┌─────────────────────────────┐
              │       Step Physics           │
              │  world.step(1/60)            │
              │  planck.js Box2D integration │
              └──────────────┬──────────────┘
                             │
                             ▼
              ┌─────────────────────────────┐
              │      Update Fitness          │
              │  track maxX displacement,    │
              │  accumulate motor torque     │
              └──────────────┬──────────────┘
                             │
                    (repeat until 15 s elapsed)
                             │
                             ▼
                  POST /api/evolve → next generation
```

### Flowchart 2 — Generation Lifecycle

```
  GET /api/genesis
        │
        ▼
┌───────────────┐
│   Genesis     │  8 minimal creatures
│  (Gen 0)      │  torso + 1 limb + 1 synapse
└───────┬───────┘
        │
        ▼
┌───────────────┐
│  15-Second    │  60 FPS physics in browser
│  Simulation   │  sensors → neural net → motors
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ Collect       │  fitness per creature
│ Results       │  displacement × 5 + efficiency bonus
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ POST          │  EvolveRequest: results[] + environment
│ /api/evolve   │
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ NEAT          │  speciation by compatibility distance δ
│ Selection     │  fitness sharing, cull bottom 40%
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ Crossover     │  align genes by innovation number
│ + Mutation    │  9 operators: weights, add/remove limb,
│               │  add synapse, split node, mutate joint…
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ Next          │  EvolveResponse: 8 new genomes
│ Generation    │  generation counter incremented
└───────┬───────┘
        │
        └──────────────► back to 15-Second Simulation
```

---

## 6. Architecture Overview

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

The browser owns the hot loop (60 FPS physics + neural evaluation). The backend
owns all evolutionary state (species history, innovation numbers, generation
counter). The boundary is clean: one JSON payload in, one JSON payload out,
once per 15 seconds.

---

## 7. Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 14 + TypeScript | UI and simulation driver |
| Physics | planck.js (Box2D) | 60 FPS rigid body simulation |
| State | Zustand | Global simulation state |
| Charts | Recharts | Phylogeny timeline |
| Backend | FastAPI (Python 3.11) | NEAT evolution engine |
| ML | Custom NEAT | Neuroevolution algorithm |
| Testing | pytest + Jest | 43 tests total |

---

## 8. Challenges & How They Were Solved

**Premature convergence.**  
The population collapsed to one body plan within 5 generations. Root cause: the
species threshold was too high (3.0), allowing all creatures to be assigned to
one species, so fitness sharing offered no protection to morphological
minorities. Fixed by lowering `SPECIES_THRESHOLD` to 1.5 and `SURVIVAL_RATE`
to 0.60 for more aggressive culling.

**Fitness plateau at ~25 points.**  
Best fitness stalled for dozens of generations. Discovered the upright-time
bonus (up to 50 points) was dominating the distance signal (which grew slowly
from zero). Stationary creatures were scoring 50 by simply not falling over.
Fixed by removing the upright bonus entirely and making distance the
overwhelming signal: `fitness = displacement × 5 + efficiency_bonus (max 10)`.

**Motor joints not moving.**  
Creatures were receiving neural outputs but no joints responded. Planck.js
revolute joints require `enableMotor(true)` and `setMaxMotorTorque()` to be
called **every tick**; calling them only at creation is silently ignored on
subsequent frames. Added these calls inside the per-tick actuate loop.

**Hidden node activations lost.**  
Creatures with hidden neurons weren't developing rhythmic behavior despite
recurrent connections in the genome. `evaluateNetwork()` was only returning
output activations and discarding internal state. Fixed the return type to
`{outputs, allActivations}` and stored all node activations in
`prevActivations` for the next tick.

**Species flickering.**  
Species IDs changed erratically between generations even when the population
was stable. Cause: the representative genome was selected randomly each
generation. A genome near the species boundary could become representative,
causing borderline members to re-assign elsewhere. Fixed by switching to
champion selection (highest fitness member becomes representative).

---

## 9. What I'd Improve With More Time

- **Persistent evolution across sessions** — externalise `Population` state to
  SQLite or Redis so evolution history survives server restarts
- **Multi-terrain co-evolution** — run parallel populations on different
  terrains and study whether specialists or generalists win the cross-terrain
  fitness test
- **3D simulation** — extend the genome to include depth axis; use a WebGL
  renderer (Three.js + rapier.js) instead of Canvas + planck.js
- **Larger population with parallel evaluation** — Web Workers could evaluate
  multiple creatures concurrently, allowing populations of 50–100 without
  frame-rate degradation
- **Deployment** — containerise the FastAPI backend and deploy to Railway or
  Fly.io; host the Next.js frontend on Vercel; add the live demo link

---

*Built for the Shortcut Asia Internship Challenge 2026.*  
*NEAT reference: Stanley, K. O. & Miikkulainen, R. (2002). "Evolving Neural Networks through Augmenting Topologies." Evolutionary Computation, 10(2), 99–127.*
