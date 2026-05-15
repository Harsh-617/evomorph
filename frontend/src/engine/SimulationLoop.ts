import * as planck from 'planck';
import { ConnectionType, CreatureResult, Genome, NodeType, SensorType } from '../types/genome';
import { createPhysicsCreature, PhysicsCreature, PIXELS_PER_METER } from './CreatureBuilder';
import { calculateFitness } from './FitnessCalculator';
import { evaluateNetwork } from './NeuralNetwork';

const GENERATION_TIME = 15;    // seconds
const MAX_MOTOR_SPEED = 10;    // rad/s — max speed the motor can drive a joint
const GROUND_THRESHOLD = 0.5; // metres; torso centre below this → "on ground"
const CREATURE_SPACING_M = 5; // 5 metres apart × 8 creatures = 40m spread

interface CreatureState {
  genome: Genome;
  physics: PhysicsCreature;
  prevActivations: Map<number, number>;
  // fitness accumulators
  startX: number;
  maxX: number;
  timeUpright: number;
  cumulativeTorque: number;
  headGroundTime: number;
  alive: boolean;
  // precomputed mappings (built once in constructor)
  outputJointMap: Map<number, planck.RevoluteJoint>;    // OUTPUT gene_id → joint
  outputMaxTorqueMap: Map<number, number>;               // OUTPUT gene_id → max_motor_torque
  inputJointMap: Map<number, planck.RevoluteJoint>;     // INPUT gene_id → joint (JOINT_ANGLE sensors)
  numJoints: number;
  maxTorque: number;
}

export class SimulationEngine {
  private _world: planck.World;
  private creatures: CreatureState[] = [];
  private time = 0;
  private frameCount = 0;

  constructor(genomes: Genome[], gravityMultiplier: number, friction: number, terrain: string = 'flat') {
    this._world = new planck.World(new planck.Vec2(0, -10 * gravityMultiplier));

    // Static ground plane extending far in both directions
    const ground = this._world.createBody();
    ground.createFixture(
      new planck.Edge(new planck.Vec2(-10000, 0), new planck.Vec2(10000, 0)),
      { friction },
    );

    if (terrain === 'hurdles') {
      for (let i = 1; i <= 20; i++) {
        const hurdleX = 8 + i * 2.0;
        const hurdleBody = this._world.createBody({ type: 'static', position: planck.Vec2(hurdleX, 0) });
        hurdleBody.createFixture({
          shape: planck.Box(0.25, 0.33),
          friction: friction,
        });
      }
    }

    if (terrain === 'stairs') {
      for (let i = 0; i < 30; i++) {
        const stepX = 10 + i * 1.5;
        const stepY = i * 0.4;
        const stepBody = this._world.createBody({ type: 'static', position: planck.Vec2(stepX, stepY) });
        stepBody.createFixture({
          shape: planck.Box(1.0, 0.25),
          friction: friction,
        });
      }
    }

    if (terrain === 'hills') {
      const segments = 100;
      for (let i = 0; i < segments; i++) {
        const x1 = i * 0.5;
        const x2 = (i + 1) * 0.5;
        const y1 = Math.sin(x1 * 0.3) * 2.0;
        const y2 = Math.sin(x2 * 0.3) * 2.0;
        const hillBody = this._world.createBody({ type: 'static' });
        hillBody.createFixture({
          shape: planck.Edge(planck.Vec2(x1, y1), planck.Vec2(x2, y2)),
          friction: friction,
        });
      }
    }

    for (let i = 0; i < genomes.length; i++) {
      const genome = genomes[i];
      const startXPx = i * CREATURE_SPACING_M * PIXELS_PER_METER;
      const physics = createPhysicsCreature(genome, this._world, startXPx);

      // ── Build segment_id → joint info map ──────────────────────────────
      const jointGenes = genome.connection_genes.filter(
        (g) => g.conn_type === ConnectionType.JOINT && g.enabled,
      );
      const segToJoint = new Map<number, { innovId: number; maxTorque: number }>();
      for (const jg of jointGenes) {
        segToJoint.set(jg.out_node, {
          innovId: jg.innovation_id,
          maxTorque: jg.max_motor_torque ?? 200,
        });
      }

      // ── Wire OUTPUT nodes → RevoluteJoints ─────────────────────────────
      const outputJointMap = new Map<number, planck.RevoluteJoint>();
      const outputMaxTorqueMap = new Map<number, number>();
      const inputJointMap = new Map<number, planck.RevoluteJoint>();

      for (const node of genome.node_genes) {
        if (node.attached_segment_id == null) continue;
        const jInfo = segToJoint.get(node.attached_segment_id);
        if (!jInfo) continue;
        const joint = physics.joints.get(jInfo.innovId);
        if (!joint) continue;

        if (node.type === NodeType.OUTPUT) {
          outputJointMap.set(node.gene_id, joint);
          outputMaxTorqueMap.set(node.gene_id, jInfo.maxTorque);
        } else if (node.type === NodeType.INPUT && node.sensor_type === SensorType.JOINT_ANGLE) {
          inputJointMap.set(node.gene_id, joint);
        }
      }

      const numJoints = jointGenes.length;
      const maxTorque = jointGenes.reduce(
        (acc, jg) => Math.max(acc, jg.max_motor_torque ?? 200),
        0,
      );

      const torso0 = physics.bodies.get(0);
      const startX = torso0 ? torso0.getPosition().x : i * CREATURE_SPACING_M;

      this.creatures.push({
        genome,
        physics,
        prevActivations: new Map(),
        startX,
        maxX: startX,
        timeUpright: 0,
        cumulativeTorque: 0,
        headGroundTime: 0,
        alive: true,
        outputJointMap,
        outputMaxTorqueMap,
        inputJointMap,
        numJoints,
        maxTorque,
      });
    }
  }

