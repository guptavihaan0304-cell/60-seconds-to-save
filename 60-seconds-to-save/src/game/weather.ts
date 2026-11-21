import { WORLD_HEIGHT, WORLD_WIDTH, blendWeatherConfigs, getWeatherForPhase } from './rules';
import type { RgbColor, WeatherConfig, WeatherId } from './types';

interface FogBank {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  speedScale: number;
  swayPhase: number;
  swayAmp: number;
  useSecondary: boolean;
  alphaScale: number;
}

interface WeatherStreak {
  x: number;
  y: number;
  depth: number; // 0.55 (far) .. 1.0 (near background)
  speedFactor: number;
  lengthFactor: number;
  useAccent: boolean;
  glyph: string;
  glyphSlot: number; // 0..1 deterministic threshold for digital glyph display
  swayPhase: number;
  alphaScale: number;
}

interface FloorRipple {
  active: boolean;
  x: number;
  y: number;
  age: number;
  duration: number;
  maxRadius: number;
  useAccent: boolean;
}

interface GridGlint {
  active: boolean;
  x: number;
  y: number;
  age: number;
  duration: number;
  armLen: number;
  useAccent: boolean;
}

const FOG_COUNT = 7;
const STREAK_POOL_SIZE = 84;
const RIPPLE_POOL_SIZE = 16;
const GLINT_POOL_SIZE = 12;
const DIGITAL_GLYPHS = ['0', '1', '7', 'A', 'F', 'X', '+', ':'];

