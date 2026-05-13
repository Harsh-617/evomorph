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