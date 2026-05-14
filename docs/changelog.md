# EvoMorph Engineering Changelog

## [2026-05-13] - Stage 1: Data Modeling & Schema Synchronization
### Added
- **Backend Schemas:** Created `backend/schemas/genome.py` using Pydantic models. 
    - Implemented strict field validation for morphology (width/height) and joints (angle limits/torque) based on PRD §3.8.
    - Used string-based Enums for direct JSON serialization.
- **Frontend Types:** Created `frontend/src/types/genome.ts`.
    - Defined TypeScript interfaces for `NodeGene`, `ConnectionGene`, and `Genome`.
    - Added `CreatureResult` interface to handle the physics-to-AI data feedback loop.
- **Execution Plan:** Initialized this changelog to document technical decisions and PRD compliance.

### Technical Decisions
- **Serialization:** Chose string enums over integers to ensure the JSON payloads are human-readable and match the PRD's serialization examples.
- **Validation:** Implemented `math.pi` constraints in Python to prevent the generation of physically impossible joint limits before they ever reach the browser physics engine.

## [2026-05-13] - Stage 2: The Genesis Engine (Implementation)
### Added
- **Module:** `backend/routers/evolution.py` initialized to handle population life cycles.
- **Endpoint:** `GET /api/genesis` implemented to generate the starting population.
- **Logic:** `generate_minimal_genome()` helper function created to enforce the "Initial Creature" constraints (Minimalist Gen 0) defined in PRD §2.5.

### Technical Decisions
- **Sensor Mapping:** Assigned fixed `gene_id` values (1-3) to the innate sensors (Body Angle, Ground Contact, Oscillator) to simplify the initial frontend sensor-reading logic.
- **UUIDs:** Integrated `uuid.uuid4()` for `genome_id` to ensure unique tracking across the lineage history.
- **Physical Boundaries:** Applied strict `random.uniform` ranges to the torso morphology to stay within the PRD §3.8 performance budget.

## [2026-05-13] - Stage 3: Frontend API Bridge
### Added
- **Service:** `frontend/src/services/api.ts` implemented using the Fetch API.
- **Integration:** Integrated TypeScript interfaces to ensure the frontend strictly validates the "DNA" payloads received from the Python backend.
- **Environment Config:** Set up `NEXT_PUBLIC_API_URL` support for seamless switching between local development and production.

### Technical Decisions
- **Fetch vs Axios:** Opted for native `fetch` to keep the bundle size minimal and leverage Next.js 14's built-in caching and revalidation capabilities where applicable.

## [2026-05-13] - Stage 4: Global State Management (Zustand)
### Added
- **Store:** `frontend/src/store/simulationStore.ts` implemented using Zustand.
- **State:** Centralized management for physics constants (Gravity/Friction), Population DNA, and UI playback state.
- **Persistence:** Configured local storage persistence for the `allTimeRecord` to preserve progress across sessions.

### Technical Decisions
- **Middleware:** Used Zustand's `persist` middleware specifically for metrics to balance performance with user experience.
- **Speed Multipliers:** Implemented a discrete speed state (1x, 2x, 5x) to prepare for batched physics stepping in Stage 5.

## [2026-05-13] - Stage 5: Physics Bridge (Implementation & Environment Fix)
### Added
- **Core Engine:** `frontend/src/engine/CreatureBuilder.ts` implemented with BFS-based limb instantiation.
- **Physics-to-Visuals:** Established a `PIXELS_PER_METER` constant (30) to bridge Box2D coordinates with HTML5 Canvas rendering.

### Technical Decisions
- **Environment:** Updated `tsconfig.json` with `skipLibCheck: true` to suppress deprecation warnings originating from the `planck` library's internal configuration.
- **Recursive BFS:** Implemented a parent-first construction order to ensure all `RevoluteJoint` anchors are physically valid at the moment of creation.

## [2026-05-13] - Stage 6: Neural Engine & TS Configuration
### Added
- **Neural Engine:** `frontend/src/engine/NeuralNetwork.ts` implemented with support for forward-pass evaluation and recurrent connections.
- **Activations:** Integrated Tanh, ReLU, and Sigmoid activation functions as per PRD §2.1.1.

### Technical Decisions
- **TS Fix:** Applied `skipLibCheck: true` and `ignoreDeprecations: "6.0"` to the frontend `tsconfig.json` to bypass legacy configuration errors within the `planck` node_module.
- **Stateful Activations:** Implemented a `previousActivations` cache within the engine to facilitate recurrent neural topologies, allowing for emergent rhythmic behavior (oscillators).

## [2026-05-14] - Stage 7: The Master Simulation Loop
### Added
- **Core Orchestrator:** `frontend/src/engine/SimulationLoop.ts` implemented to manage the 60 FPS update cycle.
- **Sense-Think-Act:** Wired the `CreatureBuilder` physics bodies to the `NeuralNetwork` evaluations, completing the closed-loop control system.
- **Telemetry:** Built real-time tracking for fitness components (max X distance, energy usage, head touches) over the 15-second generation window.

