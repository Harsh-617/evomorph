import * as planck from 'planck';
import { ConnectionType, Genome, NodeGene, NodeType } from '../types/genome';

/** Physics ↔ screen conversion: 1 metre = 30 px. Exported for the renderer. */
export const PIXELS_PER_METER = 30;

export interface PhysicsCreature {
  bodies: Map<number, planck.Body>;
  joints: Map<number, planck.RevoluteJoint>;
  genomeId: string;
}

/**
 * Instantiates a creature's physics representation inside a planck World.
 *
 * @param genome   Genome describing body segments and joints.
 * @param world    The shared planck physics world.
 * @param startX   Optional horizontal spawn offset in pixels (default 0).
 *                 Pass a unique per-creature value so 20 creatures don't overlap.
 * @returns        Maps from gene_id → Body and innovation_id → RevoluteJoint.
 */
export function createPhysicsCreature(
  genome: Genome,
  world: planck.World,
  startX = 0,
): PhysicsCreature {
  const bodies = new Map<number, planck.Body>();
  const joints = new Map<number, planck.RevoluteJoint>();

  // ── Index body-segment genes ───────────────────────────────────────────────
  const segmentGenes = new Map<number, NodeGene>();
  for (const gene of genome.node_genes) {
    if (gene.type === NodeType.BODY_SEGMENT) segmentGenes.set(gene.gene_id, gene);
  }

  // ── Collect enabled joint connection genes ─────────────────────────────────
  const jointGenes = genome.connection_genes.filter(
    (g) => g.conn_type === ConnectionType.JOINT && g.enabled,
  );

  // ── Build parent → [children] adjacency list ──────────────────────────────
  const childrenOf = new Map<number, number[]>();
  for (const j of jointGenes) {
    if (!childrenOf.has(j.in_node)) childrenOf.set(j.in_node, []);
    childrenOf.get(j.in_node)!.push(j.out_node);
  }

  // ── px → m helper ──────────────────────────────────────────────────────────
  const m = (px: number) => px / PIXELS_PER_METER;

  // Track world-space body centres and joint anchors for joint creation
  const centerOf = new Map<number, planck.Vec2>();
  const anchorOf = new Map<number, planck.Vec2>(); // childId → anchor in world-space

  // ── Helper: create one dynamic body + box fixture ──────────────────────────
  function buildBody(gene: NodeGene, position: planck.Vec2): planck.Body {
    const halfW = m(gene.width ?? 40) / 2;
    const halfH = m(gene.height ?? 15) / 2;
    const body = world.createBody({ type: 'dynamic', position, allowSleep: false });
    body.createFixture(new planck.Box(halfW, halfH), {
      density: gene.density ?? 1.0,
      friction: gene.friction ?? 0.5,
      restitution: 0.1,
    });
    return body;
  }

  // ── Root segment: gene_id 0 (torso) ───────────────────────────────────────
  const rootGene = segmentGenes.get(0);
  if (!rootGene) {
    throw new Error(`Genome "${genome.genome_id}" has no root body segment (gene_id 0)`);
  }

  const rootHalfH = m(rootGene.height ?? 15) / 2;
  const rootPos = new planck.Vec2(m(startX), rootHalfH + 0.5); // 0.5 m clear of y=0 ground
  bodies.set(0, buildBody(rootGene, rootPos));
  centerOf.set(0, rootPos);

  // ── BFS to place every connected child segment ────────────────────────────
  const queue: number[] = [...(childrenOf.get(0) ?? [])];
  const visited = new Set<number>([0]);

  while (queue.length > 0) {
    const childId = queue.shift()!;
    if (visited.has(childId)) continue;
    visited.add(childId);

    const childGene = segmentGenes.get(childId);
    if (!childGene) continue;

    // Locate the parent through the joint list
    const parentJoint = jointGenes.find((j) => j.out_node === childId);
    if (!parentJoint) continue;
    const parentId = parentJoint.in_node;

    const parentGene = segmentGenes.get(parentId)!;
    const parentCenter = centerOf.get(parentId)!;
    const parentHalfW = m(parentGene.width ?? 40) / 2;
    const childHalfW = m(childGene.width ?? 25) / 2;

    // Spread sibling limbs vertically so they don't start overlapping
    const siblings = childrenOf.get(parentId) ?? [];
    const sibIdx = siblings.indexOf(childId);
    const sibCount = siblings.length;
    const vertSpread = m((childGene.height ?? 10) + 3);
    const vertOffset = (sibIdx - (sibCount - 1) / 2) * vertSpread;

    // Joint anchor: right edge of parent, staggered per sibling
    const anchor = new planck.Vec2(parentCenter.x + parentHalfW, parentCenter.y + vertOffset);
    anchorOf.set(childId, anchor);

    // Child centre sits immediately to the right of the anchor
    const childPos = new planck.Vec2(anchor.x + childHalfW, anchor.y);
    bodies.set(childId, buildBody(childGene, childPos));
    centerOf.set(childId, childPos);

    // Enqueue grandchildren
    for (const grandchildId of childrenOf.get(childId) ?? []) {
      if (!visited.has(grandchildId)) queue.push(grandchildId);
    }
  }

  // ── Create RevoluteJoints ─────────────────────────────────────────────────
  for (const jGene of jointGenes) {
    const parentBody = bodies.get(jGene.in_node);
    const childBody = bodies.get(jGene.out_node);
    const anchor = anchorOf.get(jGene.out_node);
    if (!parentBody || !childBody || !anchor) continue;

    const raw = world.createJoint(
      new planck.RevoluteJoint(
        {
          enableLimit: true,
          lowerAngle: jGene.angle_limit_min ?? -Math.PI / 2,
          upperAngle: jGene.angle_limit_max ?? Math.PI / 2,
          enableMotor: true,
          maxMotorTorque: jGene.max_motor_torque ?? 200,
          motorSpeed: 0,
        },
        parentBody,
        childBody,
        anchor,
      ),
    );

    if (raw) joints.set(jGene.innovation_id, raw as planck.RevoluteJoint);
  }

  return { bodies, joints, genomeId: genome.genome_id };
}
