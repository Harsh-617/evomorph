import { evaluateNetwork } from '../NeuralNetwork';
import { ConnectionType, Genome, NodeType, SensorType } from '@/types/genome';

function makeGenome(overrides: Partial<Genome> = {}): Genome {
  return {
    genome_id: 'test-001',
    species_id: 0,
    generation: 0,
    fitness: 0,
    node_genes: [
      { gene_id: 0, type: NodeType.BODY_SEGMENT, width: 30, height: 15, density: 1, friction: 0.6 },
      { gene_id: 1, type: NodeType.INPUT, sensor_type: SensorType.OSCILLATOR, attached_segment_id: 0 },
      { gene_id: 2, type: NodeType.OUTPUT, attached_segment_id: 0 },
    ],
    connection_genes: [
      { innovation_id: 0, in_node: 1, out_node: 2, conn_type: ConnectionType.SYNAPSE, enabled: true, weight: 1.0 },
    ],
    ...overrides,
  };
}

describe('evaluateNetwork', () => {
  // ─── Basic forward pass ──────────────────────────────────────────────────────

  test('returns output activation for a connected network', () => {
    const genome = makeGenome();
    const sensors = new Map([[1, 0.5]]);
    const prev    = new Map<number, number>();
    const { outputs } = evaluateNetwork(genome, sensors, prev);
    // input 1 → synapse weight 1.0 → tanh(0.5) ≈ 0.4621
    expect(outputs.has(2)).toBe(true);
    expect(outputs.get(2)).not.toBe(0);
    expect(outputs.get(2)!).toBeCloseTo(Math.tanh(0.5), 5);
  });

  // ─── Disabled synapse ────────────────────────────────────────────────────────

  test('disabled synapse produces zero output', () => {
    const genome = makeGenome();
    genome.connection_genes[0].enabled = false;
    const sensors = new Map([[1, 1.0]]);
    const prev    = new Map<number, number>();
    const { outputs } = evaluateNetwork(genome, sensors, prev);
    expect(outputs.get(2)).toBe(0);
  });

  // ─── Weight sign ─────────────────────────────────────────────────────────────

  test('negative weight inverts activation sign', () => {
    const positive = makeGenome();
    positive.connection_genes[0].weight = 2.0;
    const negative = makeGenome();
    negative.connection_genes[0].weight = -2.0;

    const sensors = new Map([[1, 1.0]]);
    const prev    = new Map<number, number>();

    const posOut = evaluateNetwork(positive, sensors, prev).outputs.get(2) ?? 0;
    const negOut = evaluateNetwork(negative, sensors, prev).outputs.get(2) ?? 0;

    expect(posOut).toBeGreaterThan(0);
    expect(negOut).toBeLessThan(0);
  });

  // ─── Zero input ──────────────────────────────────────────────────────────────

  test('zero sensor input produces zero output via tanh', () => {
    const genome  = makeGenome();
    const sensors = new Map([[1, 0.0]]);
    const prev    = new Map<number, number>();
    const { outputs } = evaluateNetwork(genome, sensors, prev);
    expect(outputs.get(2)).toBeCloseTo(0, 5);
  });

  // ─── allActivations ──────────────────────────────────────────────────────────

  test('allActivations includes input node values from sensorValues', () => {
    const genome  = makeGenome();
    const sensors = new Map([[1, 0.7]]);
    const prev    = new Map<number, number>();
    const { allActivations } = evaluateNetwork(genome, sensors, prev);
    expect(allActivations.has(1)).toBe(true);
    expect(allActivations.get(1)).toBe(0.7);
  });

  // ─── Empty connection list ───────────────────────────────────────────────────

  test('network with no synapses returns zero for all outputs', () => {
    const genome = makeGenome({ connection_genes: [] });
    const sensors = new Map([[1, 1.0]]);
    const prev    = new Map<number, number>();
    const { outputs } = evaluateNetwork(genome, sensors, prev);
    expect(outputs.get(2) ?? 0).toBe(0);
  });

  // ─── Weight magnitude ────────────────────────────────────────────────────────

  test('larger weight magnitude produces stronger output (tanh saturation)', () => {
    const weak   = makeGenome();
    weak.connection_genes[0].weight = 0.1;
    const strong = makeGenome();
    strong.connection_genes[0].weight = 5.0;

    const sensors = new Map([[1, 1.0]]);
    const prev    = new Map<number, number>();

    const weakOut   = evaluateNetwork(weak,   sensors, prev).outputs.get(2) ?? 0;
    const strongOut = evaluateNetwork(strong, sensors, prev).outputs.get(2) ?? 0;

    expect(strongOut).toBeGreaterThan(weakOut);
  });
});
