'use client';

import { useEffect, useRef } from 'react';
import type * as planck from 'planck';
import { SimulationEngine } from '@/engine/SimulationLoop';
import { PIXELS_PER_METER } from '@/engine/CreatureBuilder';
import { useSimulationStore } from '@/store/simulationStore';

// planck's PolygonShape stores local vertices here, but the type is internal
interface PlanckPolygon extends planck.Shape {
  m_vertices: planck.Vec2[];
}

export default function PhysicsArena() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SimulationEngine | null>(null);
  const rafRef = useRef<number>(0);
  const isPlayingRef = useRef(false);
  const speedRef = useRef<1 | 2 | 5>(1);

  const { population, gravity, friction, isPlaying, simulationSpeed } =
    useSimulationStore();

  // Keep refs in sync so the rAF loop always sees the latest values without
  // needing to restart (which would reset the engine).
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { speedRef.current = simulationSpeed; }, [simulationSpeed]);

  // Re-create the engine and restart the render loop when the population or
  // physics parameters change.
  useEffect(() => {
    if (population.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    engineRef.current = new SimulationEngine(population, gravity, friction);

    const syncSize = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
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

      // Camera: world origin (ground level) sits 75% down the canvas.
      const groundY = H * 0.75;
      ctx.save();
      ctx.translate(W / 2, groundY);
      // After this translate: screenX = physicsX * PPM, screenY = -physicsY * PPM

      // Ground line
      ctx.beginPath();
      ctx.moveTo(-W / 2, 0);
      ctx.lineTo(W / 2, 0);
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Creatures
      for (const creature of engineRef.current.getPhysicsCreatures()) {
        for (const [, body] of creature.bodies) {
          const pos = body.getPosition();
          const angle = body.getAngle();

          ctx.save();
          // Physics Y is up; canvas Y is down — flip both position and rotation.
          ctx.translate(pos.x * PIXELS_PER_METER, -pos.y * PIXELS_PER_METER);
          ctx.rotate(-angle);

          const fixture = body.getFixtureList();
          if (fixture) {
            const shape = fixture.getShape();
            if (shape.getType() === 'polygon') {
              const verts = (shape as PlanckPolygon).m_vertices;
              if (verts?.length) {
                ctx.beginPath();
                ctx.moveTo(
                  verts[0].x * PIXELS_PER_METER,
                  -verts[0].y * PIXELS_PER_METER,
                );
                for (let i = 1; i < verts.length; i++) {
                  ctx.lineTo(
                    verts[i].x * PIXELS_PER_METER,
                    -verts[i].y * PIXELS_PER_METER,
                  );
                }
                ctx.closePath();
                ctx.fillStyle = 'rgba(34, 211, 238, 0.5)';
                ctx.strokeStyle = 'rgba(34, 211, 238, 0.9)';
                ctx.lineWidth = 1;
                ctx.fill();
                ctx.stroke();
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
  }, [population, gravity, friction]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}