### Technical Decisions
- **Class-Based Engine:** Opted for a stateful TypeScript Class (`SimulationEngine`) rather than a React Hook to encapsulate the heavy `planck.js` world state and prevent React re-render cycles from interfering with deterministic physics stepping.

## [2026-05-14] - Stage 8: The Physics Arena (Visuals)
### Added
- **UI Component:** `frontend/src/components/arena/PhysicsArena.tsx` implemented.
- **Renderer:** Built an HTML5 Canvas render loop tied to `requestAnimationFrame` to visualize the Box2D bodies.
- **Integration:** Connected the Zustand global state (population, playback controls) directly to the `SimulationEngine` instantiation.

### Technical Decisions
- **Canvas Matrix Transformations:** Used `ctx.save()`, `translate`, and `rotate` to accurately map `planck.js` center-of-mass coordinates and rotations to the screen without manual vertex math.
- **Speed Multiplier:** Handled simulation speed by running multiple logical ticks per visual frame, ensuring deterministic physics regardless of fast-forwarding.

## [2026-05-14] - Stage 9: The Genesis Drop
### Added
- **UI Shell:** `frontend/src/app/page.tsx` implemented as the primary client entry point.
- **Data Hydration:** Built the mount-time fetch logic to pull Generation 0 from the FastAPI backend and inject it into the Zustand store.

### Technical Decisions
- **Client Component:** Designated the main page as a `"use client"` boundary to support React hooks, Zustand state, and browser-only canvas rendering without triggering SSR hydration mismatches.

## [2026-05-14] - Stage 10: Backend Test Suite (Genesis)

### Added
- **Tests:** `backend/tests/test_genesis.py` — 12 pytest tests covering the `/api/genesis` endpoint
- **Package:** `backend/tests/__init__.py` — empty package marker
- **Config:** `conftest.py` at root level — path fix so `from backend.main import app` resolves correctly from the evomorph root

### Test Coverage
- Response shape: 20 genomes, all required fields present
- Generation 0 constraints: generation=0, fitness=0.0, no connections
- Morphology validation: exactly 1 BODY_SEGMENT, exactly 3 INPUT sensors (BODY_ANGLE, GROUND_CONTACT, OSCILLATOR)
- Physical range checks: width 10-60, height 5-30, density 0.5-3.0, friction 0.1-1.0
- Uniqueness: all 20 genome_ids are distinct

### Technical Decisions
- **Module-scoped fixture:** Genesis endpoint called once, response shared across all 12 tests to avoid redundant HTTP round-trips
- **Private helper `_torso()`:** Locates the BODY_SEGMENT node without repeating filter logic across range tests
- **Descriptive failure messages:** Every assertion includes `genome_id` and offending value for instant debugging

## [2026-05-14] - Stage 11: TDD for /api/evolve Endpoint

### Added
- **Tests:** `backend/tests/test_evolve.py` — 10 pytest tests for the `/api/evolve` endpoint
- **Status:** All 10 tests currently FAILING with 404 (endpoint not yet implemented — intentional TDD)

### Test Coverage
- HTTP contract: endpoint returns 200
- Population invariant: always returns exactly 20 genomes
- Generation counter: offspring have generation == 1
- ID integrity: offspring get fresh UUIDs, no aliasing, no collisions
- Response shape: species_info and stats fields present with correct sub-fields
- Selection pressure: champion's species survives via elitism (PRD §3.5)
- Physical validity: every offspring has at least one BODY_SEGMENT
- Robustness: mixed/zero/high fitness scores don't crash the endpoint

### Technical Decisions
- **Module-scoped fixtures:** genesis_genomes called once, evolve_payload and
  evolve_response derived from it — no redundant HTTP calls across 10 tests
- **Real genome IDs in payload:** uses actual IDs from /api/genesis to simulate
  the exact frontend→backend handshake
- **Selection pressure via species_id:** since fresh IDs are enforced,
  champion survival is verified through species_id persistence (PRD §3.5 elitism)

  ## [2026-05-14] - Stage 12: NEAT Evolution Engine + /api/evolve Endpoint

### Added
- **`backend/neat/innovation.py`** — InnovationTracker with monotonic counter,
  per-generation history reset, and split-node tracking so parallel mutations
  on the same synapse get consistent hidden node IDs
- **`backend/neat/species.py`** — compatibility_distance (NEAT δ formula with
  C1/C2/C3 from config), Species class with representative election.
  Species counter lives on Population to preserve species_id=0 continuity
  across genesis resets
- **`backend/neat/reproduction.py`** — All 9 mutation operators (mutate_weights,
  add_synapse, add_node_split, toggle_enable, add_limb, remove_limb,
  mutate_segment, mutate_joint, add_sensor) + crossover aligned by
  innovation_id. All values clamped before Pydantic validation
