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

  ## [2026-05-14] - Stage 17: Fitness & Evolution Fixes

### Fixed
- **`SimulationLoop.ts`** — Fitness now measures displacement from spawn
  position not absolute X coordinate. Added `startX` field to CreatureState,
  initialized at frame 0. All 20 creatures now compete on equal terms
  regardless of spawn position
- **`population.py`** — `best_fitness`, `avg_fitness`, `fitness_std` in
  GenerationStats now computed from incoming CreatureResult scores (real
  simulated values) not from new offspring genomes (which are always 0.0
  before simulation)

### Impact
- Evolution now selects for actual locomotion ability not spawn position
- Best fitness display in top bar now shows real values
- NEAT selection pressure is correctly directed toward forward movement

## [2026-05-14] - Stage 18: Creature Spacing & Visual Polish

### Changed
- **`SimulationLoop.ts`** — Reduced creature spawn spacing from 20m to 3m
  (600px to 90px apart). All 20 creatures now visible on screen simultaneously
  showing population diversity across generations

  ## [2026-05-14] - Stage 19: God Mode Panel

### Added
- **`GodModePanel.tsx`** — Interactive environment controls per PRD §5.1:
  - Gravity slider (0.1x – 3.0x) with cyan value display
  - Friction slider (0.0 Ice – 1.0 Rubber) with cyan value display
  - Terrain selector (flat/hurdles/stairs/hills) as 2×2 button grid
  - Amber "⚡ Changes apply next generation" indicator when any value
    differs from defaults
- **`api.ts`** — `evolvePopulation` now accepts environment as third
  parameter. POST body sends real gravity/friction/terrain instead of
  hardcoded defaults
- **`page.tsx`** — Layout restructured into flex row: arena (flex-1)
  + right sidebar (w-80) containing GodModePanel

### Technical Decisions
- **Next-generation application:** Physics changes take effect when
  SimulationEngine is re-created at generation boundary, not mid-simulation.
  This ensures fair fitness comparison within a generation per PRD §5.1
- **Store-driven physics:** PhysicsArena already reads gravity/friction
  from Zustand store so engine re-creation on slider change was implicit

  ## [2026-05-14] - Stage 20: Neural Inspector

### Added
- **`NeuralInspector.tsx`** — Live SVG brain visualization per PRD §6.3:
  - `NetworkGraph` — INPUT/HIDDEN/OUTPUT column layout, edges colored
    blue/red by weight sign, node opacity pulses with activation value
  - `BodyDiagram` — BFS tree layout of body segments and joints,
    proportional to genome width/height values
  - `CreatureStats` — limb count, synapse count, species ID, generation
- **`SimulationLoop.ts`** — Added `getLeaderActivations()` and
  `getLeaderGenome()` exposing the highest-displacement creature's
  neural state each tick
- **`PhysicsArena.tsx`** — `onActivationsUpdate` prop with 10-frame
  throttle (~6 FPS) to feed live activations to inspector without
  impacting physics performance
- **`page.tsx`** — `inspectorData` state wired between PhysicsArena
  and NeuralInspector via `onActivationsUpdate` callback

### Technical Decisions
- **6 FPS throttle:** Inspector updates decoupled from 60 FPS physics
  loop. Visual neuron pulsing doesn't need frame-perfect accuracy
- **Ref-based callback:** `onActivationsUpdateRef` prevents stale
  closure captures without restarting the rAF loop on re-renders

  ## [2026-05-14] - Stage 21: Layout Fix + Terrain Physics

### Fixed
- **`page.tsx`** — Layout now uses `h-screen overflow-hidden` so arena
  fills full viewport with no scrolling required
- **`PhysicsArena.tsx`** — ResizeObserver uses `clientWidth/clientHeight`
  for accurate canvas sizing. Canvas wrapped in `w-full h-full` container

### Added
- **`SimulationLoop.ts`** — Real terrain obstacle generation per PRD §5.2:
  - Hurdles: 20 static boxes starting at x=65m past spawn cluster
  - Stairs: 30 ascending steps starting at x=65m, 0.4m rise per step
  - Hills: 100 sine-wave edge segments, 2m amplitude
