'use client';

import { useEffect, useRef } from 'react';
import type * as planck from 'planck';
import { SimulationEngine } from '@/engine/SimulationLoop';
import { PIXELS_PER_METER } from '@/engine/CreatureBuilder';
import { useSimulationStore } from '@/store/simulationStore';
import { Genome } from '@/types/genome';
import { LeaderboardEntry } from '@/components/leaderboard/Leaderboard';

// planck's PolygonShape stores local vertices here, but the type is internal
interface PlanckPolygon extends planck.Shape {
  m_vertices: planck.Vec2[];
}

interface PlanckEdge extends planck.Shape {
  m_vertex1: planck.Vec2;
  m_vertex2: planck.Vec2;
}

interface PhysicsArenaProps {
  onEngineReady?: (engine: SimulationEngine) => void;
  onActivationsUpdate?: (genome: Genome, activations: Map<number, number>) => void;
  onLeaderboardUpdate?: (data: LeaderboardEntry[]) => void;
}

export default function PhysicsArena({ onEngineReady, onActivationsUpdate, onLeaderboardUpdate }: PhysicsArenaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SimulationEngine | null>(null);
  const rafRef = useRef<number>(0);
  const isPlayingRef = useRef(false);
  const speedRef = useRef<1 | 2 | 5>(1);
  const onActivationsUpdateRef = useRef(onActivationsUpdate);
  const onLeaderboardUpdateRef = useRef(onLeaderboardUpdate);
  const frameCountRef = useRef(0);

  const { population, gravity, friction, terrain, isPlaying, simulationSpeed } =
    useSimulationStore();

  // Keep refs in sync so the rAF loop always sees the latest values without
  // needing to restart (which would reset the engine).
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { speedRef.current = simulationSpeed; }, [simulationSpeed]);
  useEffect(() => { onActivationsUpdateRef.current = onActivationsUpdate; }, [onActivationsUpdate]);
  useEffect(() => { onLeaderboardUpdateRef.current = onLeaderboardUpdate; }, [onLeaderboardUpdate]);

  // Re-create the engine and restart the render loop when the population or
  // physics parameters change.
  useEffect(() => {
    if (population.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    engineRef.current = new SimulationEngine(population, gravity, friction, terrain);
    onEngineReady?.(engineRef.current);

    const syncSize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w > 0) canvas.width = w;
      if (h > 0) canvas.height = h;
    };
    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(canvas);

    function loop() {
      if (!ctx || !canvas || !engineRef.current) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const W = canvas.width;
      const H = canvas.height;

      ctx.clearRect(0, 0, W, H);

      if (isPlayingRef.current) {
        const n = speedRef.current;
        for (let i = 0; i < n; i++) {
          engineRef.current.tick(1 / 60);
        }
      }

      frameCountRef.current += 1;
      if (frameCountRef.current % 10 === 0) {
        if (onActivationsUpdateRef.current) {
          const genome = engineRef.current.getLeaderGenome();
          if (genome) {
            onActivationsUpdateRef.current(genome, engineRef.current.getLeaderActivations());
          }
        }
        if (onLeaderboardUpdateRef.current) {
          onLeaderboardUpdateRef.current(engineRef.current.getLeaderboardData());
        }
      }

      // §6.2 Camera-follow: find the creature whose torso (gene_id === 0) is furthest right.
      const physicsCreatures = engineRef.current.getPhysicsCreatures();
      let leaderX = 0;
      let leaderCreature: (typeof physicsCreatures)[0] | null = null;
      for (const creature of physicsCreatures) {
        const torso = creature.bodies.get(0);
        if (torso) {
          const x = torso.getPosition().x;
          if (x > leaderX) {
            leaderX = x;
            leaderCreature = creature;
          }
        }
      }

      // Keep leader 25% from left edge — gives visual space ahead.
      const cameraX = leaderX * PIXELS_PER_METER - W * 0.25;

      ctx.save();
      ctx.translate(-cameraX, H * 0.75);

      // Ground must always fill the screen as camera moves.
      ctx.beginPath();
      ctx.moveTo(cameraX - 200, 0);
      ctx.lineTo(cameraX + W + 200, 0);
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Terrain obstacles
      if (terrain === 'hurdles' || terrain === 'stairs') {
        for (let body = engineRef.current.world.getBodyList(); body; body = body.getNext()) {
          if (body.getType() !== 'static') continue;
          const fixture = body.getFixtureList();
          if (!fixture) continue;
          const shape = fixture.getShape();
          if (shape.getType() !== 'polygon') continue;
          const verts = (shape as PlanckPolygon).m_vertices;
          if (!verts?.length) continue;
          let minVx = Infinity, maxVx = -Infinity, minVy = Infinity, maxVy = -Infinity;
          for (const v of verts) {
            if (v.x < minVx) minVx = v.x;
            if (v.x > maxVx) maxVx = v.x;
            if (v.y < minVy) minVy = v.y;
            if (v.y > maxVy) maxVy = v.y;
          }
          const bw = (maxVx - minVx) * PIXELS_PER_METER;
          const bh = (maxVy - minVy) * PIXELS_PER_METER;
          const pos = body.getPosition();
          ctx.save();
          ctx.translate(pos.x * PIXELS_PER_METER, -pos.y * PIXELS_PER_METER);
          ctx.beginPath();
          ctx.rect(-bw / 2, -bh / 2, bw, bh);
          ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
          ctx.fill();
          ctx.restore();
        }
      }

      if (terrain === 'hills') {
        ctx.beginPath();
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        for (let body = engineRef.current.world.getBodyList(); body; body = body.getNext()) {
          if (body.getType() !== 'static') continue;
          const fixture = body.getFixtureList();
          if (!fixture) continue;
          const shape = fixture.getShape();
          if (shape.getType() !== 'edge') continue;
          const edge = shape as PlanckEdge;
          if (Math.abs(edge.m_vertex1.x) > 100) continue; // skip main ground
          ctx.moveTo(edge.m_vertex1.x * PIXELS_PER_METER, -edge.m_vertex1.y * PIXELS_PER_METER);
          ctx.lineTo(edge.m_vertex2.x * PIXELS_PER_METER, -edge.m_vertex2.y * PIXELS_PER_METER);
        }
        ctx.stroke();
      }

      // Creatures
      for (const creature of physicsCreatures) {
        const isLeader = creature === leaderCreature;

        for (const [, body] of creature.bodies) {
          const pos = body.getPosition();
          const angle = body.getAngle();

          ctx.save();
          ctx.translate(pos.x * PIXELS_PER_METER, -pos.y * PIXELS_PER_METER);
          ctx.rotate(-angle);

          const fixture = body.getFixtureList();
          if (fixture) {
            const shape = fixture.getShape();
            if (shape.getType() === 'polygon') {
              const verts = (shape as PlanckPolygon).m_vertices;
              if (verts?.length) {
                // Derive pixel dimensions from local polygon vertices (stored in planck metres).
                let minVx = Infinity, maxVx = -Infinity;
                let minVy = Infinity, maxVy = -Infinity;
                for (const v of verts) {
                  if (v.x < minVx) minVx = v.x;
                  if (v.x > maxVx) maxVx = v.x;
                  if (v.y < minVy) minVy = v.y;
                  if (v.y > maxVy) maxVy = v.y;
                }
                const w = (maxVx - minVx) * PIXELS_PER_METER;
                const h = (maxVy - minVy) * PIXELS_PER_METER;

                ctx.beginPath();
                ctx.rect(-w / 2, -h / 2, w, h);
                ctx.fillStyle = 'rgba(34, 211, 238, 0.6)';
                ctx.fill();

                if (isLeader) {
                  ctx.strokeStyle = '#3b82f6';
                  ctx.lineWidth = 2;
                  ctx.stroke();
                }
              }
            }
          }

          ctx.restore();
        }
      }

      ctx.restore();
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [population]);

  return (
    <div className="w-full h-full">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}