- **`backend/neat/population.py`** — Population orchestrator implementing the
  full 9-step PRD §3.4-3.5 loop: fitness assignment → speciation → adjusted
  fitness → 20% cull → proportional allocation → elitism → crossover/asexual
  → re-speciation → innovation reset. Padding loop guarantees exactly 20
  genomes returned
- **`backend/routers/evolution.py`** — POST /api/evolve endpoint with
  module-level Population instance persisting species history across requests
- **`backend/schemas/evolution.py`** — EvolveRequest, EvolveResponse,
  CreatureResult, EnvironmentConfig, SpeciesInfo, GenerationStats schemas
- **`backend/neat/config.py`** — All 24 NEAT constants from PRD §3.8

### Test Results
- 22/22 tests passing (12 genesis + 10 evolve)

### Technical Decisions
- **Idempotent generation field:** returned generation = request.generation + 1,
  not population.generation — makes the endpoint safe against duplicate calls
- **Module-level Population:** single global instance persists species history
  between HTTP requests without a database
- **Padding loop:** guarantees population size invariant of exactly 20 genomes
  even when proportional allocation rounds unevenly

  ## [2026-05-14] - Stage 13: Camera Follow System

### Added
- **Camera follow:** `PhysicsArena.tsx` render loop now tracks the leader
  (creature with highest torso X) every frame. Leader sits 25% from left
  edge giving visual space ahead per PRD §6.2
- **Wide ground line:** Ground spans `cameraX - 200` to `cameraX + W + 200`
  so it always fills the screen regardless of camera position
- **Leader highlight:** Leader creature gets a `#3b82f6` 2px stroke to
  distinguish it from the rest of the population

### Technical Decisions
- **Bounding-box rectangle approach:** replaced vertex-walk polygon with
  min/max scan over planck vertices to get exact pixel dimensions matching
  the genome's specified width/height
- **Reference equality for leader:** leader identity tracked by object
  reference not ID to avoid per-frame string lookups
- **Y-axis flip:** `-y * PIXELS_PER_METER` corrects planck Y-up to canvas
  Y-down coordinate system

## [2026-05-14] - Stage 14: Evolution Loop (The Core Game Loop)

### Added
- **`page.tsx`** — Full 15-second evolution loop implemented:
  - 100ms interval ticks elapsed time and updates countdown display
  - On completion: collects CreatureResult[] from SimulationEngine,
    POSTs to /api/evolve, advances generation via nextGeneration store action
  - generationRunning ref prevents double-firing on dep re-triggers
  - Loading screen shows until genesis data arrives
- **`PhysicsArena.tsx`** — onEngineReady prop added, called immediately
  after SimulationEngine instantiation so parent has engine reference
  before first physics tick
- **`api.ts`** — EvolveResponse updated to match real backend shape:
  genomes + stats (best_fitness, avg_fitness, species_count)

### Technical Decisions
- **100ms interval over rAF:** timer countdown is UI state, not physics
  state — 100ms polling is sufficient and avoids coupling the countdown
  to the physics frame rate
- **engineRef over state:** engine instance stored in ref not state to
  prevent re-renders from tearing down the physics world mid-simulation
- **getResults() fallback:** if engine not ready, sends zero-fitness
  scores so the backend still evolves rather than crashing

  ## [2026-05-14] - Stage 15: Evolution Loop Bug Fixes

### Fixed
- **`api.ts`** — POST /api/evolve body now includes required `environment`
  field (gravity: 1.0, friction: 0.6, terrain: "flat"). Was causing 422
  Unprocessable Entity rejection from backend
- **`SimulationLoop.ts`** — `head_ground_time` and `time_upright` accumulators
  now clamped to 15.0 seconds maximum. Were accumulating unbounded across
  ticks producing values of 101+ seconds
- **`SimulationLoop.ts`** — `getResults()` now returns `max_x_position`,
  `final_x`, `final_y` in raw planck metres instead of pixels. Backend
  fitness function expects metres not pixels

  ## [2026-05-14] - Stage 16: Fitness Calculation

### Added
- **`FitnessCalculator.ts`** — Implemented `calculateFitness` per PRD §4.5:
  - Primary reward: max X distance in planck metres
  - Upright bonus: up to 50 points (fraction of time torso above ground)
  - Energy penalty: up to 30 points (cumulative torque ratio)
  - Head touch penalty: 90% of distance score lost if torso on ground > 0.5s
- **`SimulationLoop.ts`** — `getResults()` now calls `calculateFitness` for
  each creature. Replaced `fitness: 0` placeholder with real computed value

### Impact
- Backend NEAT selection now has meaningful fitness signal to work with
- Evolution will begin directing toward forward locomotion rather than
  selecting randomly