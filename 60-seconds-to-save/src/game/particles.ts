/**
 * Zero-GC fixed-capacity ring buffers for particles and floating score callouts.
 */

export interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  shape: 'circle' | 'square' | 'ring';
}

export interface FloatingTextSlot {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export class EffectsPool {
  public readonly particles: ParticleSlot[];
  public readonly texts: FloatingTextSlot[];
  private pCursor = 0;
  private tCursor = 0;

  constructor(particleCapacity = 220, textCapacity = 24) {
    this.particles = Array.from({ length: particleCapacity }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      size: 3,
      life: 0,
      maxLife: 0.4,
      color: '#FFFFFF',
      shape: 'circle',
    }));

    this.texts = Array.from({ length: textCapacity }, () => ({
      active: false,
      x: 0,
      y: 0,
      vy: -42,
      text: '',
      color: '#FFFFFF',
      life: 0,
      maxLife: 0.9,
      scale: 1,
    }));
  }

  public clear(): void {
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].active = false;
    }
    for (let i = 0; i < this.texts.length; i++) {
      this.texts[i].active = false;
    }
  }

  public spawnBurst(
    x: number,
    y: number,
    count: number,
    color: string,
    speedMin: number,
    speedMax: number,
    sizeMin = 2.5,
    sizeMax = 5.5,
    life = 0.42,
    shape: 'circle' | 'square' = 'circle'
  ): void {
    for (let i = 0; i < count; i++) {
      const slot = this.particles[this.pCursor];
      this.pCursor = (this.pCursor + 1) % this.particles.length;

      const angle = Math.random() * Math.PI * 2;
      const speed = speedMin + Math.random() * (speedMax - speedMin);
      slot.active = true;
      slot.x = x;
      slot.y = y;
      slot.vx = Math.cos(angle) * speed;
      slot.vy = Math.sin(angle) * speed;
      slot.size = sizeMin + Math.random() * (sizeMax - sizeMin);
      slot.life = life * (0.75 + Math.random() * 0.45);
      slot.maxLife = slot.life;
      slot.color = color;
      slot.shape = shape;
    }
  }

  public spawnRing(x: number, y: number, color: string, startSize: number, life = 0.35): void {
    const slot = this.particles[this.pCursor];
    this.pCursor = (this.pCursor + 1) % this.particles.length;
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.vx = 0;
    slot.vy = 0;
    slot.size = startSize;
    slot.life = life;
    slot.maxLife = life;
    slot.color = color;
    slot.shape = 'ring';
  }

  public spawnText(
    x: number,
    y: number,
    text: string,
    color: string,
    scale = 1,
    life = 0.95
  ): void {
    const slot = this.texts[this.tCursor];
    this.tCursor = (this.tCursor + 1) % this.texts.length;
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.vy = -48;
    slot.text = text;
    slot.color = color;
    slot.life = life;
    slot.maxLife = life;
    slot.scale = scale;
  }

  public update(dt: number): void {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      if (p.shape === 'ring') {
        p.size += dt * 155;
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const drag = Math.pow(0.08, dt);
        p.vx *= drag;
        p.vy *= drag;
      }
    }

    for (let i = 0; i < this.texts.length; i++) {
      const t = this.texts[i];
      if (!t.active) continue;
      t.life -= dt;
      if (t.life <= 0) {
        t.active = false;
        continue;
      }
      t.y += t.vy * dt;
      t.vy *= Math.pow(0.25, dt);
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.globalAlpha = alpha;
      if (p.shape === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5 * alpha + 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.shape === 'square') {
        ctx.fillStyle = p.color;
        const half = p.size * 0.5;
        ctx.fillRect(p.x - half, p.y - half, p.size, p.size);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * alpha), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < this.texts.length; i++) {
      const t = this.texts[i];
      if (!t.active) continue;
      const alpha = Math.max(0, Math.min(1, t.life / (t.maxLife * 0.45)));
      ctx.globalAlpha = alpha;
      const px = Math.round(16 * t.scale);
      ctx.font = `700 ${px}px "JetBrains Mono", monospace`;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(8, 14, 24, 0.9)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}
