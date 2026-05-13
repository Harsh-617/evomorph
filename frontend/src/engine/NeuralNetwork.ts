import { ActivationType, ConnectionType, Genome, NodeType } from '../types/genome';

function applyActivation(fn: ActivationType | undefined, x: number): number {
  switch (fn) {
    case ActivationType.RELU:    return Math.max(0, x);
    case ActivationType.SIGMOID: return 1 / (1 + Math.exp(-x));
    default:                     return Math.tanh(x); // TANH is the default
  }
}

/**
 * Runs one tick of the creature's neural network.
 *
 * @param genome         The creature genome (node + connection genes).
 * @param sensorValues   INPUT node activations for this tick: gene_id → value.
 * @param prevActivations  Activations from the previous tick, used for recurrent synapses.
 * @returns Map of OUTPUT node gene_id → activation value (motor commands).
 */
export function evaluateNetwork(
  genome: Genome,
  sensorValues: Map<number, number>,
  prevActivations: Map<number, number> = new Map(),
): Map<number, number> {
  // Index all non-body neurons
  const neurons = new Map(
    genome.node_genes
      .filter((g) => g.type !== NodeType.BODY_SEGMENT)
      .map((g) => [g.gene_id, g]),
  );

  // Enabled synapses only
  const synapses = genome.connection_genes.filter(
    (g) => g.conn_type === ConnectionType.SYNAPSE && g.enabled,
  );

  // Build incoming-edge index: out_node → [{from, weight}]
  const incoming = new Map<number, { from: number; weight: number }[]>();
  for (const syn of synapses) {
    if (!incoming.has(syn.out_node)) incoming.set(syn.out_node, []);
    incoming.get(syn.out_node)!.push({ from: syn.in_node, weight: syn.weight ?? 0 });
  }

  // Topological sort (DFS post-order) of HIDDEN + OUTPUT neurons.
  // Recurrent back-edges (cycle detection via inStack) fall back to prevActivations.
  const nonInputIds = new Set(
    Array.from(neurons.values())
      .filter((n) => n.type !== NodeType.INPUT)
      .map((n) => n.gene_id),
  );

  const visited = new Set<number>();
  const inStack = new Set<number>();
  const order: number[] = [];

  function dfs(id: number): void {
    if (visited.has(id) || inStack.has(id)) return;
    inStack.add(id);
    for (const { from } of incoming.get(id) ?? []) {
      if (nonInputIds.has(from)) dfs(from);
    }
    inStack.delete(id);
    visited.add(id);
    order.push(id);
  }

  for (const id of nonInputIds) dfs(id);

  // Evaluate nodes in dependency order, seeding with this tick's sensor values.
  const activations = new Map<number, number>(sensorValues);

  for (const id of order) {
    const gene = neurons.get(id)!;
    let sum = 0;
    for (const { from, weight } of incoming.get(id) ?? []) {
      // Use current-tick value if ready; otherwise use the previous tick (recurrent).
      const val = activations.has(from)
        ? activations.get(from)!
        : (prevActivations.get(from) ?? 0);
      sum += val * weight;
    }
    activations.set(id, applyActivation(gene.activation, sum));
  }

  // Collect only OUTPUT node activations as motor commands.
  const outputs = new Map<number, number>();
  for (const gene of genome.node_genes) {
    if (gene.type === NodeType.OUTPUT) {
      outputs.set(gene.gene_id, activations.get(gene.gene_id) ?? 0);
    }
  }
  return outputs;
}
