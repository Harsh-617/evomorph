# EvoMorph

A browser-based artificial life sandbox that co-evolves the bodies and brains
of 2D creatures using a custom NEAT implementation, letting users manipulate
physics in real time and watch locomotion strategies emerge from nothing.

## Demo

[Live demo — link to be added after deployment]

GitHub: [https://github.com/Harsh-617/evomorph](https://github.com/Harsh-617/evomorph)

## What It Does

- 8 creatures start as inert blocks with one limb
- Each generation: 15 seconds of physics simulation → fitness scoring →
  NEAT selection / crossover / mutation → next generation
- By generation 20–30: creatures develop multi-limb bodies and rhythmic gaits
- **God Mode**: change gravity (0.1×–3×), friction (ice → rubber), terrain
  (flat / hurdles / stairs / hills) and watch evolution adapt in real time
- **Click any creature** to inspect its live neural network activations,
  weight matrix, and activation traces

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 + TypeScript |
| Physics | planck.js (Box2D port) |
| State | Zustand |
| Charts | Recharts |
| Backend | FastAPI (Python 3.11) |
| ML Engine | Custom NEAT from scratch |
| Testing | pytest + Jest (43 tests) |

## Local Setup

> Both servers must be running simultaneously — the frontend fetches genomes
> from the backend at startup and after every generation.

### Prerequisites

- Node.js 18+
- Python 3.11+
- Conda (recommended for environment isolation)

### 1 — Start the Backend

Open a terminal and run:

```bash
conda create -n evomorph python=3.11 -y
conda activate evomorph
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend runs at `http://localhost:8000`  
API docs available at `http://localhost:8000/docs`

### 2 — Start the Frontend

Open a **second** terminal and run:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`

Open `http://localhost:3000` in your browser. The simulation starts
automatically once the backend responds to the genesis request.

## Quick Demo

When you open the app for the first time:

1. **Watch generation 0** — 8 identical minimal creatures (torso + one limb)
   are spawned. Most will flail or stay still. This is expected.
2. **Wait 15 seconds** — the timer in the top bar counts down. When it hits
   zero the frontend POSTs fitness scores to the backend and the next
   generation loads automatically.
3. **Speed it up** — click **2×** or **5×** in the top bar to fast-forward.
   At 5× a generation completes in 3 real seconds.
4. **Click a creature** — a floating neural inspector opens showing live
   node activations, edge weights, and an oscilloscope trace per neuron.
5. **Try God Mode** — drag the Gravity or Friction slider (right panel).
   The amber indicator shows changes will apply next generation. Watch the
   population re-adapt over the following generations.
6. **Change terrain** — switch to Hurdles or Hills and observe whether the
   current body plans survive or whether a new morphology takes over.
7. **New Population** — resets everything and re-fetches generation 0 fresh.

By generation 10–15 you should see creatures with 3–5 limbs and rhythmic
gaits emerging without any hand-coded locomotion logic.

## Tests

Run both suites from the repository root:

```bash
# Backend — 22 pytest tests
pytest backend/tests/ -v

# Frontend — 21 Jest tests (run from the frontend directory)
cd frontend
npm test
```

Expected: **43/43 tests passing** across both suites.

## Project Structure

```
evomorph/
├── backend/
│   ├── neat/           # Custom NEAT implementation
│   │   ├── config.py       # All hyperparameters
│   │   ├── innovation.py   # Global innovation counter
│   │   ├── species.py      # Compatibility distance + Species class
│   │   ├── reproduction.py # crossover() + 9 mutation operators
│   │   └── population.py   # 9-step NEAT evolution loop
│   ├── routers/
│   │   └── evolution.py    # GET /api/genesis, POST /api/evolve
│   ├── schemas/
│   │   ├── genome.py       # NodeGene, ConnectionGene, Genome (Pydantic)
│   │   └── evolution.py    # EvolveRequest / EvolveResponse models
│   └── tests/
├── frontend/
│   └── src/
│       ├── app/            # Next.js pages and layout
│       ├── components/     # React UI components
│       │   ├── arena/          # PhysicsArena canvas + simulation driver
│       │   ├── godmode/        # God Mode physics sliders
│       │   ├── inspector/      # Live neural network visualiser
│       │   ├── leaderboard/    # Per-generation fitness rankings
│       │   └── phylogeny/      # Species history timeline
│       ├── engine/         # Pure TS physics + neural evaluation
│       │   ├── SimulationLoop.ts
│       │   ├── CreatureBuilder.ts
│       │   ├── NeuralNetwork.ts
│       │   ├── FitnessCalculator.ts
│       │   └── PhysicsWorld.ts
│       ├── services/
│       │   └── api.ts      # Fetch wrappers for backend endpoints
│       ├── store/
│       │   └── simulationStore.ts  # Zustand global state
│       └── types/
│           └── genome.ts   # TypeScript mirror of backend Pydantic schemas
└── docs/
    ├── PRD.md
    ├── changelog.md
    ├── architecture.md
    └── SUBMISSION.md
```

## How It Works

### Genome

A single `Genome` contains both body and brain in one gene sequence.
`NodeGene` entries represent body segments or neurons (discriminated by
`NodeType`); `ConnectionGene` entries represent joints or synapses
(discriminated by `ConnectionType`). This unified chromosome ensures
morphology and neural controller always co-evolve together.

### Simulation Loop (60 FPS, browser-side)

```
Read Sensors → Neural Forward Pass → Actuate Motors → Step Physics → Update Fitness
```

After 15 seconds, fitness scores are POSTed to `/api/evolve` and the next
generation of genomes is returned.

### NEAT Evolution (server-side)

The backend runs a full NEAT loop: speciation by compatibility distance δ,
fitness sharing within species, elitism, crossover aligned by innovation
number, and 9 structural/parameter mutation operators.

### Fitness

```
fitness = displacement × 5 + efficiency_bonus (0–10)
```

Distance travelled is the dominant signal. The efficiency bonus rewards smooth
gaits over high-torque thrashing.

## NEAT Reference

Stanley, K. O. & Miikkulainen, R. (2002). "Evolving Neural Networks through
Augmenting Topologies." *Evolutionary Computation*, 10(2), 99–127.
