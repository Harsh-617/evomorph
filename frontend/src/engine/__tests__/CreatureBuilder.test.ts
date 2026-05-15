jest.mock('planck', () => {
  const mockJoint = {
    enableMotor: jest.fn(),
    setMaxMotorTorque: jest.fn(),
    setMotorSpeed: jest.fn(),
    getMotorSpeed: jest.fn().mockReturnValue(0),
    getJointAngle: jest.fn().mockReturnValue(0),
  };
  const mockBody = {
    getPosition: jest.fn().mockReturnValue({ x: 0, y: 0 }),
    getAngle: jest.fn().mockReturnValue(0),
    getAngularVelocity: jest.fn().mockReturnValue(0),
    createFixture: jest.fn(),
    setUserData: jest.fn(),
  };
  const mockWorld = {
    createBody: jest.fn().mockReturnValue(mockBody),
    createJoint: jest.fn().mockReturnValue(mockJoint),
  };
  return {
    World: jest.fn().mockReturnValue(mockWorld),
    Vec2: jest.fn().mockImplementation((x, y) => ({ x, y })),
    Box: jest.fn(),
    Edge: jest.fn(),
    RevoluteJoint: jest.fn(),
  };
});

import { createPhysicsCreature } from '../CreatureBuilder';
import { Genome, NodeType, ConnectionType, SensorType } from '@/types/genome';
import * as planck from 'planck';

function makeGenome(overrides: Partial<Genome> = {}): Genome {
  return {
    genome_id: 'test-creature-001',
    species_id: 0,
    generation: 0,
    fitness: 0,
    node_genes: [
      { gene_id: 0, type: NodeType.BODY_SEGMENT, width: 40, height: 15, density: 1.2, friction: 0.6 },
      { gene_id: 1, type: NodeType.INPUT, sensor_type: SensorType.BODY_ANGLE, attached_segment_id: 0 },
      { gene_id: 2, type: NodeType.INPUT, sensor_type: SensorType.GROUND_CONTACT, attached_segment_id: 0 },
      { gene_id: 3, type: NodeType.INPUT, sensor_type: SensorType.OSCILLATOR },
      { gene_id: 4, type: NodeType.BODY_SEGMENT, width: 25, height: 10, density: 1.0, friction: 0.8 },
      { gene_id: 5, type: NodeType.OUTPUT, attached_segment_id: 4 },
    ],
    connection_genes: [
      {
        innovation_id: 0,
        in_node: 0,
        out_node: 4,
        conn_type: ConnectionType.JOINT,
        enabled: true,
        angle_limit_min: -1.2,
        angle_limit_max: 1.2,
        max_motor_torque: 200,
      },
      {
        innovation_id: 1,
        in_node: 1,
        out_node: 5,
        conn_type: ConnectionType.SYNAPSE,
        enabled: true,
        weight: 0.8,
      },
    ],
    ...overrides,
  };
}

function makeWorld(): planck.World {
  return new planck.World() as unknown as planck.World;
}

describe('createPhysicsCreature', () => {
  test('test_creature_builder_returns_bodies_map', () => {
    const result = createPhysicsCreature(makeGenome(), makeWorld());
    expect(result.bodies).toBeInstanceOf(Map);
  });

  test('test_creature_builder_creates_body_for_each_segment', () => {
    const result = createPhysicsCreature(makeGenome(), makeWorld());
    // genome has 2 BODY_SEGMENT genes (gene_id 0 torso, gene_id 4 limb), both reachable via BFS
    expect(result.bodies.size).toBe(2);
  });

  test('test_creature_builder_torso_is_gene_id_0', () => {
    const result = createPhysicsCreature(makeGenome(), makeWorld());
    expect(result.bodies.has(0)).toBe(true);
  });

  test('test_creature_builder_returns_joints_map', () => {
    const result = createPhysicsCreature(makeGenome(), makeWorld());
    expect(result.joints).toBeInstanceOf(Map);
  });

  test('test_creature_builder_creates_joint_for_each_connection', () => {
    const result = createPhysicsCreature(makeGenome(), makeWorld());
    // 1 enabled JOINT connection gene (innovation_id 0); the SYNAPSE is not counted
    expect(result.joints.size).toBe(1);
  });

  test('test_creature_builder_throws_without_torso', () => {
    const genome = makeGenome({
      node_genes: [
        { gene_id: 1, type: NodeType.INPUT, sensor_type: SensorType.OSCILLATOR },
      ],
    });
    expect(() => createPhysicsCreature(genome, makeWorld())).toThrow(
      /gene_id 0/,
    );
  });

  test('test_creature_builder_ignores_disabled_joints', () => {
    const genome = makeGenome({
      connection_genes: [
        {
          innovation_id: 0,
          in_node: 0,
          out_node: 4,
          conn_type: ConnectionType.JOINT,
          enabled: false,
          angle_limit_min: -1.2,
          angle_limit_max: 1.2,
          max_motor_torque: 200,
        },
        {
          innovation_id: 1,
          in_node: 1,
          out_node: 5,
          conn_type: ConnectionType.SYNAPSE,
          enabled: true,
          weight: 0.8,
        },
      ],
    });
    const result = createPhysicsCreature(genome, makeWorld());
    expect(result.joints.size).toBe(0);
  });
});