- **`PhysicsArena.tsx`** — Terrain rendering, slate rectangles for
  hurdles/stairs, green edges for hills. Engine restarts on terrain change

## [2026-05-14] - Stage 22: Neural Inspector + God Mode Panel

### Added
- **`NeuralInspector.tsx`** — Live SVG brain visualization with NetworkGraph,
  BodyDiagram, and CreatureStats. Node opacity pulses with activation value
- **`GodModePanel.tsx`** — Gravity/friction sliders and terrain selector.
  Amber indicator when settings differ from defaults
- **`SimulationLoop.ts`** — `getLeaderActivations()` and `getLeaderGenome()`
  methods exposing highest-displacement creature's neural state
- **`PhysicsArena.tsx`** — `onActivationsUpdate` prop with 10-frame throttle
- **`api.ts`** — `evolvePopulation` accepts real environment parameters
- **`page.tsx`** — Right sidebar with NeuralInspector above GodModePanel

## [2026-05-14] - Stage 23: Leaderboard

### Added
- **`Leaderboard.tsx`** — Real-time fitness ranking of all 20 creatures
  per PRD §7.2. Each entry shows rank, fitness bar, score, and species
  color dot. Leader highlighted with cyan ring
- **`SimulationLoop.ts`** — `getLeaderboardData()` method sorts creatures
  by displacement and returns ranked entries with live fitness scores
- **`PhysicsArena.tsx`** — `onLeaderboardUpdate` prop, called every 10
  frames alongside activations update (shared throttle)
- **`page.tsx`** — `leaderboardData` state wired between PhysicsArena
  and Leaderboard component. Rendered below GodModePanel in sidebar

### Technical Decisions
- **Deterministic species color:** `hsl((species_id * 47) % 360, 70%, 60%)`
  gives visually distinct colors per species without a color registry
- **Shared 10-frame throttle:** Leaderboard and Neural Inspector both
  update at ~6 FPS to avoid UI thrashing while physics runs at 60 FPS

  ## [2026-05-14] - Stage 24: Leaderboard Fix + God Mode Stability

### Fixed
- **`PhysicsArena.tsx`** — Removed `gravity`, `friction`, `terrain` from
  SimulationEngine useEffect dependency array. Engine now only restarts
  at generation boundaries when `population` changes, not when God Mode
  sliders are adjusted. Physics changes correctly apply next generation
  without destroying current simulation state

### Behavior Confirmed Correct
- Leaderboard scores increase during simulation as creatures move
- Leaderboard resets to 0 at generation boundary when new creatures spawn
- God Mode slider changes no longer reset leaderboard mid-generation

## [2026-05-14] - Stage 25: Motor Fix + NEAT Evolution Fix

### Fixed
- **`SimulationLoop.ts`** — Added `enableMotor(true)` and
  `setMaxMotorTorque()` calls every tick. Motors were receiving speed
  commands but joints weren't responding without explicit enable
- **`PhysicsArena.tsx`** — Leader selection now uses displacement
  (maxX - startX) not absolute X. Camera no longer locks onto the
  rightmost-spawned stationary creature
- **`reproduction.py`** — New limbs now immediately get a wired synapse
  on the same mutation step. Fixes chicken-and-egg problem where limbs
  existed but had no neural control for many generations
- **`evolution.py`** — Genesis creatures now start with 1 limb + 1
  synapse pre-wired so evolution has something to work with from Gen 0
- **`config.py`** — Increased ADD_LIMB_RATE to 0.15, ADD_SYNAPSE_RATE
  to 0.20, MUTATE_WEIGHT_RATE to 0.90
- **`test_genesis.py`** — Updated tests to match new genesis format
  (2 body segments, 1 joint + 1 synapse)

### Impact
- Creatures now visibly move and flail from Generation 1
- Camera correctly tracks the creature that has traveled furthest
- Evolution has meaningful fitness signal to select toward locomotion

## [2026-05-14] - Stage 26: Evolution Tuning

### Fixed
- **`FitnessCalculator.ts`** — Upright bonus reduced from 50 to 10 points.
  Distance is now the dominant fitness signal. Creatures can no longer
  score ~50 by standing still
- **`config.py`** — SPECIES_THRESHOLD lowered from 3.0 to 1.5. More
  species form, protecting morphological innovation from being eliminated
  by the dominant body plan
