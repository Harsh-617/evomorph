# EvoMorph

A browser-based artificial life sandbox that co-evolves the bodies and brains
of 2D creatures using a custom NEAT implementation, letting users manipulate
physics in real time and watch locomotion strategies emerge from nothing.

## Demo

[Link to be added after deployment]

## What It Does

- 20 creatures start as inert blocks with one limb
- Each generation: 15 seconds of physics simulation → fitness scoring →
  NEAT selection / crossover / mutation → next generation
- By generation 20–30: creatures develop multi-limb bodies and rhythmic gaits
- **God Mode**: change gravity (0.1×–3×), friction (ice → rubber), terrain
  (flat / hurdles / stairs / hills) and watch evolution adapt in real time

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 + TypeScript |
| Physics | planck.js (Box2D port) |
| State | Zustand |
| Charts | Recharts |
| Backend | FastAPI (Python) |
| ML Engine | Custom NEAT from scratch |

## Local Setup

### Prerequisites

- Node.js 18+
- Python 3.11+
- Conda (recommended)

### Backend

```bash
conda create -n evomorph python=3.11 -y
conda activate evomorph
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend runs at `http://localhost:8000`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`

## Tests

```bash
# Backend (from root)
pytest backend/tests/ -v

# Frontend (from frontend/)
npm test
```

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
│       │   ├── SensorReader.ts
│       │   ├── MotorController.ts
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
    └── architecture.md
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
Read Sensors → Neural Forward Pass → Actuate Motors → Step Physics
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
