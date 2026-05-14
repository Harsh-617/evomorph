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