- **`config.py`** — SURVIVAL_RATE reduced from 0.80 to 0.60. More
  aggressive culling creates stronger selection pressure toward
  forward locomotion

### Impact
- Population should stop premature convergence on the L-shape body plan
- Best fitness should climb past 51 as distance becomes the primary reward
- Multiple species should appear in the leaderboard species colors

## [2026-05-14] - Stage 27: Full System Audit + 8 Bug Fixes

### Fixed (from full pipeline audit)
- **Bug 1 `FitnessCalculator.ts`** — CRITICAL: Replaced 90% proportional
  head-touch penalty with flat `headTouchFraction * 5.0`. Previous penalty
  was erasing 90% of displacement for any flat-torso creature, causing
  fitness plateau at ~13m. Upright bonus restored to 25
- **Bug 2 `population.py` + `evolution.py`** — HIGH: species_info now built
  from `_last_scored_species` snapshot taken after adjusted fitness but
  before culling. Previously built from offspring (all fitness=0.0)
- **Bug 3 `NeuralNetwork.ts` + `SimulationLoop.ts`** — HIGH: evaluateNetwork
  now returns `{outputs, allActivations}`. prevActivations stores all node
  activations including hidden nodes. Recurrent connections through hidden
  layers now work correctly
- **Bug 4 `population.py`** — MEDIUM: sp.age no longer incremented inside
  speciate(). Now incremented exactly once per generation in evolve()
- **Bug 5 `evolution.py` + `innovation.py`** — MEDIUM: Genesis innovation
  IDs now unique per genome (joint=i, synapse=i+20). InnovationTracker
  starts at 40 to avoid collision with genesis IDs. Previously all 20
  genomes shared innovation_id=1 for their synapse
- **Bug 6 `species.py`** — MEDIUM: assign_representative now selects
  champion (highest fitness) not random member. Eliminates species
  flickering caused by atypical boundary representatives
- **Bug 7 `population.py`** — MEDIUM: Representatives elected from
  post-cull survivors before offspring production. Previously used
  pre-cull representatives that may have been eliminated
- **Bug 9 `reproduction.py`** — LOW: New limb's proprioceptive joint-angle
  sensor now immediately wired to its motor. Previously dangling

### Test Results
- 22/22 passing after all fixes

## [2026-05-15] - Stage 28: Fitness Function Overhaul

### Changed
- **`FitnessCalculator.ts`** — Complete rewrite. Distance is now the
  overwhelming signal: `distanceScore = maxX * 5`. Upright bonus removed
  entirely — stationary creatures now score 0. Small efficiency bonus
  (max 10 points) replaces head touch penalty. This broke the fitness
  plateau at 25 points where upright bonus was masking real locomotion
- **`SimulationLoop.ts`** — Removed timeUpright/headGroundTime from
  calculateFitness call sites. Removed debug console.table block
- **`routers/evolution.py`** — Removed diagnostic print statements

### Impact
- Best fitness now climbs proportionally to actual movement
- Creatures complexifying to 4 limbs, 6 synapses by Gen 13
  vs previously 1 limb, 1 synapse at Gen 35
- Score variance between generations is expected NEAT behavior

## [2026-05-15] - Stage 29: Phylogeny Timeline + UI Polish

### Added
- **`PhylogenyTimeline.tsx`** — Fitness curve at the bottom of the screen
  using recharts ComposedChart. Area chart for avg fitness, line for best
  fitness. Tooltip shows generation, avg fitness, best fitness on hover
- **`simulationStore.ts`** — Added `history: GenerationRecord[]` state and
  `addHistoryRecord` action to accumulate per-generation stats
- **`page.tsx`** — Timeline strip (h-40) below main content area. Calls
  `addHistoryRecord` after each successful evolvePopulation

### Fixed
- **`NeuralInspector.tsx`** — "Species" label renamed to "Species ID" to
  clarify it shows the leader's species membership not total species count
- **`page.tsx` + `PhylogenyTimeline.tsx`** — Timeline height increased to
  h-40 for better visibility
- **`page.tsx`** — Added `min-h-0` to sidebar to eliminate scrollbar overflow

## [2026-05-15] - Stage 30: Top Bar Controls

