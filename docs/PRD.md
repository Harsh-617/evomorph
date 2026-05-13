# EvoMorph — Product Requirements Document (PRD)

**Version:** 1.0
**Date:** May 13, 2026
**Target:** Shortcut Asia Internship Challenge 2026 [cite: 1]
**Submission Deadline:** 15 May 2026, 11:59pm [cite: 7]

---

## Table of Contents

1. [Product Definition](#1-product-definition)
2. [DNA & Morphology Engine](#2-dna--morphology-engine)
3. [Simulation Engine](#3-simulation-engine)
4. [God Mode (Environment Stress Tester)](#4-god-mode-environment-stress-tester)
5. [UI/UX Layout](#5-uiux-layout)
6. [Technical Architecture](#6-technical-architecture)
7. [Scope Boundaries](#7-scope-boundaries)

---

## 1. Product Definition

### 1.1 One-Liner
EvoMorph is a browser-based artificial life sandbox that uses a custom genetic algorithm to simultaneously co-evolve the morphology (bodies) and neural topologies (brains) of 2D creatures, letting users manipulate real-time physics to stress-test emergent locomotion strategies.

### 1.2 Why This Project
It demonstrates absolute mastery over complex browser performance (running a physics engine at 60 FPS), advanced machine learning (custom neuroevolution/NEAT algorithm from scratch), and real-time distributed state management. It stands out from standard apps by offering an unpredictable, mesmerizing AI simulation that aligns with Shortcut Asia's interest in AI-powered product features [cite: 21].

### 1.3 Primary User
**The Demo Judge / Technical Recruiter** — Needs to be instantly mesmerized within 3 seconds of the page loading. They need to understand the complexity of what is happening (AI learning physics) without having to read a manual. The interface follows the "user-centered solutions" encouraged by the challenge [cite: 151].

### 1.4 Core Loop
1. **The Genesis Drop:** The simulation initializes. 20 randomly generated creatures (chaotic arrays of limbs and joints) drop onto a flat terrain.
2. **The Flop & Filter:** Generation 1 thrashes wildly. A 15-second timer counts down. Most go nowhere; a few accidentally fall forward.
3. **The Purge:** At 0 seconds, the engine scores them based on distance traveled. The losers are culled.
4. **Emergence:** By Generation 20, distinct species emerge. Some drag themselves; others develop rhythmic crawling or jumping mechanics.
5. **The Stress Test:** The user drags the "Gravity" slider up, or toggles "Ice Terrain".
6. **Extinction & Adaptation:** The reigning champion strategies fail instantly. The user watches the genetic algorithm rapidly pivot to survive the new physics.
7. **Deep Inspection:** The user clicks any creature to open the "Organism DNA" panel, viewing its live neural network firing and its structural DAG.

---

## 2. DNA & Morphology Engine

### 2.1 Morphology DNA (The Body)
A directed acyclic graph (DAG) representing physical structure.
* **Nodes (Limbs):** Rigid bodies defined by `width`, `height`, `density`, and `friction`.
* **Edges (Joints):** Revolute joints connecting parent to child limbs, defined by `angle_limit_min`, `angle_limit_max`, and `max_motor_torque`.
* **Mutations:** 10% chance per generation to sprout a new limb, lose a limb, or mutate the size/density of an existing segment.

### 2.2 Neural DNA (The Brain)
A NEAT (NeuroEvolution of Augmenting Topologies) network that controls the body.
* **Inputs:** Array of current joint angles, raycast distance to the ground, and core body rotation.
* **Outputs:** Target motor speeds for every joint edge in the morphology DAG.
* **Mutations:** Adding hidden nodes, adding new synapse connections, or tweaking existing synapse weights.

---

## 3. Simulation Engine

### 3.1 The Tick Loop (Browser-Side)
To ensure 60 FPS, all physics calculations occur locally in the browser. 
1. **Read Sensors:** Every frame, read joint angles and raycasts from the physics engine.
2. **Think:** Pass sensor data through the creature's neural network.
3. **Actuate:** Apply the output values as torques to the physical joint motors.

### 3.2 The Fitness Function
At the end of the simulation window, every creature is evaluated:
`Fitness = (Max X Coordinate Reached) - (Energy Expended Penalty) - (Head-Touch Penalty)`
* **Energy Expended:** Penalizes creatures that violently flail limbs without moving efficiently.
* **Head-Touch:** Fatal penalty (score drops to 0) if the root node (torso) touches the ground, forcing the evolution of locomotion rather than falling.

---

## 4. God Mode (Environment Stress Tester)

### 4.1 Physics Sliders
* **Gravity:** Slider from `0.1x` to `3.0x`. High gravity forces the evolution of high-torque, stout limbs.
* **Friction:** Slider from `0.0` (Ice) to `1.0` (Rubber). Low friction completely destroys bipedal walkers, forcing crawling/dragging morphologies.

### 4.2 Terrain Generation
* **Flat:** The default genesis terrain.
* **Hurdles:** Spawns 10px high blocks every 50px. Creatures must evolve jumping or high-stepping mechanics.
* **Stairs:** Forces climbing morphologies, often resulting in hook-like front limbs and strong rear pushers.

---

## 5. UI/UX Layout

### 5.1 Spatial Arrangement
```text
┌──────────────────────────────────────────────────────────────────┐
│                           TOP BAR                                │
│  EvoMorph  | Generation: 42 | Best Fitness: 450 | [Play/Pause]   │
├──────────────────────────────────────────────┬───────────────────┤
│                                              │   RIGHT PANEL     │
│                                              │                   │
│         PHYSICS ARENA (HTML5 Canvas)         │ 🧠 Neural Inspect │
│         Camera follows the current leader    │ (Live SVG graph)  │
│                                              │                   │
│                                              ├───────────────────┤
│                                              │ ⚙️ God Mode      │
│                                              │ Gravity: ───●───  │
│                                              │ Terrain: [Ice]    │
└──────────────────────────────────────────────┴───────────────────┘
```

### 5.2 Visual Language
* **Dark Theme:** Slate background, neon accents.
* **Creatures:** Rendered as semi-transparent geometric shapes. The current "Leader" is highlighted in a glowing blue stroke.
* **Neural Inspector:** Real-time SVG graph showing node activation values.

---

## 6. Technical Architecture

### 6.1 Hybrid Asynchronous Architecture
* **Backend (FastAPI / Python):** The "Evolutionary Brain". Holds the NEAT algorithm and genome structures.
* **Frontend (Next.js / planck.js):** The "Physical Sandbox". Computes 2D physics and renders visuals. TypeScript is used for the frontend as recommended [cite: 110].
* **The Handshake:** The backend sends DNA payloads via REST. The frontend simulates them, calculates scores, and POSTs the numbers back for mutation.

### 6.2 Stack Overview
| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14 + TypeScript | UI rendering, state management |
| **Physics** | planck.js | 2D deterministic physics engine (Box2D port) |
| **State** | Zustand | Generation counters, slider states |
| **Visualizer**| React Flow / SVG | Real-time neural network rendering |
| **Backend** | FastAPI (Python) | API Gateway |
| **ML Engine** | Custom NEAT Implementation | Genetic algorithm, crossover, speciation |

---

## 7. Scope Boundaries

### 7.1 Explicitly IN Scope
* Fully autonomous co-evolution of 2D body DAGs and Neural Networks.
* Real-time 60 FPS physics rendering in the browser.
* Live SVG visualization of neural network activations.
* Interactive environmental controls (Gravity, Friction, Terrain).
* API-driven genetic generation.

### 7.2 Explicitly OUT of Scope
* **Authentication:** No login. Opens directly into the simulation.
* **Database Persistence:** The current evolutionary lineage is stored in backend memory.
* **User-Drawn Morphologies:** Users cannot manually draw their own creatures.
* **3D Rendering:** Strictly 2D physics and rendering.