function rgbStr(c: RgbColor, alpha: number): string {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha.toFixed(3)})`;
}

export class WeatherSystem {
  private fogBanks: FogBank[] = [];
  private streaks: WeatherStreak[] = [];
  private ripples: FloorRipple[] = [];
  private glints: GridGlint[] = [];

  private fromConfig: WeatherConfig;
  private toConfig: WeatherConfig;
  private currentConfig: WeatherConfig;
  private blendProgress = 1;
  private rippleAccum = 0;
  private glintAccum = 0;
  private time = 0;
  private reducedMotion = false;

  // Pre-baked soft radial fog stamps per phase (primary & secondary) to keep 60fps fast with zero gradient allocations per frame
  private fogSprites: Partial<Record<WeatherId, { primary: HTMLCanvasElement; secondary: HTMLCanvasElement }>> = {};

  constructor(initialPhase: 1 | 2 | 3 | 4 = 1) {
    const initial = getWeatherForPhase(initialPhase);
    this.fromConfig = initial;
    this.toConfig = initial;
    this.currentConfig = initial;

    if (typeof window !== 'undefined' && window.matchMedia) {
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    this.initPools();
    this.initFogSprites();
  }

  public getWeatherId(): WeatherId {
    return this.toConfig.id;
  }

  public setPhase(phase: 1 | 2 | 3 | 4, immediate = false): void {
    const next = getWeatherForPhase(phase);
    if (!immediate && next.id === this.toConfig.id) return;

    if (immediate) {
      this.fromConfig = next;
      this.toConfig = next;
      this.currentConfig = next;
      this.blendProgress = 1;
    } else {
      this.fromConfig = { ...this.currentConfig };
      this.toConfig = next;
      this.blendProgress = 0;
    }
  }

  private initPools(): void {
    // Spread fog banks evenly across the arena so background depth feels continuous
    this.fogBanks = Array.from({ length: FOG_COUNT }, (_, idx) => ({
      x: ((idx + 0.5) / FOG_COUNT) * WORLD_WIDTH + (Math.random() - 0.5) * 140,
      y: 120 + ((idx * 173) % (WORLD_HEIGHT - 240)),
      radiusX: 210 + (idx % 3) * 75,
      radiusY: 130 + ((idx + 1) % 3) * 45,
      speedScale: 0.72 + (idx % 4) * 0.16,
      swayPhase: Math.random() * Math.PI * 2,
      swayAmp: 12 + (idx % 3) * 8,
      useSecondary: idx % 2 === 1,
      alphaScale: 0.72 + (idx % 3) * 0.18,
    }));

    this.streaks = Array.from({ length: STREAK_POOL_SIZE }, (_, idx) => ({
      x: 32 + Math.random() * (WORLD_WIDTH - 64),
      y: 32 + Math.random() * (WORLD_HEIGHT - 64),
      depth: 0.58 + (idx % 5) * 0.105,
      speedFactor: 0.15 + Math.random() * 0.85,
      lengthFactor: 0.2 + Math.random() * 0.8,
      useAccent: idx % 3 === 0,
      glyph: DIGITAL_GLYPHS[idx % DIGITAL_GLYPHS.length],
      glyphSlot: (idx % 20) / 20,
      swayPhase: Math.random() * Math.PI * 2,
      alphaScale: 0.55 + Math.random() * 0.45,
    }));

    this.ripples = Array.from({ length: RIPPLE_POOL_SIZE }, () => ({
      active: false,
      x: 0,
      y: 0,
      age: 0,
      duration: 0.55,
      maxRadius: 14,
      useAccent: false,
    }));

    this.glints = Array.from({ length: GLINT_POOL_SIZE }, () => ({
      active: false,
      x: 0,
      y: 0,
      age: 0,
      duration: 0.65,
      armLen: 14,
      useAccent: false,
    }));
  }

  private createFogStamp(color: RgbColor): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;
    const size = 128;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d');
    if (!g) return null;

    const half = size * 0.5;
    const grad = g.createRadialGradient(half, half, 4, half, half, half);
    grad.addColorStop(0, rgbStr(color, 1));
    grad.addColorStop(0.45, rgbStr(color, 0.48));
    grad.addColorStop(1, rgbStr(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
  }

  private initFogSprites(): void {
    const phases: Array<1 | 2 | 3 | 4> = [1, 2, 3, 4];
    for (const p of phases) {
      const cfg = getWeatherForPhase(p);
      const primary = this.createFogStamp(cfg.fogColor);
      const secondary = this.createFogStamp(cfg.fogSecondaryColor);
      if (primary && secondary) {
        this.fogSprites[cfg.id] = { primary, secondary };
      }
    }
  }

  public update(dt: number, timeScale = 1): void {
    const motionFactor = this.reducedMotion ? 0.35 : 1;
    const simDt = dt * timeScale * motionFactor;
    this.time += simDt;

    // Smooth cross-fade across phases (~0.85s)
    if (this.blendProgress < 1) {
      this.blendProgress = Math.min(1, this.blendProgress + dt * 1.2);
      this.currentConfig = blendWeatherConfigs(this.fromConfig, this.toConfig, this.blendProgress);
    }

    const cfg = this.currentConfig;
    const activeStreaks = Math.floor(STREAK_POOL_SIZE * cfg.streakDensity);
    const isAshfall = cfg.id === 'ashfall_haze';

    // Drift fog banks horizontally with gentle vertical sway
    for (const fog of this.fogBanks) {
      fog.x -= cfg.fogDriftSpeed * fog.speedScale * simDt;
      fog.swayPhase += simDt * 0.55 * fog.speedScale;
      if (fog.x + fog.radiusX < -40) {
        fog.x = WORLD_WIDTH + fog.radiusX + 30;
        fog.y = 90 + Math.random() * (WORLD_HEIGHT - 180);
      }
    }

    // Update falling rain / mist / ion / ashfall streaks
    const minY = 24;
    const maxY = WORLD_HEIGHT - 24;
    const minX = 24;
    const maxX = WORLD_WIDTH - 24;

    for (let i = 0; i < activeStreaks; i++) {
      const s = this.streaks[i];
      const vy =
        (cfg.streakSpeedMin + (cfg.streakSpeedMax - cfg.streakSpeedMin) * s.speedFactor) * s.depth;
      const flutter = isAshfall ? Math.sin(this.time * 3.4 + s.swayPhase) * 32 : 0;
      const vx = (cfg.windX + flutter) * s.depth;

      s.x += vx * simDt;
      s.y += vy * simDt;

      if (s.y > maxY + 30) {
        s.y = minY - 10 - Math.random() * 40;
        s.x = minX + Math.random() * (maxX - minX);
      }
      if (s.x < minX - 40) {
        s.x = maxX + 20;
      } else if (s.x > maxX + 40) {
        s.x = minX - 20;
      }
    }

    // Spawn & advance subtle floor rain impact ripples
    this.rippleAccum += cfg.rippleRate * simDt;
    while (this.rippleAccum >= 1) {
      this.rippleAccum -= 1;
      this.spawnRipple();
    }
    for (const r of this.ripples) {
      if (!r.active) continue;
      r.age += simDt;
      if (r.age >= r.duration) {
        r.active = false;
      }
    }

    // Spawn & advance subtle background grid intersection circuit glints
    this.glintAccum += cfg.gridGlintRate * simDt;
    while (this.glintAccum >= 1) {
      this.glintAccum -= 1;
      this.spawnGridGlint();
    }
    for (const gl of this.glints) {
      if (!gl.active) continue;
      gl.age += simDt;
      if (gl.age >= gl.duration) {
        gl.active = false;
      }
    }
  }

  private spawnRipple(): void {
    for (const r of this.ripples) {
      if (!r.active) {
        r.active = true;
        r.x = 56 + Math.random() * (WORLD_WIDTH - 112);
        r.y = 56 + Math.random() * (WORLD_HEIGHT - 112);
        r.age = 0;
        r.duration = 0.42 + Math.random() * 0.25;
        r.maxRadius = 9 + Math.random() * 8;
        r.useAccent = Math.random() < 0.4;
        return;
      }
    }
  }

  private spawnGridGlint(): void {
    for (const gl of this.glints) {
      if (!gl.active) {
        // Snap strictly to the 64px arena floor grid intersections
        const col = 1 + Math.floor(Math.random() * (Math.floor((WORLD_WIDTH - 64) / 64) - 1));
        const row = 1 + Math.floor(Math.random() * (Math.floor((WORLD_HEIGHT - 64) / 64) - 1));
        gl.active = true;
        gl.x = col * 64;
        gl.y = row * 64;
        gl.age = 0;
        gl.duration = 0.55 + Math.random() * 0.45;
        gl.armLen = 10 + Math.random() * 14;
        gl.useAccent = Math.random() < 0.5;
        return;
      }
    }
  }

  /**
   * Renders atmospheric weather strictly inside the arena floor bounds (beneath Safe Zone,
   * hazards, targets, and player) to add rich background depth without obscuring gameplay.
   */
  public renderBackground(ctx: CanvasRenderingContext2D, isFrozen = false): void {
    const cfg = this.currentConfig;

    ctx.save();
    // Clip cleanly to the interior arena deck so weather sits organically within the arena
    ctx.beginPath();
    ctx.rect(28, 28, WORLD_WIDTH - 56, WORLD_HEIGHT - 56);
    ctx.clip();

    // 1. Subtle atmospheric ambient floor wash
    const washColor = isFrozen ? { r: 56, g: 189, b: 248 } : cfg.ambientWashColor;
    const washAlpha = isFrozen ? 0.08 : cfg.ambientWashOpacity;
    ctx.fillStyle = rgbStr(washColor, washAlpha);
    ctx.fillRect(28, 28, WORLD_WIDTH - 56, WORLD_HEIGHT - 56);

    // 2. Soft drifting layered fog / mist banks (pre-baked radial stamps)
    const fromSprites = this.fogSprites[this.fromConfig.id];
    const toSprites = this.fogSprites[this.toConfig.id];
    if (toSprites) {
      for (const fog of this.fogBanks) {
        const yPos = fog.y + Math.sin(fog.swayPhase) * fog.swayAmp;
        const dx = fog.x - fog.radiusX;
        const dy = yPos - fog.radiusY;
        const dw = fog.radiusX * 2;
        const dh = fog.radiusY * 2;

        if (this.blendProgress < 1 && fromSprites && fromSprites !== toSprites) {
          const fromImg = fog.useSecondary ? fromSprites.secondary : fromSprites.primary;
          ctx.globalAlpha = cfg.fogOpacity * fog.alphaScale * (1 - this.blendProgress);
          ctx.drawImage(fromImg, dx, dy, dw, dh);
        }

        const toImg = fog.useSecondary ? toSprites.secondary : toSprites.primary;
        ctx.globalAlpha = cfg.fogOpacity * fog.alphaScale * this.blendProgress;
        ctx.drawImage(toImg, dx, dy, dw, dh);
      }
      ctx.globalAlpha = 1;
    }

    // 3. Subtle background floor grid circuit glints
    for (const gl of this.glints) {
      if (!gl.active) continue;
      const p = gl.age / gl.duration;
      const envelope = Math.sin(p * Math.PI);
      const col = isFrozen
        ? { r: 125, g: 211, b: 252 }
        : gl.useAccent
        ? cfg.streakAccentColor
        : cfg.streakColor;
      ctx.strokeStyle = rgbStr(col, 0.24 * envelope);
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(gl.x - gl.armLen, gl.y);
      ctx.lineTo(gl.x + gl.armLen, gl.y);
      ctx.moveTo(gl.x, gl.y - gl.armLen);
      ctx.lineTo(gl.x, gl.y + gl.armLen);
      ctx.stroke();
    }

    // 4. Subtle floor splash ripples (especially visible during Digital Rain & Ion Haze)
    for (const r of this.ripples) {
      if (!r.active) continue;
      const p = r.age / r.duration;
      const alpha = (1 - p) * 0.2;
      const col = isFrozen
        ? { r: 125, g: 211, b: 252 }
        : r.useAccent
        ? cfg.streakAccentColor
        : cfg.streakColor;
      ctx.strokeStyle = rgbStr(col, alpha);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 2 + p * r.maxRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 5. Phase-adaptive falling streaks: Cool Mist specks, Digital Rain streams, Ion Drizzle, or Thermal Ashfall
    const activeStreaks = Math.floor(STREAK_POOL_SIZE * cfg.streakDensity);
    const isAshfall = cfg.id === 'ashfall_haze';
    const isMist = cfg.id === 'light_fog';

    const primaryCol = isFrozen ? { r: 125, g: 211, b: 252 } : cfg.streakColor;
    const accentCol = isFrozen ? { r: 224, g: 242, b: 254 } : cfg.streakAccentColor;

    // Optional subtle heat-shimmer horizon ribbons during Phase 4 Ashfall
    if (isAshfall && !isFrozen) {
      ctx.strokeStyle = 'rgba(251, 146, 60, 0.055)';
      ctx.lineWidth = 10;
      for (let w = 0; w < 3; w++) {
        const baseY = 180 + w * 220;
        ctx.beginPath();
        for (let x = 28; x <= WORLD_WIDTH - 28; x += 96) {
          const wy = baseY + Math.sin(x * 0.008 + this.time * 1.4 + w * 2.1) * 14;
          if (x === 28) ctx.moveTo(x, wy);
          else ctx.lineTo(x, wy);
        }
        ctx.stroke();
      }
    }

    // Draw streaks cleanly with crisp geometry
    let drewGlyphFont = false;
    for (let i = 0; i < activeStreaks; i++) {
      const s = this.streaks[i];
      const len =
        (cfg.streakLengthMin + (cfg.streakLengthMax - cfg.streakLengthMin) * s.lengthFactor) *
        s.depth;
      const vy =
        (cfg.streakSpeedMin + (cfg.streakSpeedMax - cfg.streakSpeedMin) * s.speedFactor) * s.depth;
      const vx = cfg.windX * s.depth;
      const speedMag = Math.hypot(vx, vy) || 1;
      const ux = vx / speedMag;
      const uy = vy / speedMag;

      const tailX = s.x - ux * len;
      const tailY = s.y - uy * len;
      const col = s.useAccent ? accentCol : primaryCol;
      const alpha = cfg.streakOpacity * s.alphaScale * s.depth;

      if (isMist) {
        // Gentle cool mist condensation droplets + faint short trails
        ctx.strokeStyle = rgbStr(col, alpha * 0.72);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();

        ctx.fillStyle = rgbStr(col, alpha * 1.1);
        ctx.beginPath();
        ctx.arc(s.x, s.y, 1.4 * s.depth, 0, Math.PI * 2);
        ctx.fill();
      } else if (isAshfall) {
        // Wind-sheared ember streaks + floating ash flecks
        ctx.strokeStyle = rgbStr(col, alpha * 0.65);
        ctx.lineWidth = s.useAccent ? 1.8 : 1.25;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();

        ctx.fillStyle = rgbStr(col, Math.min(0.45, alpha * 1.25));
        ctx.fillRect(s.x - 1.5, s.y - 1.5, 3 * s.depth, 3 * s.depth);
      } else {
        // Digital Rain / Ion Drizzle: segmented tail + crisp luminous head pip + occasional subtle binary/hex glyph
        ctx.strokeStyle = rgbStr(col, alpha * 0.78);
        ctx.lineWidth = s.depth > 0.85 ? 1.75 : 1.2;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();

        // Bright leading droplet head
        ctx.fillStyle = rgbStr(col, Math.min(0.5, alpha * 1.35));
        ctx.fillRect(s.x - 1.1, s.y - 1.1, 2.2, 2.2);

        // Subtle digital rain glyph on selected streams
        if (s.glyphSlot < cfg.digitalGlyphRatio && s.depth >= 0.75) {
          if (!drewGlyphFont) {
            ctx.font = '600 9px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            drewGlyphFont = true;
          }
          ctx.fillStyle = rgbStr(col, Math.min(0.38, alpha * 1.1));
          ctx.fillText(s.glyph, s.x, s.y + 8);
        }
      }
    }

    ctx.restore();
  }
}