### Added
- **`page.tsx`** — All-time record display in amber in top bar. Persists
  across generations via Zustand persist middleware
- **`page.tsx`** — Speed multiplier buttons (1x/2x/5x) in top bar. Active
  speed highlighted in cyan. Wired to simulationSpeed store state which
  PhysicsArena already reads via speedRef
- **`page.tsx`** — New Population button. Stops current generation, resets
  timer, fetches fresh genesis, zeros generation/bestFitness/history
- **`simulationStore.ts`** — Added `setSimulationSpeed` action

## [2026-05-15] - Stage 31: Frontend Engine Tests

### Added
- **`FitnessCalculator.test.ts`** — 7 tests covering: stationary creature,
  distance multiplier, monotonicity, efficiency bonus cap, non-negative
  floor, multi-joint scaling
- **`NeuralNetwork.test.ts`** — 7 tests covering: connected network output,
  disabled synapse, weight sign inversion, zero input, allActivations
  return, empty synapse list, weight magnitude/tanh saturation
- **`tsconfig.jest.json`** — Jest-specific TS config overriding Next.js
  module settings (esnext/bundler) to commonjs/node for ts-jest
  compatibility
- **`package.json`** — Added jest, @types/jest, ts-jest dev dependencies
  and test script

### Test Results
- 14/14 frontend tests passing
- 22/22 backend tests passing
- 36/36 total tests passing across the project

## [2026-05-15] - Stage 32: Technical Documentation

### Added
- **`docs/architecture.md`** — Comprehensive technical architecture document
  covering system overview, frontend/backend architecture, API contract,
  NEAT algorithm explanation, fitness function, and key engineering decisions
- **`README.md`** — Updated with demo link placeholder, stack table, local
  setup instructions, project structure, how it works section, and NEAT
  reference citation

  ## [2026-05-15] - Stage 33: Speed Multiplier Fix

### Fixed
- **`page.tsx`** — Generation timer now scales with simulationSpeed.
  Previously elapsed always accumulated 0.1s per 100ms tick regardless
  of speed. At 5x, timer now reaches 15s in 3 real seconds
- **`page.tsx`** — Added `simulationSpeedRef` to fix stale closure issue.
  Speed changes mid-generation now take effect immediately on the next
  interval tick rather than waiting for the next generation

  ## [2026-05-15] - Stage 34: CreatureBuilder Tests

### Added
- **`CreatureBuilder.test.ts`** — 7 Jest tests covering: bodies Map return,
  body count per BODY_SEGMENT, torso at gene_id 0, joints Map return,
  joint count per enabled JOINT gene, throws without torso, ignores
  disabled joints
- **Mock strategy:** planck.js fully mocked at module level so tests run
  in Node.js without a browser environment. Vec2 implemented as plain
  {x,y} object to support BFS anchor arithmetic in CreatureBuilder

### Test Results
- 7/7 CreatureBuilder tests passing
- 21/21 total frontend tests passing
- 22/22 backend tests passing
- 43/43 total tests passing across the project

## [2026-05-15] - Stage 35: Leaderboard Species Colors

### Fixed
- **`Leaderboard.tsx`** — Species color now uses golden ratio distribution
  `hsl((species_id * 0.618...) % 1 * 360)` instead of `species_id * 47 % 360`.
  Low species IDs (0-5) now spread across the full hue spectrum instead
  of clustering near red. Leader entry slightly brighter (lightness 70
  vs 55). Rank number styling improved

  ## [2026-05-15] - Stage 36: Phylogeny & Leaderboard Polish

### Added
- **`PhylogenyTimeline.tsx`** — Species count bars below fitness curve
  (hidden Y-axis to avoid clutter). Environment change markers as amber
  dashed vertical ReferenceLine when gravity/friction/terrain changes
  between generations
- **`simulationStore.ts`** — GenerationRecord now includes environment
  snapshot (gravity/friction/terrain) for change detection
- **`page.tsx`** — addHistoryRecord now passes current environment

### Fixed
- **`Leaderboard.tsx`** — Golden ratio species colors. Leader entry
  brighter (lightness 70 vs 55). Rank number styling improved