  tick(deltaTime: number): void {
    this.frameCount++;
    this.time += deltaTime;

    for (const creature of this.creatures) {
      if (!creature.alive) continue;

      const torso = creature.physics.bodies.get(0);
      if (!torso) continue;

      const torsoPos = torso.getPosition();
      const torsoAngle = torso.getAngle();
      const torsoAngVel = torso.getAngularVelocity();

      // ── 1. Read sensors ───────────────────────────────────────────────────
      const sensors = new Map<number, number>();
      for (const node of creature.genome.node_genes) {
        if (node.type !== NodeType.INPUT) continue;
        let value = 0;
        switch (node.sensor_type) {
          case SensorType.JOINT_ANGLE: {
            const joint = creature.inputJointMap.get(node.gene_id);
            value = joint ? joint.getJointAngle() : 0;
            break;
          }
          case SensorType.BODY_ANGLE:
            value = torsoAngle;
            break;
          case SensorType.ANGULAR_VELOCITY:
            value = torsoAngVel;
            break;
          case SensorType.GROUND_CONTACT: {
            // Check the attached segment; fall back to torso (gene_id 0)
            const segId = node.attached_segment_id ?? 0;
            const segBody = creature.physics.bodies.get(segId);
            value = segBody && segBody.getPosition().y < GROUND_THRESHOLD ? 1 : 0;
            break;
          }
          case SensorType.OSCILLATOR:
            value = Math.sin(this.time);
            break;
        }
        sensors.set(node.gene_id, value);
      }

      // ── 2. Think ──────────────────────────────────────────────────────────
      const { outputs, allActivations } = evaluateNetwork(creature.genome, sensors, creature.prevActivations);

      // ── 3. Actuate ────────────────────────────────────────────────────────
      let tickTorque = 0;
      for (const [nodeId, activation] of outputs) {
        const joint = creature.outputJointMap.get(nodeId);
        const maxTorque = creature.outputMaxTorqueMap.get(nodeId) ?? 200;
        if (joint) {
          joint.enableMotor(true);
          joint.setMaxMotorTorque(maxTorque);
          joint.setMotorSpeed(activation * MAX_MOTOR_SPEED);
          tickTorque += Math.abs(activation) * maxTorque;
        }
      }

      // Carry all activations forward so recurrent synapses have values next tick
      creature.prevActivations = allActivations;

      // ── 4. Fitness accumulators ───────────────────────────────────────────
      if (torsoPos.x > creature.maxX) creature.maxX = torsoPos.x;

      if (torsoPos.y < GROUND_THRESHOLD) {
        creature.headGroundTime += deltaTime;
        creature.headGroundTime = Math.min(creature.headGroundTime, 15.0);
      } else {
        creature.timeUpright += deltaTime;
        creature.timeUpright = Math.min(creature.timeUpright, 15.0);
      }

      creature.cumulativeTorque += tickTorque;
    }

    // ── 5. Advance physics ─────────────────────────────────────────────────
    this._world.step(1 / 60);

  }

  isTimeUp(): boolean {
    return this.time >= GENERATION_TIME;
  }

  get simulationTime(): number {
    return this.time;
  }

  get world(): planck.World {
    return this._world;
  }

  /** Expose physics creatures so the canvas renderer can read body positions. */
  getPhysicsCreatures(): PhysicsCreature[] {
    return this.creatures.map((c) => c.physics);
  }

  private getLeaderCreature(): CreatureState | null {
    let leader: CreatureState | null = null;
    let best = -Infinity;
    for (const c of this.creatures) {
      const displacement = c.maxX - c.startX;
      if (displacement > best) { best = displacement; leader = c; }
    }
    return leader;
  }

  getLeaderActivations(): Map<number, number> {
    const leader = this.getLeaderCreature();
    return leader ? new Map(leader.prevActivations) : new Map();
  }

  getLeaderGenome(): Genome | null {
    return this.getLeaderCreature()?.genome ?? null;
  }

  getLeaderboardData(): Array<{ genome_id: string; rank: number; fitness: number; species_id: number; isLeader: boolean }> {
    const sorted = [...this.creatures]
      .sort((a, b) => (b.maxX - b.startX) - (a.maxX - a.startX));
    return sorted.map((creature, i) => ({
      genome_id: creature.genome.genome_id,
      rank: i + 1,
      fitness: calculateFitness({
        maxX: creature.maxX - creature.startX,
        cumulativeTorque: creature.cumulativeTorque,
        numJoints: creature.numJoints,
        maxTorque: creature.maxTorque,
      }),
      species_id: creature.genome.species_id,
      isLeader: i === 0,
    }));
  }

  getResults(): CreatureResult[] {
    return this.creatures.map((creature) => {
      const torso = creature.physics.bodies.get(0);
      const finalPos = torso ? torso.getPosition() : { x: 0, y: 0 };

      const displacement = creature.maxX - creature.startX;

      const fitness = calculateFitness({
        maxX: displacement,
        cumulativeTorque: creature.cumulativeTorque,
        numJoints: creature.numJoints,
        maxTorque: creature.maxTorque,
      });

      return {
        genome_id: creature.genome.genome_id,
        fitness,
        max_x_position: displacement,
        time_upright: creature.timeUpright,
        cumulative_torque: creature.cumulativeTorque,
        head_ground_time: creature.headGroundTime,
        num_joints: creature.numJoints,
        max_torque: creature.maxTorque,
        final_x: finalPos.x,
        final_y: finalPos.y,
        alive: creature.alive,
      };
    });
  }
}
