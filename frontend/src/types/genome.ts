// ─── Enums ────────────────────────────────────────────────────────────────────

export enum NodeType {
  BODY_SEGMENT = "BODY_SEGMENT",
  INPUT = "INPUT",
  OUTPUT = "OUTPUT",
  HIDDEN = "HIDDEN",
}

export enum SensorType {
  JOINT_ANGLE = "JOINT_ANGLE",
  GROUND_CONTACT = "GROUND_CONTACT",
  BODY_ANGLE = "BODY_ANGLE",
  ANGULAR_VELOCITY = "ANGULAR_VELOCITY",
  OSCILLATOR = "OSCILLATOR",
}

export enum ActivationType {
  TANH = "tanh",
  RELU = "relu",
  SIGMOID = "sigmoid",
}

export enum ConnectionType {
  JOINT = "JOINT",
  SYNAPSE = "SYNAPSE",
}

// ─── Gene Interfaces ──────────────────────────────────────────────────────────

export interface NodeGene {
  gene_id: number;
  type: NodeType;
  // Body segment properties (BODY_SEGMENT only)
  width?: number;
  height?: number;
  density?: number;
  friction?: number;
  // Neuron properties
  activation?: ActivationType;
  attached_segment_id?: number;
  sensor_type?: SensorType;
}

export interface ConnectionGene {
  innovation_id: number;
  in_node: number;
  out_node: number;
  conn_type: ConnectionType;
  enabled: boolean;
  // Joint properties (JOINT only)
  angle_limit_min?: number;
  angle_limit_max?: number;
  max_motor_torque?: number;
  // Synapse properties (SYNAPSE only)
  weight?: number;
}

// ─── Genome ───────────────────────────────────────────────────────────────────

export interface Genome {
  genome_id: string;
  species_id: number;
  generation: number;
  fitness: number;
  node_genes: NodeGene[];
  connection_genes: ConnectionGene[];
}

// ─── Simulation Result (Section 4.6) ─────────────────────────────────────────

export interface CreatureResult {
  genome_id: string;
  fitness: number;
  max_x_position: number;
  time_upright: number;
  cumulative_torque: number;
  head_ground_time: number;
  num_joints: number;
  max_torque: number;
  final_x: number;
  final_y: number;
  alive: boolean;
}