- **`PhylogenyTimeline.tsx`** — Removed visible species Y-axis labels
  that were cluttering the right side of the timeline
- **`SimulationLoop.ts`** — Hurdles now start at x=8m, stairs at x=10m.
  Terrain obstacles now appear where creatures actually travel

  ## [2026-05-15] - Stage 37: Population Size Reduction + Config Fix

### Changed
- **`config.py`** — POPULATION_SIZE reduced from 20 to 8. Fewer creatures
  means less visual chaos, more readable simulation, individual body plans
  clearly visible
- **`SimulationLoop.ts`** — Creature spacing increased from 3m to 5m.
  8 creatures × 5m = 40m spread, no overlap or collision at spawn
- **`routers/evolution.py`** — Removed hardcoded `_POPULATION_SIZE = 20`.
  Now reads from `neat_config.POPULATION_SIZE` — single source of truth
- **`test_genesis.py` + `test_evolve.py`** — Updated all assertions from
  20 to 8 to match new population size

### Test Results
- 22/22 backend tests passing
- 21/21 frontend tests passing
- 43/43 total tests passing

## [2026-05-15] - Stage 38: Code Quality — Critical Fixes

### Fixed (Critical)
- **`routers/evolution.py`** — Removed 3 debug print() statements and
  synapse_counts_diag dead variable that fired on every /api/evolve request.
  Removed now-unused `import statistics`
- **`population.py`** — Fixed stale docstring "20 new genome dicts" →
  "POPULATION_SIZE new genome dicts"
- **`routers/evolution.py`** — Fixed stale genesis() docstring "20 minimal
  genomes" → "POPULATION_SIZE minimal genomes"
- **`MotorController.ts` + `SensorReader.ts`** — Deleted empty stub files.
  All logic lives in SimulationLoop.ts. No imports existed
- **`backend/fitness/evaluator.py`** — Deleted empty misleading module and
  fitness/ directory
- **`backend/config.py`** — Deleted empty top-level config stub. Real config
  is backend/neat/config.py

### Test Results
- 22/22 backend tests passing

## [2026-05-15] - Stage 39: Code Quality — Medium Fixes (M1-M9)

### Fixed (Medium)
- **`species.py`** — Removed unused `import random`
- **`reproduction.py`** — Removed unused `from typing import Optional`
- **`population.py`** — Fixed `environment: object` → `environment: EnvironmentConfig`
  with proper import from schemas.evolution
- **`config.py`** — Added `WEIGHT_PERTURB_PROBABILITY = 0.9` and
  `WEIGHT_PERTURB_SIGMA = 0.5` named constants
- **`reproduction.py`** — Replaced magic numbers 0.9/0.5 in `_mutate_weights`
  with config constants. Replaced hardcoded midpoint fallbacks in
  `_mutate_segment` and `_mutate_joint` with computed range midpoints
- **`innovation.py`** — Added comment explaining why counter starts at 40
  (avoids collision with genesis IDs 0-7 for joints, 20-27 for synapses)
- **`evolution.py`** — Replaced `i + 20` with `i + neat_config.POPULATION_SIZE`
  so synapse offset stays correct if population size changes

### Test Results
- 22/22 backend tests passing

## [2026-05-15] - Stage 40: Code Quality — Medium Fixes (M10-M17)

### Fixed (Medium)
- **`reproduction.py`** — Added one-line docstrings to all 7 private
  mutation functions: _mutate_weights, _add_synapse, _add_node_split,
  _toggle_enable, _mutate_segment, _mutate_joint, _add_sensor
- **`population.py`** — Added docstring to _tournament_select
- **`species.py`** — Added docstring to _conn_diff explaining normalization
- **`api.ts`** — Expanded EvolveResponse interface to include all backend
  fields: species_info array, fitness_std, avg/most_complex_body,
  avg_neural_complexity
- **`SimulationLoop.ts`** — Exported GENERATION_TIME as single source of truth
- **`FitnessCalculator.ts`** — Removed duplicate GENERATION_TIME, now
  imports from SimulationLoop
- **`Leaderboard.tsx`** — Renamed inner component LeaderboardEntry →
  LeaderboardEntryRow to fix name collision with exported interface
- **`simulationStore.ts`** — terrain type narrowed from string to
  'flat' | 'hurdles' | 'stairs' | 'hills' union type
