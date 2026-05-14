import * as planck from 'planck';
import { ConnectionType, CreatureResult, Genome, NodeType, SensorType } from '../types/genome';
import { createPhysicsCreature, PhysicsCreature, PIXELS_PER_METER } from './CreatureBuilder';
import { evaluateNetwork } from './NeuralNetwork';

const GENERATION_TIME = 15;    // seconds
const MAX_MOTOR_SPEED = 10;    // rad/s — max speed the motor can drive a joint
const GROUND_THRESHOLD = 0.5; // metres; torso centre below this → "on ground"
const CREATURE_SPACING_M = 20; // metres between creature spawn points

interface CreatureState {
  genome: Genome;
  physics: PhysicsCreature;
  prevActivations: Map<number, number>;
  // fitness accumulators
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

  constructor(genomes: Genome[], gravityMultiplier: number, friction: number) {
    this._world = new planck.World(new planck.Vec2(0, -10 * gravityMultiplier));

    // Static ground plane extending far in both directions
    const ground = this._world.createBody();
    ground.createFixture(
      new planck.Edge(new planck.Vec2(-10000, 0), new planck.Vec2(10000, 0)),
      { friction },
    );

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

      this.creatures.push({
        genome,
        physics,
        prevActivations: new Map(),
        maxX: 0,
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
      const outputs = evaluateNetwork(creature.genome, sensors, creature.prevActivations);

      // ── 3. Actuate ────────────────────────────────────────────────────────
      let tickTorque = 0;
      for (const [nodeId, activation] of outputs) {
        const joint = creature.outputJointMap.get(nodeId);
        const maxTorque = creature.outputMaxTorqueMap.get(nodeId) ?? 200;
        if (joint) {
          joint.setMotorSpeed(activation * MAX_MOTOR_SPEED);
          tickTorque += Math.abs(activation) * maxTorque;
        }
      }

      // Carry all activations forward so recurrent synapses have values next tick
      creature.prevActivations = new Map([...sensors, ...outputs]);

      // ── 4. Fitness accumulators ───────────────────────────────────────────
      if (torsoPos.x > creature.maxX) creature.maxX = torsoPos.x;

      if (torsoPos.y < GROUND_THRESHOLD) {
        creature.headGroundTime += deltaTime;
      } else {
        creature.timeUpright += deltaTime;
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

  getResults(): CreatureResult[] {
    return this.creatures.map((creature) => {
      const torso = creature.physics.bodies.get(0);
      const finalPos = torso ? torso.getPosition() : { x: 0, y: 0 };

      return {
        genome_id: creature.genome.genome_id,
        fitness: 0, // computed by the Python backend from the other fields
        max_x_position: creature.maxX * PIXELS_PER_METER,
        time_upright: creature.timeUpright,
        cumulative_torque: creature.cumulativeTorque,
        head_ground_time: creature.headGroundTime,
        num_joints: creature.numJoints,
        max_torque: creature.maxTorque,
        final_x: finalPos.x * PIXELS_PER_METER,
        final_y: finalPos.y * PIXELS_PER_METER,
        alive: creature.alive,
      };
    });
  }
}
