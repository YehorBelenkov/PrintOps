'use client';

import { useEffect, useRef } from 'react';
import { SceneConfig, ParticleConfig, BodyConfig } from '@/lib/workspace/scene';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  opacity: number;
  phase: number;
  angle: number;
  spin: number;
  depth: number;
}

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

function makeParticle(cfg: ParticleConfig, w: number, h: number, fresh: boolean): Particle {
  const depth = 1 - Math.random() * cfg.parallax;
  const size = rand(cfg.minSize, cfg.maxSize) * depth;
  const speed = cfg.speed * depth;

  let x = rand(0, w);
  let y = rand(0, h);
  let vx = 0;
  let vy = 0;

  switch (cfg.direction) {
    case 'down':
      vy = speed;
      if (fresh) y = rand(-h, 0);
      break;
    case 'up':
      vy = -speed;
      if (fresh) y = rand(h, h * 2);
      break;
    case 'left':
      vx = -speed;
      if (fresh) x = rand(w, w * 2);
      break;
    case 'right':
      vx = speed;
      if (fresh) x = rand(-w, 0);
      break;
    case 'burst': {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * Math.min(w, h) * 0.1;
      x = w / 2 + Math.cos(a) * r;
      y = h / 2 + Math.sin(a) * r;
      vx = Math.cos(a) * speed;
      vy = Math.sin(a) * speed;
      break;
    }
    default: {
      const a = Math.random() * Math.PI * 2;
      vx = Math.cos(a) * speed;
      vy = Math.sin(a) * speed;
    }
  }

  return {
    x, y, vx, vy, size,
    color: pick(cfg.colors),
    opacity: rand(cfg.minOpacity, cfg.maxOpacity),
    phase: Math.random() * Math.PI * 2,
    angle: Math.random() * Math.PI * 2,
    spin: cfg.spin * rand(-1, 1) * Math.PI * 2,
    depth,
  };
}

function drawShape(ctx: CanvasRenderingContext2D, p: Particle, cfg: ParticleConfig) {
  const { size } = p;

  switch (cfg.shape) {
    case 'streak': {
      const len = Math.max(1, cfg.trail) * 26 * p.depth;
      const mag = Math.hypot(p.vx, p.vy) || 1;
      ctx.lineWidth = size;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - (p.vx / mag) * len, p.y - (p.vy / mag) * len);
      ctx.strokeStyle = p.color;
      ctx.stroke();
      return;
    }
    case 'star': {
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
      if (size > 1.6) {
        ctx.lineWidth = size * 0.35;
        ctx.beginPath();
        ctx.moveTo(p.x - size * 2.6, p.y);
        ctx.lineTo(p.x + size * 2.6, p.y);
        ctx.moveTo(p.x, p.y - size * 2.6);
        ctx.lineTo(p.x, p.y + size * 2.6);
        ctx.strokeStyle = p.color;
        ctx.globalAlpha *= 0.4;
        ctx.stroke();
      }
      return;
    }
    case 'flake': {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.lineWidth = Math.max(0.6, size * 0.22);
      ctx.strokeStyle = p.color;
      for (let i = 0; i < 3; i++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(-size, 0);
        ctx.lineTo(size, 0);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    case 'bubble': {
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(0.7, size * 0.12);
      ctx.strokeStyle = p.color;
      ctx.stroke();
      ctx.globalAlpha *= 0.28;
      ctx.fill();
      return;
    }
    case 'square': {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillRect(-size / 2, -size / 2, size, size * 0.62);
      ctx.restore();
      return;
    }
    case 'ring': {
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(0.8, size * 0.2);
      ctx.strokeStyle = p.color;
      ctx.stroke();
      return;
    }
    default:
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
  }
}

function drawBody(ctx: CanvasRenderingContext2D, b: Body, cfg: BodyConfig, w: number) {
  const r = (b.size / 100) * w;

  const gradient = ctx.createRadialGradient(
    b.x - r * 0.3, b.y - r * 0.3, r * 0.1,
    b.x, b.y, r
  );
  gradient.addColorStop(0, b.color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.globalAlpha = 0.35 + cfg.glow * 0.45;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
  ctx.fill();

  if (cfg.ring) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(-0.4);
    ctx.scale(1, 0.28);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.45, 0, Math.PI * 2);
    ctx.lineWidth = r * 0.09;
    ctx.strokeStyle = b.color;
    ctx.globalAlpha = 0.4;
    ctx.stroke();
    ctx.restore();
  }
}

export function SceneCanvas({ scene }: { scene: SceneConfig }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let bodies: Body[] = [];
    let frame = 0;
    let last = performance.now();

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;

      // Phones have the least GPU headroom and the most pixels per CSS point.
      const small = width < 700;
      const dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
      const budget = small ? 0.4 : width < 1100 ? 0.7 : 1;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (scene.particles) {
        const count = Math.max(8, Math.round(scene.particles.count * budget));
        particles = Array.from({ length: count }, () =>
          makeParticle(scene.particles!, width, height, false)
        );
      }
      if (scene.bodies) {
        bodies = Array.from({ length: scene.bodies.count }, () => ({
          x: rand(0.1, 0.9) * width,
          y: rand(0.05, 0.6) * height,
          vx: rand(-1, 1) * scene.bodies!.speed,
          vy: rand(-1, 1) * scene.bodies!.speed * 0.4,
          size: rand(scene.bodies!.minSize, scene.bodies!.maxSize),
          color: pick(scene.bodies!.colors),
        }));
      }
    };

    const render = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx.clearRect(0, 0, width, height);

      if (scene.bodies) {
        for (const b of bodies) {
          if (!reduced) {
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            const r = (b.size / 100) * width;
            if (b.x < -r || b.x > width + r) b.vx *= -1;
            if (b.y < -r || b.y > height + r) b.vy *= -1;
          }
          drawBody(ctx, b, scene.bodies, width);
        }
      }

      const cfg = scene.particles;
      if (cfg) {
        for (const p of particles) {
          if (!reduced) {
            p.x += (p.vx + Math.sin(now / 1400 + p.phase) * cfg.sway) * dt;
            p.y += p.vy * dt;
            p.angle += p.spin * dt;

            const margin = p.size * 4 + 30;
            const out =
              p.x < -margin || p.x > width + margin || p.y < -margin || p.y > height + margin;
            if (out) Object.assign(p, makeParticle(cfg, width, height, true));
          }

          ctx.globalAlpha = cfg.twinkle
            ? p.opacity * (0.45 + 0.55 * Math.abs(Math.sin(now / 900 + p.phase)))
            : p.opacity;
          ctx.fillStyle = p.color;
          drawShape(ctx, p, cfg);
        }
      }

      ctx.globalAlpha = 1;
      frame = requestAnimationFrame(render);
    };

    resize();
    window.addEventListener('resize', resize);
    frame = requestAnimationFrame(render);

    const onVisibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden) {
        last = performance.now();
        frame = requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [scene]);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="fixed inset-0 z-0 pointer-events-none"
      />
      {scene.vignette ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,${scene.vignette}) 100%)`,
          }}
        />
      ) : null}
    </>
  );
}