- **`page.tsx`** — Fixed stale closure in evolution loop by reading all
  store values via getState() inside interval callback

### Test Results
- 22/22 backend tests passing
- 21/21 frontend tests passing
- 43/43 total passing

## [2026-05-15] - Stage 41: Code Quality — Low Fixes (L1-L8)

### Fixed (Low)
- **`config.py`** — Removed inline changelog comment from SURVIVAL_RATE.
  Git history is the right place for this
- **`reproduction.py`** — Added docstring to _add_limb describing what
  it creates (segment, joint, motor neuron, sensor, initial synapse)
- **`Leaderboard.tsx`** — Moved GOLDEN_RATIO and SPECIES_COLOR_SATURATION
  to module-level constants. No longer recalculated on every render
- **`PhysicsArena.tsx`** — Added comment explaining 100m threshold for
  ground edge filter. Added warning above planck internal field interfaces
- **`api.ts` + `page.tsx`** — Prefixed all console.error calls with
  [EvoMorph] for clear identification in production browser consoles
- **Backend files** — Replaced all `List[X]` with native `list[X]`
  (Python 3.9+ syntax) across population.py, species.py, reproduction.py,
  evolution.py, schemas/genome.py, schemas/evolution.py. Removed now-unused
  `from typing import List` imports

### Test Results
- 22/22 backend tests passing
- 21/21 frontend tests passing
- 43/43 total passing

## [2026-05-15] - Stage 42: UI Redesign — Foundation

### Changed
- **`layout.tsx`** — Replaced Geist fonts with IBM Plex Mono + IBM Plex Sans.
  Updated metadata title to "EvoMorph"
- **`globals.css`** — Complete replacement with scientific instrument design
  system: dark base tokens (#0d1117), cyan accent (#00d4ff), green (#00ff88),
  scanline overlay class, custom scrollbar, IBM Plex font stack variables
- **`page.tsx`** — Complete layout redesign: full-screen arena as hero,
  minimal HUD top bar (h-10), left panel for neural inspector (w-56),
  right panel for god mode + leaderboard (w-52), bottom timeline strip (h-32).
  Loading screen redesigned with terminal aesthetic
- **`PhysicsArena.tsx`** — Ground anchor moved to 70% canvas height.
  Arena div positioned between top bar and timeline strip (top:40px, bottom:128px).
  Ground line updated to #00ff88 at 1.5px width
- **`NeuralInspector.tsx`** — Removed card wrapper, transparent background,
  1px #21262d borders, IBM Plex Mono labels, compact stats grid
- **`globals.d.ts`** — Added CSS module declaration to suppress TS warning

## [2026-05-15] - Stage 43: Neural Inspector Redesign + Expand Modal

### Changed
- **`NeuralInspector.tsx`** — Complete redesign:
  - Small panel: transparent background, 1px borders, IBM Plex Mono,
    compact stats grid, BodyDiagram removed (moved to modal only)
  - Added clickable header with "⤢ expand" badge
  - Expanded modal: full network graph (500×300, nodeR=14, font 11px),
    body structure diagram (500×150), 4-column stats row pinned at bottom
  - Modal constrained to arena space (top:40px, bottom:128px) so it never
    overlaps top bar or timeline strip
  - Header and stats row are flex-shrink-0, middle content scrolls
- **`PhysicsArena.tsx`** — Ground anchor at 70% canvas height
- **`page.tsx`** — Arena div positioned top:40px bottom:128px

## [2026-05-15] - Stage 44: God Mode + Leaderboard Redesign

### Changed
- **`GodModePanel.tsx`** — Complete redesign: sharp 1px borders, no rounded
  corners, IBM Plex Mono labels, cyan accent sliders, terrain buttons with
  inline border/color styles, amber bordered "⚡ NEXT GENERATION" indicator
- **`Leaderboard.tsx`** — Complete redesign: inlined LeaderboardEntryRow,
  4px bar height with #1c2128 track, 1px row dividers, leader row subtle
  cyan background, species colors via golden ratio
- **`PhylogenyTimeline.tsx`** — Species count bar opacity reduced from
  0.6 to 0.2 so fitness curve is the dominant visual