import { SoundEngine } from './audio';
import { EffectsPool } from './particles';
import { WeatherSystem } from './weather';
import {
  ARENA_EVENTS,
  ARENA_OBSTACLES,
  DASH_COOLDOWN,
  DASH_DURATION,
  DEFAULT_DURATION_SECONDS,
  EMP_JAM_DURATION,
  FREEZE_TIMER_DURATION,
  HAZARD_EXCLUSION_RADIUS,
  INTERACT_COOLDOWN,
  INTERACT_RADIUS,
  INTERACT_STAMINA_COST,
  MAX_CARRY_ITEMS,
  MAX_HULL,
  MAX_STAMINA,
  POWERUP_SPECS,
  RESCUE_SPECS,
  SAFE_ZONE_CENTER,
  SAFE_ZONE_RADIUS,
  SHIELD_DURATION,
  SHRUNK_SAFE_ZONE_RADIUS,
  SPEED_BOOST_DURATION,
  STREAK_WINDOW_SECONDS,
  VAULT_BONUS_POINTS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  calculateBankScore,
  calculateDashCost,
  calculateMoveSpeed,
  clampToArena,
  distanceSq,
  evaluateRunSummary,
  getConvoyMultiplier,
  getPhaseForElapsed,
  getRunDurationForPerk,
  getStreakMultiplier,
  isPointInSafeZone,
  pickArenaEvent,
  pickRescueKind,
  readStoredBestScore,
  resolveCircleRectCollision,
  stepStaminaState,
  writeStoredBestScore,
} from './rules';
import type {
  ArenaEventId,
  DashGhost,
  DebrisHazard,
  EmpHazard,
  ErraticOrb,
  FirePatch,
  GameScreenState,
  HudDomRefs,
  HudSnapshot,
  PatrolDrone,
  PerkId,
  PowerUpItem,
  PowerUpKind,
  RescueItem,
  RescueKind,
  RunSummary,
  SavedBreakdown,
  ShockwaveHazard,
} from './types';

interface EngineCallbacks {
  onScreenChange: (state: GameScreenState) => void;
  onHudChange: (hud: HudSnapshot) => void;
  onRunEnd: (summary: RunSummary) => void;
}

export class RescueGameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: EngineCallbacks;
  private hudRefs: HudDomRefs = {
    timerEl: null,
    staminaFillEl: null,
    staminaGhostEl: null,
    staminaLabelEl: null,
  };

  public readonly audio: SoundEngine;
  private readonly effects = new EffectsPool(260, 30);
  private resizeObserver: ResizeObserver | null = null;
  private rafId: number | null = null;
  private lastTimestamp = 0;

  // Viewport & camera projection
  private viewW = 1280;
  private viewH = 800;
  private dpr = 1;
  private camX = SAFE_ZONE_CENTER.x;
  private camY = SAFE_ZONE_CENTER.y;
  private camScale = 1;
  private trauma = 0;

  // Game state machine
  private screenState: GameScreenState = 'title';
  private baseDuration: number = DEFAULT_DURATION_SECONDS;
  private runDuration: number = DEFAULT_DURATION_SECONDS;
  private timeRemaining: number = DEFAULT_DURATION_SECONDS;
  private elapsedTime = 0;
  private ambientTime = 0;
  private hitstopTimer = 0;
  private pendingEndTimer = 0;
  private pendingEndSummary: RunSummary | null = null;
  private lastUrgentSecond = 11;

  // Perk, Arena Event & Active Safe Zone Radius
  private activePerk: PerkId = 'fast_runner';
  private activeEvent: ArenaEventId | null = null;
  private safeZoneRadius: number = SAFE_ZONE_RADIUS;
  private freezeTimer = 0;

  // Player responder pod
  private player = {
    x: SAFE_ZONE_CENTER.x,
    y: SAFE_ZONE_CENTER.y,
    vx: 0,
    vy: 0,
    radius: 17,
    angle: 0,
    stamina: MAX_STAMINA,
    staminaGhost: MAX_STAMINA,
    exhausted: false,
    isRegenerating: false,
    hull: MAX_HULL,
    invulnTimer: 0,
    hitFlashTimer: 0,
    dashTimer: 0,
    dashCooldown: 0,
    dashBufferTimer: 0,
    dashDirX: 1,
    dashDirY: 0,
    dashGhostAccum: 0,
    interactCooldown: 0,
    interactPulseTimer: 0,
    empTimer: 0,
    shieldTimer: 0,
    speedBoostTimer: 0,
    scaleX: 1,
    scaleY: 1,
    fireBurnAccum: 0,
    inFire: false,
    inSafeZone: true,
  };

  // Entities & dynamic hazards
  private nextEntityId = 1;
  private items: RescueItem[] = [];
  private carriedIds: number[] = [];
  private powerUps: PowerUpItem[] = [];
  private dashGhosts: DashGhost[] = [];
  private debris: DebrisHazard[] = [];
  private drones: PatrolDrone[] = [];
  private fires: FirePatch[] = [];
  private orbs: ErraticOrb[] = [];
  private shockwaves: ShockwaveHazard[] = [];
  private emps: EmpHazard[] = [];
  private weather: WeatherSystem;

  // Spawners & progression
  private debrisSpawnTimer = 1.8;
  private shockwaveSpawnTimer = 3.8;
  private empSpawnTimer = 2.4;
  private fireSpawnTimer = 2.0;
  private powerUpSpawnTimer = 6.5;
  private initialPhase: 1 | 2 | 3 | 4 = 1;
  private phaseOffsetSeconds = 0;
  private currentPhase: 1 | 2 | 3 | 4 = 1;
  private bannerText: string | null = null;
  private bannerTimer = 0;

  // Scoring, streaks & mission stats
  private score = 0;
  private bestScore = 0;
  private savedTotal = 0;
  private bestConvoy = 0;
  private streakCount = 0;
  private streakTimer = 0;
  private maxStreak = 0;
  private damageTaken = 0;
  private breakdown: SavedBreakdown = { normal: 0, fast: 0, golden: 0 };

  // Input state
  private keys = new Set<string>();
  private joystickX = 0;
  private joystickY = 0;
  private pointerActive = false;
  private pointerWorldX = SAFE_ZONE_CENTER.x;
  private pointerWorldY = SAFE_ZONE_CENTER.y;
  private pointerClientX = 0;
  private pointerClientY = 0;

  // Throttled HUD signature & direct DOM caches
  private lastHudKey = '';
  private lastTimerText = '';
  private lastUrgency = '';
  private lastStaminaScale = '';
  private lastGhostScale = '';
  private lastStaminaText = '';
  private needsStaticRender = true;
  private destroyed = false;

  constructor(
    canvas: HTMLCanvasElement,
    callbacks: EngineCallbacks,
    initialDuration = DEFAULT_DURATION_SECONDS,
    initialPhase: 1 | 2 | 3 | 4 = 1
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not initialize 2D canvas context');
    }
    this.ctx = ctx;
    this.callbacks = callbacks;
    this.audio = new SoundEngine();
    this.baseDuration = Math.max(3, Math.min(180, initialDuration));
    this.runDuration = this.baseDuration;
    this.timeRemaining = this.runDuration;
    this.initialPhase = initialPhase;
    this.phaseOffsetSeconds = (initialPhase - 1) * 15;
    this.currentPhase = initialPhase;
    this.weather = new WeatherSystem(initialPhase);
    this.bestScore = readStoredBestScore();

    this.seedTitleScene();
    this.bindEvents();
    this.handleResize();
    this.syncBodyState();
    this.emitHud(true);

    this.lastTimestamp = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  public setHudRefs(refs: HudDomRefs): void {
    this.hudRefs = refs;
    this.lastTimerText = '';
    this.lastUrgency = '';
    this.lastStaminaScale = '';
    this.lastGhostScale = '';
    this.lastStaminaText = '';
    this.updateDirectHudDom();
  }

  public getScreenState(): GameScreenState {
    return this.screenState;
  }

  public setJoystickVector(x: number, y: number): void {
    this.joystickX = Math.max(-1, Math.min(1, x));
    this.joystickY = Math.max(-1, Math.min(1, y));
    if (Math.hypot(this.joystickX, this.joystickY) > 0.05) {
      this.audio.unlock();
      this.pointerActive = false;
    }
  }

  public startNewRun(perk: PerkId = this.activePerk, fromUserGesture = true): void {
    this.activePerk = perk;
    if (fromUserGesture) {
      this.audio.unlock();
      this.audio.playClick();
    }
    this.keys.clear();
    this.joystickX = 0;
    this.joystickY = 0;
    this.pointerActive = false;
    this.effects.clear();

    this.runDuration = getRunDurationForPerk(this.baseDuration, perk);
    this.timeRemaining = this.runDuration;
    this.elapsedTime = 0;
    this.hitstopTimer = 0;
    this.pendingEndTimer = 0;
    this.pendingEndSummary = null;
    this.lastUrgentSecond = 11;
    this.trauma = 0;
    this.activeEvent = null;
    this.safeZoneRadius = SAFE_ZONE_RADIUS;
    this.freezeTimer = 0;

    this.score = 0;
    this.savedTotal = 0;
    this.bestConvoy = 0;
    this.streakCount = 0;
    this.streakTimer = 0;
    this.maxStreak = 0;
    this.damageTaken = 0;
    this.breakdown = { normal: 0, fast: 0, golden: 0 };

    const startPhaseCfg = getPhaseForElapsed(this.phaseOffsetSeconds);
    this.currentPhase = startPhaseCfg.phase;
    this.weather.setPhase(startPhaseCfg.phase, true);
    this.bannerText = `PHASE ${startPhaseCfg.phase} · ${startPhaseCfg.label.toUpperCase()}`;
    this.bannerTimer = 2.2;

    this.player = {
      x: SAFE_ZONE_CENTER.x,
      y: SAFE_ZONE_CENTER.y,
      vx: 0,
      vy: 0,
      radius: 17,
      angle: 0,
      stamina: MAX_STAMINA,
      staminaGhost: MAX_STAMINA,
      exhausted: false,
      isRegenerating: false,
      hull: MAX_HULL,
      invulnTimer: 0.6,
      hitFlashTimer: 0,
      dashTimer: 0,
      dashCooldown: 0,
      dashBufferTimer: 0,
      dashDirX: 1,
      dashDirY: 0,
      dashGhostAccum: 0,
      interactCooldown: 0,
      interactPulseTimer: 0,
      empTimer: 0,
      shieldTimer: 0,
      speedBoostTimer: 0,
      scaleX: 1,
      scaleY: 1,
      fireBurnAccum: 0,
      inFire: false,
      inSafeZone: true,
    };

    this.items = [];
    this.carriedIds = [];
    this.powerUps = [];
    this.dashGhosts = [];
    this.debris = [];
    this.drones = [];
    this.fires = [];
    this.orbs = [];
    this.shockwaves = [];
    this.emps = [];

    this.debrisSpawnTimer = 1.9;
    this.shockwaveSpawnTimer = 3.8;
    this.empSpawnTimer = 2.2;
    this.fireSpawnTimer = 2.0;
    this.powerUpSpawnTimer = 6.0;

    this.spawnInitialSurvivors();

    this.setScreenState('playing');
    this.emitHud(true);
    this.updateDirectHudDom();
  }

  public pause(): void {
    if (this.screenState !== 'playing') return;
    this.keys.clear();
    this.joystickX = 0;
    this.joystickY = 0;
    this.pointerActive = false;
    this.setScreenState('paused');
  }

  public resume(): void {
    if (this.screenState !== 'paused') return;
    this.audio.unlock();
    this.audio.playClick();
    this.keys.clear();
    this.joystickX = 0;
    this.joystickY = 0;
    this.pointerActive = false;
    this.lastTimestamp = performance.now();
    this.setScreenState('playing');
  }

  public returnToTitle(): void {
    this.keys.clear();
    this.joystickX = 0;
    this.joystickY = 0;
    this.pointerActive = false;
    this.pendingEndTimer = 0;
    this.pendingEndSummary = null;
    this.currentPhase = this.initialPhase;
    this.weather.setPhase(this.initialPhase, true);
    this.seedTitleScene();
    this.setScreenState('title');
    this.emitHud(true);
  }

  public triggerDashInput(): void {
    if (this.screenState !== 'playing') return;
    this.audio.unlock();
    if (this.player.empTimer > 0) {
      this.effects.spawnText(this.player.x, this.player.y - 26, 'EMP JAMMED!', '#C084FC', 0.9, 0.65);
      return;
    }
    this.player.dashBufferTimer = 0.14;
  }

  public triggerInteractInput(): void {
    if (this.screenState !== 'playing') return;
    this.audio.unlock();
    const p = this.player;
    if (p.empTimer > 0) {
      this.effects.spawnText(p.x, p.y - 26, 'EMP JAMMED!', '#C084FC', 0.9, 0.65);
      return;
    }
    if (p.interactCooldown > 0 || p.stamina < INTERACT_STAMINA_COST) return;

    const radiusMult = this.activePerk === 'wide_pickup' ? 1.45 : 1.0;
    const effectiveRadius = INTERACT_RADIUS * radiusMult;

    p.interactCooldown = INTERACT_COOLDOWN;
    p.interactPulseTimer = 0.34;
    p.stamina = Math.max(0, p.stamina - INTERACT_STAMINA_COST);
    this.audio.playInteractPulse();
    this.effects.spawnRing(p.x, p.y, '#38BDF8', 22, 0.35);

    let snatched = 0;
    for (const item of this.items) {
      if (this.carriedIds.length >= MAX_CARRY_ITEMS) break;
      if (item.state === 'carried') continue;
      if (distanceSq(p.x, p.y, item.x, item.y) <= effectiveRadius * effectiveRadius) {
        item.state = 'carried';
        item.scatterTimer = 0;
        this.carriedIds.push(item.id);
        snatched += 1;
        this.effects.spawnBurst(item.x, item.y, 8, RESCUE_SPECS[item.kind].color, 45, 130, 2, 4.5, 0.32);
      }
    }

    if (snatched > 0) {
      this.audio.playPickup(this.carriedIds.length);
      this.effects.spawnText(
        p.x,
        p.y - 28,
        snatched > 1 ? `MAGNET GRAB x${snatched}!` : 'MAGNET GRAB!',
        '#38BDF8',
        1.0,
        0.85
      );
      this.emitHud(true);
    } else {
      this.effects.spawnText(p.x, p.y - 24, 'SCAN PULSE', '#7DD3FC', 0.8, 0.55);
      this.emitHud();
    }
  }

  public destroy(): void {
    this.destroyed = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.unbindEvents();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  private setScreenState(next: GameScreenState): void {
    this.screenState = next;
    this.needsStaticRender = true;
    this.syncBodyState();
    this.callbacks.onScreenChange(next);
  }

  private syncBodyState(): void {
    if (typeof document !== 'undefined' && document.body) {
      document.body.dataset.state = this.screenState;
      document.body.dataset.phase = String(this.currentPhase);
      document.body.dataset.weather = this.weather.getWeatherId();
    }
  }

  private seedTitleScene(): void {
    this.items = [];
    this.carriedIds = [];
    this.powerUps = [];
    this.dashGhosts = [];
    this.debris = [];
    this.drones = [];
    this.fires = [];
    this.orbs = [];
    this.shockwaves = [];
    this.emps = [];
    this.safeZoneRadius = SAFE_ZONE_RADIUS;
    this.effects.clear();
    this.player.x = SAFE_ZONE_CENTER.x;
    this.player.y = SAFE_ZONE_CENTER.y;
    this.player.angle = -0.35;
    this.spawnInitialSurvivors();
    this.spawnDrone(0);
    this.spawnDrone(1);
    this.spawnErraticOrb(145);
  }

  private spawnInitialSurvivors(): void {
    const presetSpots: Array<{ x: number; y: number; kind: RescueKind }> = [
      { x: SAFE_ZONE_CENTER.x + 205, y: SAFE_ZONE_CENTER.y - 24, kind: 'normal' },
      { x: SAFE_ZONE_CENTER.x - 215, y: SAFE_ZONE_CENTER.y + 42, kind: 'normal' },
      { x: SAFE_ZONE_CENTER.x + 80, y: SAFE_ZONE_CENTER.y - 210, kind: 'fast' },
      { x: SAFE_ZONE_CENTER.x - 95, y: SAFE_ZONE_CENTER.y + 215, kind: 'fast' },
      { x: 145, y: 135, kind: 'golden' },
      { x: WORLD_WIDTH - 145, y: WORLD_HEIGHT - 135, kind: 'golden' },
    ];
    for (const spot of presetSpots) {
      this.createRescueItem(spot.kind, spot.x, spot.y);
    }
  }

  private createRescueItem(kind: RescueKind, x: number, y: number): void {
    const spec = RESCUE_SPECS[kind];
    const ang = Math.random() * Math.PI * 2;
    this.items.push({
      id: this.nextEntityId++,
      kind,
      x,
      y,
      vx: spec.moveSpeed > 0 ? Math.cos(ang) * spec.moveSpeed : 0,
      vy: spec.moveSpeed > 0 ? Math.sin(ang) * spec.moveSpeed : 0,
      radius: spec.radius,
      weight: spec.weight,
      points: spec.points,
      state: 'waiting',
      pulsePhase: Math.random() * Math.PI * 2,
      scatterTimer: 0,
      wanderTimer: 1.0 + Math.random() * 1.4,
    });
  }

  private findSafeSpawnPoint(minDistFromCenter: number, minDistFromPlayer: number): { x: number; y: number } {
    for (let attempt = 0; attempt < 30; attempt++) {
      const x = 68 + Math.random() * (WORLD_WIDTH - 136);
      const y = 78 + Math.random() * (WORLD_HEIGHT - 156);
      if (distanceSq(x, y, SAFE_ZONE_CENTER.x, SAFE_ZONE_CENTER.y) < minDistFromCenter * minDistFromCenter) {
        continue;
      }
      if (distanceSq(x, y, this.player.x, this.player.y) < minDistFromPlayer * minDistFromPlayer) {
        continue;
      }
      let blocked = false;
      for (const rect of ARENA_OBSTACLES) {
        if (resolveCircleRectCollision(x, y, 28, rect).collided) {
          blocked = true;
          break;
        }
      }
      if (!blocked) return { x, y };
    }
    return { x: 140, y: 120 };
  }

  private spawnSurvivor(phase: 1 | 2 | 3 | 4, forcedKind?: RescueKind): void {
    const kind = forcedKind ?? pickRescueKind(phase, Math.random());
    // Golden high-value targets spawn further from the Safe Zone for risk-reward
    const minFromCenter = kind === 'golden' ? 300 : SAFE_ZONE_RADIUS + 85;
    const pos = this.findSafeSpawnPoint(minFromCenter, 110);
    this.createRescueItem(kind, pos.x, pos.y);
    this.effects.spawnRing(pos.x, pos.y, RESCUE_SPECS[kind].color, 10, 0.38);
  }

  private spawnPowerUp(): void {
    const kinds: PowerUpKind[] = ['speed', 'shield', 'freeze'];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const pos = this.findSafeSpawnPoint(210, 120);
    this.powerUps.push({
      id: this.nextEntityId++,
      kind,
      x: pos.x,
      y: pos.y,
      radius: 15,
      life: 13,
      pulsePhase: 0,
    });
    this.effects.spawnRing(pos.x, pos.y, POWERUP_SPECS[kind].color, 12, 0.42);
  }

  private spawnDebris(radius: number, telegraphDuration: number): void {
    let x = 0;
    let y = 0;
    const playerOutside = !isPointInSafeZone(this.player.x, this.player.y, 40, this.safeZoneRadius);
    if (playerOutside && Math.random() < 0.55) {
      const leadX = this.player.x + this.player.vx * 0.35 + (Math.random() - 0.5) * 110;
      const leadY = this.player.y + this.player.vy * 0.35 + (Math.random() - 0.5) * 110;
      const clamped = clampToArena(leadX, leadY, radius + 8);
      if (distanceSq(clamped.x, clamped.y, SAFE_ZONE_CENTER.x, SAFE_ZONE_CENTER.y) > HAZARD_EXCLUSION_RADIUS * HAZARD_EXCLUSION_RADIUS) {
        x = clamped.x;
        y = clamped.y;
      }
    }
    if (x === 0 && y === 0) {
      const pos = this.findSafeSpawnPoint(HAZARD_EXCLUSION_RADIUS, 60);
      x = pos.x;
      y = pos.y;
    }

    this.debris.push({
      id: this.nextEntityId++,
      x,
      y,
      radius,
      phase: 'telegraph',
      timer: telegraphDuration,
      duration: telegraphDuration,
      didHit: false,
    });
    this.audio.playTelegraph();
  }

  private spawnShockwave(expandSpeed: number): void {
    const pos = this.findSafeSpawnPoint(HAZARD_EXCLUSION_RADIUS + 40, 130);
    this.shockwaves.push({
      id: this.nextEntityId++,
      x: pos.x,
      y: pos.y,
      radius: 16,
      maxRadius: 310,
      ringThickness: 18,
      expandSpeed,
      phase: 'telegraph',
      timer: 0.78,
      duration: 0.78,
      didHit: false,
      didVaultBonus: false,
    });
    this.audio.playTelegraph();
  }

  private spawnErraticOrb(speed: number): void {
    const pos = this.findSafeSpawnPoint(HAZARD_EXCLUSION_RADIUS + 50, 180);
    const angle = Math.random() * Math.PI * 2;
    this.orbs.push({
      id: this.nextEntityId++,
      x: pos.x,
      y: pos.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      nextVx: Math.cos(angle) * speed,
      nextVy: Math.sin(angle) * speed,
      radius: 15,
      phase: 'drift',
      timer: 0.9 + Math.random() * 0.7,
      arcSeed: Math.random() * 100,
      hitCooldown: 0,
    });
    this.effects.spawnRing(pos.x, pos.y, '#A855F7', 10, 0.35);
  }

  private spawnEmp(radius: number): void {
    let x = 0;
    let y = 0;
    const playerOutside = !isPointInSafeZone(this.player.x, this.player.y, 45, this.safeZoneRadius);
    if (playerOutside && Math.random() < 0.6) {
      const clamped = clampToArena(
        this.player.x + this.player.vx * 0.25 + (Math.random() - 0.5) * 90,
        this.player.y + this.player.vy * 0.25 + (Math.random() - 0.5) * 90,
        radius * 0.65
      );
      if (distanceSq(clamped.x, clamped.y, SAFE_ZONE_CENTER.x, SAFE_ZONE_CENTER.y) > HAZARD_EXCLUSION_RADIUS * HAZARD_EXCLUSION_RADIUS) {
        x = clamped.x;
        y = clamped.y;
      }
    }
    if (x === 0 && y === 0) {
      const pos = this.findSafeSpawnPoint(HAZARD_EXCLUSION_RADIUS + 20, 75);
      x = pos.x;
      y = pos.y;
    }

    this.emps.push({
      id: this.nextEntityId++,
      x,
      y,
      radius,
      phase: 'telegraph',
      timer: 0.85,
      duration: 0.85,
      didJam: false,
    });
    this.audio.playTelegraph();
  }

  private spawnDrone(slotIndex: number): void {
    const lanes: Array<{
      x: number;
      y: number;
      axis: 'x' | 'y';
      min: number;
      max: number;
      dir: 1 | -1;
    }> = [
      { x: 140, y: 105, axis: 'x', min: 100, max: WORLD_WIDTH - 100, dir: 1 },
      { x: WORLD_WIDTH - 140, y: WORLD_HEIGHT - 105, axis: 'x', min: 100, max: WORLD_WIDTH - 100, dir: -1 },
      { x: 110, y: 200, axis: 'y', min: 110, max: WORLD_HEIGHT - 110, dir: 1 },
      { x: WORLD_WIDTH - 110, y: WORLD_HEIGHT - 200, axis: 'y', min: 110, max: WORLD_HEIGHT - 110, dir: -1 },
    ];
    const lane = lanes[slotIndex % lanes.length];
    this.drones.push({
      id: this.nextEntityId++,
      x: lane.x,
      y: lane.y,
      vx: 0,
      vy: 0,
      radius: 17,
      angle: lane.axis === 'x' ? (lane.dir > 0 ? 0 : Math.PI) : lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2,
      behavior: 'patrol',
      stateTimer: 0,
      patrolAxis: lane.axis,
      patrolDir: lane.dir,
      patrolMin: lane.min,
      patrolMax: lane.max,
      chargeDirX: 1,
      chargeDirY: 0,
      hitCooldown: 0,
    });
    this.effects.spawnRing(lane.x, lane.y, '#EF4444', 10, 0.4);
  }

  private spawnFire(): void {
    const pos = this.findSafeSpawnPoint(HAZARD_EXCLUSION_RADIUS + 20, 95);
    this.fires.push({
      id: this.nextEntityId++,
      x: pos.x,
      y: pos.y,
      radius: 18,
      maxRadius: 72 + Math.random() * 24,
      phase: 'telegraph',
      timer: 0.65,
      life: 11.5,
      maxLife: 11.5,
    });
    this.audio.playTelegraph();
  }

  // Event listeners
  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(this.canvas.parentElement ?? this.canvas);
    } else {
      window.addEventListener('resize', this.handleResize);
    }
  }

  private unbindEvents(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);

    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('resize', this.handleResize);
  }

  private handleResize = (): void => {
    const parent = this.canvas.parentElement;
    const width = parent ? parent.clientWidth : window.innerWidth;
    const height = parent ? parent.clientHeight : window.innerHeight;
    if (width <= 0 || height <= 0) return;

    this.viewW = width;
    this.viewH = height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.needsStaticRender = true;
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const code = e.code;
    if (
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight' ||
      code === 'Space'
    ) {
      e.preventDefault();
    }

    if (this.screenState === 'playing') {
      this.audio.unlock();
      if (code === 'Space' && !e.repeat) {
        this.triggerDashInput();
      }
      if ((code === 'KeyE' || code === 'ShiftLeft' || code === 'ShiftRight') && !e.repeat) {
        this.triggerInteractInput();
      }
      if ((code === 'Escape' || code === 'KeyP') && !e.repeat) {
        this.pause();
        return;
      }
      this.keys.add(code);
    } else if (this.screenState === 'paused') {
      if ((code === 'Escape' || code === 'KeyP') && !e.repeat) {
        this.resume();
      }
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onWindowBlur = (): void => {
    this.keys.clear();
    this.joystickX = 0;
    this.joystickY = 0;
    this.pointerActive = false;
  };

  private onVisibilityChange = (): void => {
    if (document.hidden) {
      this.keys.clear();
      this.joystickX = 0;
      this.joystickY = 0;
      this.pointerActive = false;
    }
  };

  private onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const wx = (sx - this.viewW * 0.5) / this.camScale + this.camX;
    const wy = (sy - this.viewH * 0.5) / this.camScale + this.camY;
    return { x: wx, y: wy };
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (this.screenState !== 'playing') return;
    // Touch screens use the dedicated Virtual Joystick & Action Buttons
    if (e.pointerType === 'touch') return;
    this.audio.unlock();
    if (e.button === 2) {
      this.triggerDashInput();
      return;
    }
    this.pointerActive = true;
    this.pointerClientX = e.clientX;
    this.pointerClientY = e.clientY;
    const world = this.screenToWorld(e.clientX, e.clientY);
    this.pointerWorldX = world.x;
    this.pointerWorldY = world.y;
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.pointerActive) return;
    this.pointerClientX = e.clientX;
    this.pointerClientY = e.clientY;
  };

  private onPointerUp = (): void => {
    this.pointerActive = false;
  };

  // Main 60fps loop
  private loop = (now: number): void => {
    if (this.destroyed) return;
    const rawDt = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;
    const dt = Math.min(Math.max(rawDt, 0), 0.05);

    if (this.screenState === 'title') {
      this.ambientTime += dt;
      this.updateCamera(dt);
      this.updateTitleAmbient(dt);
      this.render();
    } else if (this.screenState === 'playing') {
      this.ambientTime += dt;
      this.updateCamera(dt);
      this.updatePlaying(dt);
      this.render();
    } else if (this.needsStaticRender) {
      this.needsStaticRender = false;
      this.render();
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  private updateCamera(dt: number): void {
    const hudSafeTop = this.viewW < 640 ? 102 : 84;
    const hudSafeBottom = this.viewW < 820 ? 128 : 34;
    const availW = this.viewW - 24;
    const availH = this.viewH - hudSafeTop - hudSafeBottom;
    const fitScale = Math.min(availW / WORLD_WIDTH, Math.max(0.35, availH / WORLD_HEIGHT));

    const isNarrow = this.viewW < 820;
    const targetScale = isNarrow ? Math.max(fitScale, Math.min(0.78, this.viewW / 600)) : Math.min(1.12, fitScale);
    this.camScale = targetScale;

    let desiredX = SAFE_ZONE_CENTER.x;
    let desiredY = SAFE_ZONE_CENTER.y - ((hudSafeTop - hudSafeBottom) * 0.25) / Math.max(0.4, this.camScale);

    if (this.screenState === 'title') {
      desiredX = SAFE_ZONE_CENTER.x + Math.sin(this.ambientTime * 0.28) * 32;
      desiredY = SAFE_ZONE_CENTER.y + Math.cos(this.ambientTime * 0.22) * 18;
    } else if (isNarrow) {
      const halfVisW = (this.viewW * 0.5) / this.camScale;
      const halfVisH = (this.viewH * 0.5) / this.camScale;
      desiredX = Math.max(halfVisW - 20, Math.min(WORLD_WIDTH - halfVisW + 20, this.player.x));
      desiredY = Math.max(
        halfVisH - hudSafeTop / this.camScale,
        Math.min(WORLD_HEIGHT - halfVisH + hudSafeBottom / this.camScale, this.player.y)
      );
    }

    const followLerp = 1 - Math.exp(-8 * dt);
    this.camX += (desiredX - this.camX) * followLerp;
    this.camY += (desiredY - this.camY) * followLerp;
    this.trauma = Math.max(0, this.trauma - dt * 2.2);
  }

  private updateTitleAmbient(dt: number): void {
    this.weather.update(dt, 0.72);
    for (const item of this.items) {
      item.pulsePhase += dt * 3.2;
    }
    for (const drone of this.drones) {
      const speed = 95;
      if (drone.patrolAxis === 'x') {
        drone.x += drone.patrolDir * speed * dt;
        if (drone.x > drone.patrolMax) {
          drone.x = drone.patrolMax;
          drone.patrolDir = -1;
        } else if (drone.x < drone.patrolMin) {
          drone.x = drone.patrolMin;
          drone.patrolDir = 1;
        }
        drone.angle = drone.patrolDir > 0 ? 0 : Math.PI;
      }
    }
    for (const orb of this.orbs) {
      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;
      if (orb.x < 60 || orb.x > WORLD_WIDTH - 60) orb.vx *= -1;
      if (orb.y < 60 || orb.y > WORLD_HEIGHT - 60) orb.vy *= -1;
    }
  }

  private updatePlaying(dt: number): void {
    this.weather.update(dt, this.freezeTimer > 0 ? 0.16 : 1);
    this.effects.update(dt);

    // Fade dash afterimages
    for (let i = this.dashGhosts.length - 1; i >= 0; i--) {
      this.dashGhosts[i].alpha -= dt * 3.8;
      if (this.dashGhosts[i].alpha <= 0) {
        this.dashGhosts.splice(i, 1);
      }
    }

    this.player.hitFlashTimer = Math.max(0, this.player.hitFlashTimer - dt);
    const squashLerp = 1 - Math.exp(-14 * dt);
    this.player.scaleX += (1 - this.player.scaleX) * squashLerp;
    this.player.scaleY += (1 - this.player.scaleY) * squashLerp;

    if (this.bannerTimer > 0) {
      this.bannerTimer = Math.max(0, this.bannerTimer - dt);
      if (this.bannerTimer === 0) {
        this.bannerText = null;
        this.emitHud();
      }
    }

    if (this.pendingEndSummary) {
      this.pendingEndTimer -= dt;
      if (this.pendingEndTimer <= 0) {
        const summary = this.pendingEndSummary;
        this.pendingEndSummary = null;
        this.setScreenState('gameover');
        this.callbacks.onRunEnd(summary);
      }
      this.updateDirectHudDom();
      return;
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      return;
    }

    // Freeze Timer power-up pauses the countdown clock & freezes hazards for 3s!
    const isFrozen = this.freezeTimer > 0;
    if (isFrozen) {
      this.freezeTimer = Math.max(0, this.freezeTimer - dt);
    } else {
      this.elapsedTime += dt;
      this.timeRemaining = Math.max(0, this.runDuration - this.elapsedTime);
    }

    // Streak decay timer
    if (this.streakTimer > 0) {
      this.streakTimer = Math.max(0, this.streakTimer - dt);
      if (this.streakTimer === 0 && this.streakCount > 0) {
        this.streakCount = 0;
        this.emitHud();
      }
    }

    // Smooth Safe Zone radius interpolation (shrinks during shrinking_zone event)
    const targetZoneR = this.activeEvent === 'shrinking_zone' ? SHRUNK_SAFE_ZONE_RADIUS : SAFE_ZONE_RADIUS;
    this.safeZoneRadius += (targetZoneR - this.safeZoneRadius) * (1 - Math.exp(-4 * dt));

    // Final 10-second urgent ticks
    if (!isFrozen && this.timeRemaining > 0 && this.timeRemaining <= 10) {
      const ceilSec = Math.ceil(this.timeRemaining);
      if (ceilSec < this.lastUrgentSecond) {
        this.lastUrgentSecond = ceilSec;
        this.audio.playTickUrgent(ceilSec <= 3);
      }
    }

    // 15-Second Escalation & Arena Events (triggered at 15s, 30s, 45s elapsed / 45s, 30s, 15s left)
    const phaseCfg = getPhaseForElapsed(this.elapsedTime + this.phaseOffsetSeconds);
    if (phaseCfg.phase !== this.currentPhase) {
      this.currentPhase = phaseCfg.phase;
      this.weather.setPhase(phaseCfg.phase, false);
      this.syncBodyState();
      const nextEvent = pickArenaEvent(
        phaseCfg.phase as 2 | 3 | 4,
        Math.random(),
        this.activeEvent
      );
      this.activeEvent = nextEvent;
      const evInfo = ARENA_EVENTS[nextEvent];
      this.bannerText = `EVENT · ${evInfo.label} — ${evInfo.subtitle.toUpperCase()}`;
      this.bannerTimer = 3.2;
      this.audio.playPhaseUp(phaseCfg.phase);
      this.trauma = Math.min(1, this.trauma + 0.36);

      // Bonus Golden Targets spawn on 30s/15s or extra_hazards / shrinking_zone twists
      if (nextEvent === 'extra_hazards' || nextEvent === 'shrinking_zone' || phaseCfg.phase >= 3) {
        this.spawnSurvivor(phaseCfg.phase, 'golden');
      }
      this.emitHud(true);
    }

    if (this.timeRemaining <= 0) {
      this.finishRun();
      return;
    }

    if (this.pointerActive) {
      const world = this.screenToWorld(this.pointerClientX, this.pointerClientY);
      this.pointerWorldX = world.x;
      this.pointerWorldY = world.y;
    }

    this.updatePlayer(dt);
    this.updateItems(dt, phaseCfg.targetSurvivors);
    this.updatePowerUps(dt);

    // Hazards pause cleanly while Time Freeze is active!
    if (!isFrozen) {
      const hazardRateMult = this.activeEvent === 'extra_hazards' ? 0.72 : 1.0;
      const extraCount = this.activeEvent === 'extra_hazards' ? 1 : 0;
      this.updateDebris(dt, phaseCfg.debrisInterval * hazardRateMult, phaseCfg.debrisRadius, phaseCfg.debrisTelegraph);
      this.updateShockwaves(dt, phaseCfg.shockwaveInterval * hazardRateMult, phaseCfg.shockwaveSpeed);
      this.updateDrones(dt, phaseCfg.targetDrones + extraCount, phaseCfg.droneSpeed);
      this.updateErraticOrbs(dt, phaseCfg.targetOrbs + extraCount, phaseCfg.orbSpeed);
      this.updateEmps(dt, phaseCfg.empInterval * hazardRateMult, phaseCfg.empRadius);
      this.updateFires(dt, phaseCfg.fireInterval * hazardRateMult, phaseCfg.maxFires + extraCount);
    }

    this.updateDirectHudDom();
    this.emitHud();
  }

  private getTotalCarryWeight(): number {
    let w = 0;
    for (const id of this.carriedIds) {
      const item = this.items.find((it) => it.id === id);
      if (item) w += item.weight;
    }
    return w;
  }

  private updatePlayer(dt: number): void {
    const p = this.player;
    p.invulnTimer = Math.max(0, p.invulnTimer - dt);
    p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    p.dashBufferTimer = Math.max(0, p.dashBufferTimer - dt);
    p.interactCooldown = Math.max(0, p.interactCooldown - dt);
    p.interactPulseTimer = Math.max(0, p.interactPulseTimer - dt);
    p.empTimer = Math.max(0, p.empTimer - dt);
    p.shieldTimer = Math.max(0, p.shieldTimer - dt);
    p.speedBoostTimer = Math.max(0, p.speedBoostTimer - dt);

    let ix = 0;
    let iy = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) iy -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) iy += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) ix -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) ix += 1;

    if (ix !== 0 || iy !== 0) {
      const len = Math.hypot(ix, iy);
      ix /= len;
      iy /= len;
    } else if (Math.hypot(this.joystickX, this.joystickY) > 0.01) {
      ix = this.joystickX;
      iy = this.joystickY;
    } else if (this.pointerActive) {
      const dx = this.pointerWorldX - p.x;
      const dy = this.pointerWorldY - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 16) {
        const strength = Math.min(1, (dist - 12) / 55);
        ix = (dx / dist) * strength;
        iy = (dy / dist) * strength;
      }
    }

    const carryWeight = this.getTotalCarryWeight();
    const isMovingIntent = Math.hypot(ix, iy) > 0.06;

    let standingInFire = false;
    for (const fire of this.fires) {
      if (fire.phase !== 'burning') continue;
      if (distanceSq(p.x, p.y, fire.x, fire.y) <= (fire.radius + p.radius * 0.5) ** 2) {
        standingInFire = true;
        break;
      }
    }
    p.inFire = standingInFire;
    p.inSafeZone = isPointInSafeZone(p.x, p.y, -4, this.safeZoneRadius);

    if (p.inSafeZone && p.empTimer > 0) {
      p.empTimer = 0;
      this.effects.spawnText(p.x, p.y - 26, 'EMP CLEARED', '#34D399', 0.9, 0.75);
    }

    // Buffered Dash / Vault trigger (visual trail + brief invulnerability + clears shockwaves)
    const dashCost = calculateDashCost(carryWeight);
    if (
      p.dashBufferTimer > 0 &&
      p.empTimer <= 0 &&
      p.dashCooldown <= 0 &&
      p.dashTimer <= 0 &&
      !p.exhausted &&
      p.stamina >= dashCost
    ) {
      p.dashBufferTimer = 0;
      p.dashTimer = DASH_DURATION;
      p.dashCooldown = DASH_COOLDOWN;
      p.dashGhostAccum = 0;
      p.stamina = Math.max(0, p.stamina - dashCost);
      p.scaleX = 1.28;
      p.scaleY = 0.76;

      if (isMovingIntent) {
        const len = Math.hypot(ix, iy);
        p.dashDirX = ix / len;
        p.dashDirY = iy / len;
      } else {
        p.dashDirX = Math.cos(p.angle);
        p.dashDirY = Math.sin(p.angle);
      }

      this.audio.playDash();
      this.effects.spawnBurst(p.x, p.y, 10, '#F97316', 60, 175, 2.5, 5, 0.3, 'square');
      this.effects.spawnRing(p.x, p.y, '#FB923C', 14, 0.28);
    }

    const wasDashing = p.dashTimer > 0;
    if (p.dashTimer > 0) {
      p.dashTimer = Math.max(0, p.dashTimer - dt);
      p.dashGhostAccum += dt;
      if (p.dashGhostAccum >= 0.04) {
        p.dashGhostAccum = 0;
        this.dashGhosts.push({ x: p.x, y: p.y, angle: p.angle, alpha: 0.58 });
      }
      if (p.dashTimer === 0 && wasDashing) {
        p.scaleX = 1.18;
        p.scaleY = 0.82;
      }
    }

    const isDashing = p.dashTimer > 0;

    // Step Stamina System
    const staminaNext = stepStaminaState({
      stamina: p.stamina,
      exhausted: p.exhausted,
      isMoving: isMovingIntent || isDashing,
      carryingCount: this.carriedIds.length,
      inFire: p.inFire,
      inSafeZone: p.inSafeZone,
      isDashing,
      speedBoostActive: p.speedBoostTimer > 0,
      dt,
    });
    if (!p.exhausted && staminaNext.exhausted) {
      this.effects.spawnText(p.x, p.y - 28, 'EXHAUSTED!', '#F59E0B', 0.95, 0.85);
    }
    p.stamina = staminaNext.stamina;
    p.exhausted = staminaNext.exhausted;
    p.isRegenerating = staminaNext.isRegenerating;

    if (p.inFire && !isDashing && p.stamina <= 1) {
      p.fireBurnAccum += dt;
      if (p.fireBurnAccum >= 0.9) {
        p.fireBurnAccum = 0;
        this.damagePlayer(p.x + (Math.random() - 0.5) * 20, p.y + (Math.random() - 0.5) * 20, 'OVERHEAT!');
      }
    } else {
      p.fireBurnAccum = Math.max(0, p.fireBurnAccum - dt * 1.6);
    }

    if (p.staminaGhost > p.stamina) {
      p.staminaGhost = Math.max(p.stamina, p.staminaGhost - dt * 42);
    } else {
      p.staminaGhost = p.stamina;
    }

    const speed = calculateMoveSpeed(carryWeight, p.inFire, isDashing, p.exhausted, {
      perk: this.activePerk,
      speedBoostActive: p.speedBoostTimer > 0,
      speedSurgeEvent: this.activeEvent === 'speed_surge',
    });

    const targetVx = isDashing ? p.dashDirX * speed : ix * speed;
    const targetVy = isDashing ? p.dashDirY * speed : iy * speed;

    const accel = isDashing ? 24 : 15;
    const blend = 1 - Math.exp(-accel * dt);
    p.vx += (targetVx - p.vx) * blend;
    p.vy += (targetVy - p.vy) * blend;

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    const clamped = clampToArena(p.x, p.y, p.radius);
    p.x = clamped.x;
    p.y = clamped.y;

    for (const rect of ARENA_OBSTACLES) {
      const res = resolveCircleRectCollision(p.x, p.y, p.radius, rect);
      p.x = res.x;
      p.y = res.y;
    }

    if (Math.hypot(p.vx, p.vy) > 18) {
      const targetAngle = Math.atan2(p.vy, p.vx);
      let diff = targetAngle - p.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      p.angle += diff * (1 - Math.exp(-16 * dt));
    }

    if (p.inSafeZone && this.carriedIds.length > 0) {
      this.bankCarriedItems();
    }
  }

  private bankCarriedItems(): void {
    const bankedItems: RescueItem[] = [];
    const carriedSet = new Set(this.carriedIds);
    const remainingItems: RescueItem[] = [];

    for (const item of this.items) {
      if (carriedSet.has(item.id)) {
        bankedItems.push(item);
      } else {
        remainingItems.push(item);
      }
    }

    this.items = remainingItems;
    this.carriedIds = [];

    // Advance consecutive Save Streak!
    this.streakCount = this.streakTimer > 0 ? this.streakCount + 1 : 1;
    this.streakTimer = STREAK_WINDOW_SECONDS;
    this.maxStreak = Math.max(this.maxStreak, this.streakCount);

    const kinds = bankedItems.map((it) => it.kind);
    const doublePoints = this.activeEvent === 'double_points';
    const result = calculateBankScore(kinds, this.streakCount, doublePoints);

    this.score += result.points;
    this.savedTotal += bankedItems.length;
    this.bestConvoy = Math.max(this.bestConvoy, bankedItems.length);

    for (const item of bankedItems) {
      this.breakdown[item.kind] += 1;
      this.effects.spawnBurst(
        item.x,
        item.y,
        14,
        RESCUE_SPECS[item.kind].color,
        65,
        195,
        2.5,
        5.5,
        0.48
      );
    }

    this.player.stamina = Math.min(MAX_STAMINA, this.player.stamina + 35);
    if (this.player.stamina >= 18) {
      this.player.exhausted = false;
    }

    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      writeStoredBestScore(this.bestScore);
    }

    const multTag = result.totalMultiplier > 1 ? ` · ${result.totalMultiplier.toFixed(1).replace('.0', '')}x` : '';
    this.effects.spawnText(
      SAFE_ZONE_CENTER.x,
      SAFE_ZONE_CENTER.y - 18,
      `+${result.points}${multTag}`,
      '#34D399',
      result.totalMultiplier >= 2 ? 1.38 : 1.15,
      1.15
    );
    if (this.streakCount >= 2) {
      this.effects.spawnText(
        SAFE_ZONE_CENTER.x,
        SAFE_ZONE_CENTER.y - 44,
        `${getStreakMultiplier(this.streakCount)}x STREAK!`,
        '#FBBF24',
        1.05,
        1.0
      );
    }
    this.effects.spawnRing(SAFE_ZONE_CENTER.x, SAFE_ZONE_CENTER.y, '#10B981', 36, 0.45);
    this.audio.playBank(bankedItems.length, this.streakCount);
    this.emitHud(true);
  }

  private updateItems(dt: number, targetSurvivors: number): void {
    const p = this.player;
    const waitingCount = this.items.filter((it) => it.state !== 'carried').length;
    if (waitingCount < targetSurvivors) {
      this.spawnSurvivor(this.currentPhase);
    }

    const pickupBonus = this.activePerk === 'wide_pickup' ? 22 : 11;

    for (const item of this.items) {
      item.pulsePhase += dt * 4;

      if (item.state === 'scattered') {
        item.x += item.vx * dt;
        item.y += item.vy * dt;
        const drag = Math.pow(0.05, dt);
        item.vx *= drag;
        item.vy *= drag;
        const clamped = clampToArena(item.x, item.y, item.radius + 6);
        item.x = clamped.x;
        item.y = clamped.y;
        for (const rect of ARENA_OBSTACLES) {
          const res = resolveCircleRectCollision(item.x, item.y, item.radius, rect);
          item.x = res.x;
          item.y = res.y;
        }
        item.scatterTimer -= dt;
        if (item.scatterTimer <= 0) {
          item.state = 'waiting';
        }
      } else if (item.state === 'waiting' && item.kind === 'fast') {
        // Fast / Moving Target actively darts around outer sectors!
        item.wanderTimer -= dt;
        if (item.wanderTimer <= 0) {
          item.wanderTimer = 1.1 + Math.random() * 1.4;
          const ang = Math.random() * Math.PI * 2;
          const spd = RESCUE_SPECS.fast.moveSpeed;
          item.vx = Math.cos(ang) * spd;
          item.vy = Math.sin(ang) * spd;
        }
        item.x += item.vx * dt;
        item.y += item.vy * dt;

        if (item.x < 52 || item.x > WORLD_WIDTH - 52) {
          item.vx *= -1;
          item.x = Math.max(52, Math.min(WORLD_WIDTH - 52, item.x));
        }
        if (item.y < 58 || item.y > WORLD_HEIGHT - 58) {
          item.vy *= -1;
          item.y = Math.max(58, Math.min(WORLD_HEIGHT - 58, item.y));
        }
        // Keep fast targets outside the Safe Zone so you must catch them
        const distSafe = Math.hypot(item.x - SAFE_ZONE_CENTER.x, item.y - SAFE_ZONE_CENTER.y);
        const minSafe = this.safeZoneRadius + 44;
        if (distSafe < minSafe) {
          const nx = (item.x - SAFE_ZONE_CENTER.x) / (distSafe || 1);
          const ny = (item.y - SAFE_ZONE_CENTER.y) / (distSafe || 1);
          item.x = SAFE_ZONE_CENTER.x + nx * minSafe;
          item.y = SAFE_ZONE_CENTER.y + ny * minSafe;
          item.vx = nx * RESCUE_SPECS.fast.moveSpeed;
          item.vy = ny * RESCUE_SPECS.fast.moveSpeed;
        }
        for (const rect of ARENA_OBSTACLES) {
          const res = resolveCircleRectCollision(item.x, item.y, item.radius, rect);
          if (res.collided) {
            item.x = res.x;
            item.y = res.y;
            item.vx *= -1;
            item.vy *= -1;
          }
        }
      }

      if (item.state === 'waiting' && this.carriedIds.length < MAX_CARRY_ITEMS) {
        const pickupDist = p.radius + item.radius + pickupBonus;
        if (distanceSq(p.x, p.y, item.x, item.y) <= pickupDist * pickupDist) {
          item.state = 'carried';
          this.carriedIds.push(item.id);
          this.audio.playPickup(this.carriedIds.length);
          this.effects.spawnBurst(item.x, item.y, 8, RESCUE_SPECS[item.kind].color, 45, 130, 2, 4.5, 0.3);
          this.effects.spawnText(
            item.x,
            item.y - 18,
            `${RESCUE_SPECS[item.kind].label.toUpperCase()} (+${item.points})`,
            RESCUE_SPECS[item.kind].color,
            0.84,
            0.75
          );
          this.emitHud();
        }
      }
    }

    let anchorX = p.x;
    let anchorY = p.y;
    for (let i = 0; i < this.carriedIds.length; i++) {
      const id = this.carriedIds[i];
      const item = this.items.find((it) => it.id === id);
      if (!item) continue;
      const desiredGap = i === 0 ? 34 : 26;
      const dx = item.x - anchorX;
      const dy = item.y - anchorY;
      const dist = Math.hypot(dx, dy) || 0.001;
      if (dist > desiredGap) {
        const pull = 1 - Math.exp(-15 * dt);
        item.x += (anchorX + (dx / dist) * desiredGap - item.x) * pull;
        item.y += (anchorY + (dy / dist) * desiredGap - item.y) * pull;
      }
      anchorX = item.x;
      anchorY = item.y;
    }
  }

  private updatePowerUps(dt: number): void {
    this.powerUpSpawnTimer -= dt;
    if (this.powerUpSpawnTimer <= 0 && this.powerUps.length < 2) {
      this.powerUpSpawnTimer = 9.5 + Math.random() * 3.5;
      this.spawnPowerUp();
    }

    const p = this.player;
    const grabBonus = this.activePerk === 'wide_pickup' ? 20 : 10;

    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const pu = this.powerUps[i];
      pu.life -= dt;
      pu.pulsePhase += dt * 4.5;
      if (pu.life <= 0) {
        this.powerUps.splice(i, 1);
        continue;
      }

      const pickupDist = p.radius + pu.radius + grabBonus;
      if (distanceSq(p.x, p.y, pu.x, pu.y) <= pickupDist * pickupDist) {
        const spec = POWERUP_SPECS[pu.kind];
        this.audio.playPowerUp();
        this.effects.spawnBurst(pu.x, pu.y, 14, spec.color, 60, 170, 2.5, 5, 0.4);
        this.effects.spawnRing(pu.x, pu.y, spec.color, 18, 0.35);

        if (pu.kind === 'speed') {
          p.speedBoostTimer = SPEED_BOOST_DURATION;
          p.stamina = Math.min(MAX_STAMINA, p.stamina + 40);
          p.exhausted = false;
          this.effects.spawnText(p.x, p.y - 28, 'SPEED BOOST!', spec.color, 1.08, 1.0);
        } else if (pu.kind === 'shield') {
          p.shieldTimer = SHIELD_DURATION;
          this.effects.spawnText(p.x, p.y - 28, 'SHIELD ONLINE!', spec.color, 1.08, 1.0);
        } else {
          this.freezeTimer = FREEZE_TIMER_DURATION;
          this.effects.spawnText(p.x, p.y - 28, 'TIME FROZEN 3s!', spec.color, 1.12, 1.05);
        }

        this.powerUps.splice(i, 1);
        this.emitHud(true);
      }
    }
  }

  private updateDebris(
    dt: number,
    interval: number,
    radius: number,
    telegraphDuration: number
  ): void {
    this.debrisSpawnTimer -= dt;
    if (this.debrisSpawnTimer <= 0) {
      this.debrisSpawnTimer = interval * (0.85 + Math.random() * 0.3);
      this.spawnDebris(radius, telegraphDuration);
    }

    const p = this.player;
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.timer -= dt;
      if (d.phase === 'telegraph' && d.timer <= 0) {
        d.phase = 'impact';
        d.timer = 0.22;
        d.duration = 0.22;
        this.audio.playImpact();
        this.trauma = Math.min(1, this.trauma + 0.36);
        this.effects.spawnBurst(d.x, d.y, 16, '#F59E0B', 65, 220, 3, 6.5, 0.45, 'square');
        this.effects.spawnRing(d.x, d.y, '#EF4444', d.radius * 0.4, 0.35);

        if (
          !d.didHit &&
          p.dashTimer <= 0 &&
          !p.inSafeZone &&
          distanceSq(p.x, p.y, d.x, d.y) <= (d.radius + p.radius * 0.7) ** 2
        ) {
          d.didHit = true;
          this.damagePlayer(d.x, d.y, 'DEBRIS HIT!');
        }
      } else if (d.phase === 'impact' && d.timer <= 0) {
        d.phase = 'rubble';
        d.timer = 3.0;
        d.duration = 3.0;
      } else if (d.phase === 'rubble' && d.timer <= 0) {
        this.debris.splice(i, 1);
      }
    }
  }

  private updateShockwaves(dt: number, interval: number, speed: number): void {
    this.shockwaveSpawnTimer -= dt;
    if (this.shockwaveSpawnTimer <= 0) {
      this.shockwaveSpawnTimer = interval * (0.88 + Math.random() * 0.24);
      this.spawnShockwave(speed);
    }

    const p = this.player;
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      if (sw.phase === 'telegraph') {
        sw.timer -= dt;
        if (sw.timer <= 0) {
          sw.phase = 'expanding';
          this.audio.playShockwave();
          this.trauma = Math.min(1, this.trauma + 0.24);
        }
      } else {
        sw.radius += sw.expandSpeed * dt;
        const dist = Math.hypot(p.x - sw.x, p.y - sw.y);
        const onRing = Math.abs(dist - sw.radius) <= sw.ringThickness + p.radius * 0.45;

        if (onRing && !p.inSafeZone) {
          if (p.dashTimer > 0) {
            if (!sw.didVaultBonus) {
              sw.didVaultBonus = true;
              this.score += VAULT_BONUS_POINTS;
              p.stamina = Math.min(MAX_STAMINA, p.stamina + 14);
              if (this.score > this.bestScore) {
                this.bestScore = this.score;
                writeStoredBestScore(this.bestScore);
              }
              this.audio.playVaultBonus();
              this.effects.spawnText(p.x, p.y - 30, `VAULT! +${VAULT_BONUS_POINTS}`, '#FBBF24', 1.05, 0.9);
              this.emitHud(true);
            }
          } else if (!sw.didHit) {
            sw.didHit = true;
            this.damagePlayer(sw.x, sw.y, 'SHOCKWAVE!');
          }
        }

        if (sw.radius >= sw.maxRadius) {
          this.shockwaves.splice(i, 1);
        }
      }
    }
  }

  private updateErraticOrbs(dt: number, targetOrbs: number, baseSpeed: number): void {
    while (this.orbs.length < targetOrbs) {
      this.spawnErraticOrb(baseSpeed);
    }

    const p = this.player;
    for (const orb of this.orbs) {
      orb.hitCooldown = Math.max(0, orb.hitCooldown - dt);
      orb.timer -= dt;

      if (orb.phase === 'drift') {
        orb.x += orb.vx * dt;
        orb.y += orb.vy * dt;

        if (orb.timer <= 0) {
          orb.phase = 'telegraph';
          orb.timer = 0.24;
          const erraticAngle = Math.random() * Math.PI * 2;
          const burstSpeed = baseSpeed * (1.05 + Math.random() * 0.35);
          orb.nextVx = Math.cos(erraticAngle) * burstSpeed;
          orb.nextVy = Math.sin(erraticAngle) * burstSpeed;
        }
      } else {
        orb.x += orb.vx * 0.12 * dt;
        orb.y += orb.vy * 0.12 * dt;
        if (orb.timer <= 0) {
          orb.phase = 'drift';
          orb.vx = orb.nextVx;
          orb.vy = orb.nextVy;
          orb.timer = 0.85 + Math.random() * 0.75;
          this.effects.spawnBurst(orb.x, orb.y, 5, '#38BDF8', 40, 100, 2, 3.5, 0.22);
        }
      }

      if (orb.x < 46) {
        orb.x = 46;
        orb.vx = Math.abs(orb.vx);
      } else if (orb.x > WORLD_WIDTH - 46) {
        orb.x = WORLD_WIDTH - 46;
        orb.vx = -Math.abs(orb.vx);
      }
      if (orb.y < 46) {
        orb.y = 46;
        orb.vy = Math.abs(orb.vy);
      } else if (orb.y > WORLD_HEIGHT - 46) {
        orb.y = WORLD_HEIGHT - 46;
        orb.vy = -Math.abs(orb.vy);
      }

      const distSafe = Math.hypot(orb.x - SAFE_ZONE_CENTER.x, orb.y - SAFE_ZONE_CENTER.y);
      const minSafe = this.safeZoneRadius + orb.radius + 14;
      if (distSafe < minSafe) {
        const nx = (orb.x - SAFE_ZONE_CENTER.x) / (distSafe || 1);
        const ny = (orb.y - SAFE_ZONE_CENTER.y) / (distSafe || 1);
        orb.x = SAFE_ZONE_CENTER.x + nx * minSafe;
        orb.y = SAFE_ZONE_CENTER.y + ny * minSafe;
        const speed = Math.hypot(orb.vx, orb.vy) || baseSpeed;
        orb.vx = nx * speed;
        orb.vy = ny * speed;
      }

      for (const rect of ARENA_OBSTACLES) {
        const res = resolveCircleRectCollision(orb.x, orb.y, orb.radius, rect);
        if (res.collided) {
          const pushX = res.x - orb.x;
          const pushY = res.y - orb.y;
          orb.x = res.x;
          orb.y = res.y;
          if (Math.abs(pushX) > Math.abs(pushY)) orb.vx *= -1;
          else orb.vy *= -1;
        }
      }

      if (
        p.dashTimer <= 0 &&
        !p.inSafeZone &&
        orb.hitCooldown <= 0 &&
        distanceSq(p.x, p.y, orb.x, orb.y) <= (p.radius + orb.radius - 1) ** 2
      ) {
        orb.hitCooldown = 1.0;
        this.damagePlayer(orb.x, orb.y, 'ARC SHOCK!');
      }
    }
  }

  private updateEmps(dt: number, interval: number, radius: number): void {
    if (interval < 100) {
      this.empSpawnTimer -= dt;
      if (this.empSpawnTimer <= 0) {
        this.empSpawnTimer = interval * (0.85 + Math.random() * 0.3);
        this.spawnEmp(radius);
      }
    }

    const p = this.player;
    for (let i = this.emps.length - 1; i >= 0; i--) {
      const emp = this.emps[i];
      emp.timer -= dt;
      if (emp.phase === 'telegraph' && emp.timer <= 0) {
        emp.phase = 'discharge';
        emp.timer = 0.28;
        emp.duration = 0.28;
        this.audio.playEmpJam();
        this.effects.spawnRing(emp.x, emp.y, '#C084FC', emp.radius * 0.35, 0.35);
        this.effects.spawnBurst(emp.x, emp.y, 14, '#A855F7', 55, 185, 2.5, 5, 0.4);

        if (
          !emp.didJam &&
          !p.inSafeZone &&
          distanceSq(p.x, p.y, emp.x, emp.y) <= (emp.radius + p.radius * 0.5) ** 2
        ) {
          emp.didJam = true;
          if (p.shieldTimer > 0) {
            p.shieldTimer = 0;
            this.audio.playShieldDeflect();
            this.effects.spawnText(p.x, p.y - 28, 'EMP BLOCKED!', '#34D399', 1.0, 0.9);
          } else {
            p.empTimer = EMP_JAM_DURATION;
            this.trauma = Math.min(1, this.trauma + 0.3);
            this.effects.spawnText(p.x, p.y - 30, 'ACTIONS JAMMED!', '#E879F9', 1.12, 1.1);
          }
          this.emitHud(true);
        }
      } else if (emp.phase === 'discharge' && emp.timer <= 0) {
        emp.phase = 'fade';
        emp.timer = 0.45;
        emp.duration = 0.45;
      } else if (emp.phase === 'fade' && emp.timer <= 0) {
        this.emps.splice(i, 1);
      }
    }
  }

  private updateDrones(dt: number, targetDrones: number, baseSpeed: number): void {
    while (this.drones.length < targetDrones) {
      this.spawnDrone(this.drones.length);
    }

    const p = this.player;
    const activeChargers = this.drones.filter(
      (dr) => dr.behavior === 'telegraph' || dr.behavior === 'charge'
    ).length;

    for (const drone of this.drones) {
      drone.hitCooldown = Math.max(0, drone.hitCooldown - dt);

      if (drone.behavior === 'patrol') {
        if (drone.patrolAxis === 'x') {
          drone.x += drone.patrolDir * baseSpeed * dt;
          if (drone.x >= drone.patrolMax) {
            drone.x = drone.patrolMax;
            drone.patrolDir = -1;
          } else if (drone.x <= drone.patrolMin) {
            drone.x = drone.patrolMin;
            drone.patrolDir = 1;
          }
          drone.angle = drone.patrolDir > 0 ? 0 : Math.PI;
        } else {
          drone.y += drone.patrolDir * baseSpeed * dt;
          if (drone.y >= drone.patrolMax) {
            drone.y = drone.patrolMax;
            drone.patrolDir = -1;
          } else if (drone.y <= drone.patrolMin) {
            drone.y = drone.patrolMin;
            drone.patrolDir = 1;
          }
          drone.angle = drone.patrolDir > 0 ? Math.PI / 2 : -Math.PI / 2;
        }

        const distToPlayer = Math.hypot(p.x - drone.x, p.y - drone.y);
        if (
          !p.inSafeZone &&
          distToPlayer < 290 &&
          drone.hitCooldown <= 0 &&
          activeChargers < 2
        ) {
          drone.behavior = 'telegraph';
          drone.stateTimer = 0.48;
          drone.chargeDirX = (p.x - drone.x) / (distToPlayer || 1);
          drone.chargeDirY = (p.y - drone.y) / (distToPlayer || 1);
          drone.angle = Math.atan2(drone.chargeDirY, drone.chargeDirX);
          this.audio.playTelegraph();
        }
      } else if (drone.behavior === 'telegraph') {
        drone.stateTimer -= dt;
        if (drone.stateTimer > 0.16) {
          const dx = p.x - drone.x;
          const dy = p.y - drone.y;
          const len = Math.hypot(dx, dy) || 1;
          drone.chargeDirX = dx / len;
          drone.chargeDirY = dy / len;
          drone.angle = Math.atan2(dy, dx);
        }
        if (drone.stateTimer <= 0) {
          drone.behavior = 'charge';
          drone.stateTimer = 0.58;
        }
      } else if (drone.behavior === 'charge') {
        drone.stateTimer -= dt;
        const chargeSpeed = baseSpeed * 2.25;
        drone.x += drone.chargeDirX * chargeSpeed * dt;
        drone.y += drone.chargeDirY * chargeSpeed * dt;

        const distSafe = Math.hypot(drone.x - SAFE_ZONE_CENTER.x, drone.y - SAFE_ZONE_CENTER.y);
        if (distSafe < this.safeZoneRadius + drone.radius + 10) {
          const nx = (drone.x - SAFE_ZONE_CENTER.x) / (distSafe || 1);
          const ny = (drone.y - SAFE_ZONE_CENTER.y) / (distSafe || 1);
          drone.x = SAFE_ZONE_CENTER.x + nx * (this.safeZoneRadius + drone.radius + 10);
          drone.y = SAFE_ZONE_CENTER.y + ny * (this.safeZoneRadius + drone.radius + 10);
          drone.behavior = 'recover';
          drone.stateTimer = 0.65;
        }

        const clamped = clampToArena(drone.x, drone.y, drone.radius + 8);
        if (clamped.x !== drone.x || clamped.y !== drone.y) {
          drone.x = clamped.x;
          drone.y = clamped.y;
          drone.behavior = 'recover';
          drone.stateTimer = 0.65;
        }

        for (const rect of ARENA_OBSTACLES) {
          const res = resolveCircleRectCollision(drone.x, drone.y, drone.radius, rect);
          if (res.collided) {
            drone.x = res.x;
            drone.y = res.y;
            drone.behavior = 'recover';
            drone.stateTimer = 0.65;
            this.effects.spawnBurst(drone.x, drone.y, 6, '#F59E0B', 40, 110, 2, 4, 0.25);
          }
        }

        if (drone.stateTimer <= 0) {
          drone.behavior = 'recover';
          drone.stateTimer = 0.6;
        }
      } else if (drone.behavior === 'recover') {
        drone.stateTimer -= dt;
        if (drone.stateTimer <= 0) {
          drone.behavior = 'patrol';
          drone.hitCooldown = 0.9;
        }
      }

      if (
        p.dashTimer <= 0 &&
        !p.inSafeZone &&
        distanceSq(p.x, p.y, drone.x, drone.y) <= (p.radius + drone.radius - 2) ** 2
      ) {
        this.damagePlayer(drone.x, drone.y, 'DRONE IMPACT!');
        drone.behavior = 'recover';
        drone.stateTimer = 0.9;
        drone.hitCooldown = 1.2;
      }
    }
  }

  private updateFires(dt: number, interval: number, maxFires: number): void {
    if (maxFires > 0) {
      this.fireSpawnTimer -= dt;
      if (this.fireSpawnTimer <= 0 && this.fires.length < maxFires) {
        this.fireSpawnTimer = interval * (0.85 + Math.random() * 0.3);
        this.spawnFire();
      }
    }

    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i];
      if (f.phase === 'telegraph') {
        f.timer -= dt;
        if (f.timer <= 0) {
          f.phase = 'burning';
          this.effects.spawnBurst(f.x, f.y, 10, '#F97316', 35, 110, 2.5, 5, 0.35);
        }
      } else if (f.phase === 'burning') {
        f.life -= dt;
        f.radius = Math.min(f.maxRadius, f.radius + dt * 15);
        if (f.life <= 1.2) {
          f.phase = 'fading';
        }
      } else {
        f.life -= dt;
        f.radius = Math.max(4, f.radius - dt * 28);
        if (f.life <= 0) {
          this.fires.splice(i, 1);
        }
      }
    }
  }

  private damagePlayer(sourceX: number, sourceY: number, callout: string): void {
    const p = this.player;
    if (p.invulnTimer > 0 || this.pendingEndSummary) return;

    // Energy Shield power-up absorbs the hit cleanly!
    if (p.shieldTimer > 0) {
      p.shieldTimer = 0;
      p.invulnTimer = 0.85;
      this.trauma = Math.min(1, this.trauma + 0.3);
      this.audio.playShieldDeflect();
      this.effects.spawnRing(p.x, p.y, '#10B981', 26, 0.38);
      this.effects.spawnBurst(p.x, p.y, 14, '#34D399', 70, 190, 2.5, 5, 0.38);
      this.effects.spawnText(p.x, p.y - 26, 'SHIELD ABSORBED!', '#34D399', 1.05, 0.9);
      this.emitHud(true);
      return;
    }

    p.hull = Math.max(0, p.hull - 1);
    this.damageTaken += 1;
    p.invulnTimer = 1.15;
    p.hitFlashTimer = 0.08;
    p.scaleX = 0.76;
    p.scaleY = 1.28;
    this.hitstopTimer = 0.055;
    this.trauma = Math.min(1, this.trauma + 0.72);

    const dx = p.x - sourceX;
    const dy = p.y - sourceY;
    const len = Math.hypot(dx, dy) || 1;
    p.vx = (dx / len) * 340;
    p.vy = (dy / len) * 340;

    const dropCount = Math.min(this.carriedIds.length, this.carriedIds.length >= 3 ? 2 : 1);
    for (let i = 0; i < dropCount; i++) {
      const droppedId = this.carriedIds.pop();
      if (droppedId === undefined) continue;
      const item = this.items.find((it) => it.id === droppedId);
      if (!item) continue;
      item.state = 'scattered';
      item.scatterTimer = 0.55;
      const ang = Math.random() * Math.PI * 2;
      item.vx = Math.cos(ang) * 210;
      item.vy = Math.sin(ang) * 210;
    }

    this.audio.playHurt();
    this.effects.spawnBurst(p.x, p.y, 18, '#EF4444', 80, 240, 3, 6, 0.45, 'square');
    this.effects.spawnText(p.x, p.y - 26, callout, '#F87171', 1.1, 0.95);
    this.emitHud(true);

    if (p.hull <= 0) {
      this.finishRun();
    }
  }

  private finishRun(): void {
    if (this.pendingEndSummary) return;
    const previousBest = readStoredBestScore();
    const summary = evaluateRunSummary({
      finalScore: this.score,
      previousBest,
      savedTotal: this.savedTotal,
      breakdown: this.breakdown,
      bestConvoy: this.bestConvoy,
      maxStreak: this.maxStreak,
      damageTaken: this.damageTaken,
      timeSurvived: Math.min(this.runDuration, this.elapsedTime),
      duration: this.runDuration,
      hullRemaining: this.player.hull,
      perkUsed: this.activePerk,
    });

    if (summary.bestScore > previousBest) {
      writeStoredBestScore(summary.bestScore);
      this.bestScore = summary.bestScore;
    }

    if (summary.outcome === 'victory') {
      this.audio.playVictory();
    } else {
      this.audio.playDefeat();
    }

    this.pendingEndSummary = summary;
    this.pendingEndTimer = 0.5;
    this.emitHud(true);
  }

  private updateDirectHudDom(): void {
    const { timerEl, staminaFillEl, staminaGhostEl, staminaLabelEl } = this.hudRefs;
    if (timerEl) {
      const formatted = `${this.timeRemaining.toFixed(1)}s`;
      if (formatted !== this.lastTimerText) {
        this.lastTimerText = formatted;
        timerEl.textContent = formatted;
      }
      const urgency =
        this.freezeTimer > 0
          ? 'frozen'
          : this.timeRemaining <= 10
          ? 'critical'
          : this.timeRemaining <= 15
          ? 'warning'
          : 'normal';
      if (urgency !== this.lastUrgency) {
        this.lastUrgency = urgency;
        timerEl.dataset.urgency = urgency;
      }
    }
    if (staminaFillEl) {
      const pct = Math.max(0, Math.min(1, this.player.stamina / MAX_STAMINA));
      const nextTransform = `scaleX(${pct.toFixed(2)})`;
      if (nextTransform !== this.lastStaminaScale) {
        this.lastStaminaScale = nextTransform;
        staminaFillEl.style.transform = nextTransform;
      }
    }
    if (staminaGhostEl) {
      const gPct = Math.max(0, Math.min(1, this.player.staminaGhost / MAX_STAMINA));
      const nextGhost = `scaleX(${gPct.toFixed(2)})`;
      if (nextGhost !== this.lastGhostScale) {
        this.lastGhostScale = nextGhost;
        staminaGhostEl.style.transform = nextGhost;
      }
    }
    if (staminaLabelEl) {
      const pctInt = `${Math.round(this.player.stamina)}%`;
      if (pctInt !== this.lastStaminaText) {
        this.lastStaminaText = pctInt;
        staminaLabelEl.textContent = pctInt;
      }
    }
  }

  private emitHud(force = false): void {
    const phaseCfg = getPhaseForElapsed(this.elapsedTime + this.phaseOffsetSeconds);
    const carryingCount = this.carriedIds.length;
    const comboMultiplier = getConvoyMultiplier(carryingCount);
    const streakMultiplier = getStreakMultiplier(this.streakCount);
    const empRounded = this.player.empTimer > 0 ? Math.ceil(this.player.empTimer * 10) / 10 : 0;
    const interactPct =
      Math.round(Math.max(0, Math.min(1, 1 - this.player.interactCooldown / INTERACT_COOLDOWN)) * 10) / 10;
    const dashPct =
      Math.round(Math.max(0, Math.min(1, 1 - this.player.dashCooldown / DASH_COOLDOWN)) * 10) / 10;
    const speedSec = this.player.speedBoostTimer > 0 ? Math.ceil(this.player.speedBoostTimer) : 0;
    const freezeSec = this.freezeTimer > 0 ? Math.ceil(this.freezeTimer) : 0;
    const activeEventLabel = this.activeEvent ? ARENA_EVENTS[this.activeEvent].label : null;

    const key = [
      this.score,
      this.savedTotal,
      carryingCount,
      this.streakCount,
      this.player.hull,
      phaseCfg.phase,
      activeEventLabel ?? '',
      this.bannerText ?? '',
      this.player.inFire ? 1 : 0,
      this.player.inSafeZone ? 1 : 0,
      this.player.exhausted ? 1 : 0,
      this.player.isRegenerating ? 1 : 0,
      empRounded.toFixed(1),
      interactPct.toFixed(1),
      dashPct.toFixed(1),
      this.player.shieldTimer > 0 ? 1 : 0,
      speedSec,
      freezeSec,
      this.bestScore,
    ].join('|');

    if (!force && key === this.lastHudKey) return;
    this.lastHudKey = key;

    this.callbacks.onHudChange({
      score: this.score,
      savedTotal: this.savedTotal,
      carryingCount,
      maxCarry: MAX_CARRY_ITEMS,
      comboMultiplier,
      streakCount: this.streakCount,
      streakMultiplier,
      hull: this.player.hull,
      maxHull: MAX_HULL,
      phase: phaseCfg.phase,
      phaseLabel: phaseCfg.label,
      activeEventLabel,
      bannerText: this.bannerText,
      inFire: this.player.inFire,
      inSafeZone: this.player.inSafeZone,
      exhausted: this.player.exhausted,
      isRegenerating: this.player.isRegenerating,
      empJammedSeconds: empRounded,
      interactCooldownPct: interactPct,
      dashCooldownPct: dashPct,
      hasShield: this.player.shieldTimer > 0,
      speedBoostSeconds: speedSec,
      freezeSeconds: freezeSec,
      bestScore: this.bestScore,
    });
  }

  // ==================== CANVAS 2D RENDERER ====================

  private render(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    ctx.fillStyle = '#09101C';
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    const shakeMag = this.trauma * this.trauma * 13;
    const shakeX = shakeMag > 0.1 ? (Math.random() * 2 - 1) * shakeMag : 0;
    const shakeY = shakeMag > 0.1 ? (Math.random() * 2 - 1) * shakeMag : 0;

    ctx.translate(this.viewW * 0.5 + shakeX, this.viewH * 0.5 + shakeY);
    ctx.scale(this.camScale, this.camScale);
    ctx.translate(-this.camX, -this.camY);

    this.renderArenaFloor(ctx);
    this.weather.renderBackground(ctx, this.freezeTimer > 0);
    this.renderSafeZone(ctx);
    this.renderFires(ctx);
    this.renderEmps(ctx);
    this.renderShockwaves(ctx);
    this.renderDebris(ctx);
    this.renderObstacles(ctx);
    this.renderPowerUps(ctx);
    this.renderItemsAndTethers(ctx);
    this.renderErraticOrbs(ctx);
    this.renderDrones(ctx);
    this.renderPointerGuide(ctx);
    this.renderDashGhosts(ctx);
    this.renderPlayer(ctx);
    this.effects.render(ctx);

    ctx.restore();

    if (this.screenState === 'playing') {
      this.renderScreenEdgeWarnings(ctx);
    }
  }

  private renderArenaFloor(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#0F1826';
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    ctx.fillStyle = '#131F30';
    ctx.fillRect(32, 32, WORLD_WIDTH - 64, WORLD_HEIGHT - 64);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.065)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const step = 64;
    for (let x = 64; x < WORLD_WIDTH; x += step) {
      ctx.moveTo(x, 28);
      ctx.lineTo(x, WORLD_HEIGHT - 28);
    }
    for (let y = 64; y < WORLD_HEIGHT; y += step) {
      ctx.moveTo(28, y);
      ctx.lineTo(WORLD_WIDTH - 28, y);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(SAFE_ZONE_CENTER.x, 42);
    ctx.lineTo(SAFE_ZONE_CENTER.x, WORLD_HEIGHT - 42);
    ctx.moveTo(42, SAFE_ZONE_CENTER.y);
    ctx.lineTo(WORLD_WIDTH - 42, SAFE_ZONE_CENTER.y);
    ctx.stroke();

    ctx.strokeStyle = '#33475F';
    ctx.lineWidth = 4;
    ctx.strokeRect(24, 24, WORLD_WIDTH - 48, WORLD_HEIGHT - 48);

    ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
    ctx.lineWidth = 3;
    const cLen = 36;
    const corners: Array<[number, number, number, number]> = [
      [24, 24, 1, 1],
      [WORLD_WIDTH - 24, 24, -1, 1],
      [24, WORLD_HEIGHT - 24, 1, -1],
      [WORLD_WIDTH - 24, WORLD_HEIGHT - 24, -1, -1],
    ];
    for (const [cx, cy, dx, dy] of corners) {
      ctx.beginPath();
      ctx.moveTo(cx, cy + dy * cLen);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + dx * cLen, cy);
      ctx.stroke();
    }
  }

  private renderSafeZone(ctx: CanvasRenderingContext2D): void {
    const cx = SAFE_ZONE_CENTER.x;
    const cy = SAFE_ZONE_CENTER.y;
    const r = this.safeZoneRadius;
    const pulse = 0.5 + 0.5 * Math.sin(this.ambientTime * 3.2);
    const hasCargo = this.carriedIds.length > 0;

    ctx.save();
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.14)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.arc(cx, cy, r + 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = hasCargo
      ? `rgba(16, 185, 129, ${0.18 + pulse * 0.09})`
      : 'rgba(16, 185, 129, 0.12)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = hasCargo ? '#34D399' : '#10B981';
    ctx.lineWidth = hasCargo ? 4 : 3;
    const rot = this.ambientTime * (hasCargo ? 0.9 : 0.4);
    for (let i = 0; i < 4; i++) {
      const a0 = rot + (i * Math.PI) / 2 + 0.14;
      const a1 = rot + ((i + 1) * Math.PI) / 2 - 0.14;
      ctx.beginPath();
      ctx.arc(cx, cy, r, a0, a1);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(52, 211, 153, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(52, 211, 153, 0.22)';
    ctx.fillRect(cx - 16, cy - 4.5, 32, 9);
    ctx.fillRect(cx - 4.5, cy - 16, 9, 32);

    if (this.screenState !== 'title') {
      ctx.fillStyle = 'rgba(167, 243, 208, 0.85)';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(hasCargo ? 'RETURN HERE' : 'SAFE ZONE', cx, cy + r - 16);
    }
    ctx.restore();
  }

  private renderObstacles(ctx: CanvasRenderingContext2D): void {
    for (const rect of ARENA_OBSTACLES) {
      ctx.fillStyle = 'rgba(4, 8, 15, 0.55)';
      ctx.fillRect(rect.x + 5, rect.y + 6, rect.w, rect.h);

      ctx.fillStyle = '#1E2D40';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

      ctx.fillStyle = '#2E435E';
      ctx.fillRect(rect.x, rect.y, rect.w, 6);

      ctx.strokeStyle = '#476182';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

      ctx.fillStyle = '#647F9F';
      ctx.fillRect(rect.x + 8, rect.y + rect.h * 0.5 - 2, 4, 4);
      ctx.fillRect(rect.x + rect.w - 12, rect.y + rect.h * 0.5 - 2, 4, 4);
    }
  }

  private renderPowerUps(ctx: CanvasRenderingContext2D): void {
    for (const pu of this.powerUps) {
      const spec = POWERUP_SPECS[pu.kind];
      const pulse = 0.5 + 0.5 * Math.sin(pu.pulsePhase);
      ctx.save();
      ctx.translate(pu.x, pu.y);

      ctx.strokeStyle = spec.color;
      ctx.globalAlpha = 0.35 + pulse * 0.45;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, pu.radius + 5 + pulse * 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Crisp hexagonal power-up pod
      ctx.fillStyle = '#0B1220';
      ctx.strokeStyle = spec.color;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 - Math.PI / 6;
        const px = Math.cos(a) * pu.radius;
        const py = Math.sin(a) * pu.radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = spec.color;
      ctx.font = '700 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(spec.short, 0, 0.5);
      ctx.restore();
    }
  }

  private renderShockwaves(ctx: CanvasRenderingContext2D): void {
    for (const sw of this.shockwaves) {
      ctx.save();
      if (sw.phase === 'telegraph') {
        const pct = Math.max(0, Math.min(1, 1 - sw.timer / sw.duration));
        ctx.fillStyle = `rgba(251, 191, 36, ${0.14 + pct * 0.16})`;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, 26 + pct * 22, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 2.4;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, 44 * (1 - pct * 0.5), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#FEF3C7';
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('DASH WAVE', sw.x, sw.y);
      } else {
        const alpha = Math.max(0.15, 1 - sw.radius / sw.maxRadius);
        ctx.strokeStyle = `rgba(251, 191, 36, ${alpha * 0.35})`;
        ctx.lineWidth = sw.ringThickness;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(253, 224, 71, ${alpha * 0.95})`;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private renderEmps(ctx: CanvasRenderingContext2D): void {
    for (const emp of this.emps) {
      ctx.save();
      if (emp.phase === 'telegraph') {
        const pct = Math.max(0, Math.min(1, 1 - emp.timer / emp.duration));
        ctx.fillStyle = `rgba(168, 85, 247, ${0.08 + pct * 0.14})`;
        ctx.beginPath();
        ctx.arc(emp.x, emp.y, emp.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#C084FC';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(emp.x, emp.y, emp.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = '#E879F9';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(emp.x, emp.y, Math.max(8, emp.radius * pct), 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#F3E8FF';
        ctx.font = '700 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('EMP JAM', emp.x, emp.y);
      } else {
        const alpha = Math.max(0, emp.timer / emp.duration);
        ctx.fillStyle = `rgba(192, 132, 252, ${emp.phase === 'discharge' ? 0.45 * alpha : 0.16 * alpha})`;
        ctx.beginPath();
        ctx.arc(emp.x, emp.y, emp.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(232, 121, 249, ${0.9 * alpha})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private renderErraticOrbs(ctx: CanvasRenderingContext2D): void {
    for (const orb of this.orbs) {
      ctx.save();
      if (orb.phase === 'telegraph') {
        const len = Math.hypot(orb.nextVx, orb.nextVy) || 1;
        const dx = orb.nextVx / len;
        const dy = orb.nextVy / len;
        ctx.strokeStyle = '#E879F9';
        ctx.lineWidth = 2.2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(orb.x, orb.y);
        ctx.lineTo(orb.x + dx * 72, orb.y + dy * 72);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.translate(orb.x, orb.y);

      ctx.strokeStyle = orb.phase === 'telegraph' ? '#F0ABFC' : '#38BDF8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const spikes = 8;
      for (let i = 0; i <= spikes; i++) {
        const ang = (i / spikes) * Math.PI * 2 + this.ambientTime * 6 + orb.arcSeed;
        const r = i % 2 === 0 ? orb.radius + 5 : orb.radius - 2;
        const px = Math.cos(ang) * r;
        const py = Math.sin(ang) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = '#3B0764';
      ctx.beginPath();
      ctx.arc(0, 0, orb.radius - 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#C084FC';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      ctx.fillStyle = '#E0F2FE';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private renderFires(ctx: CanvasRenderingContext2D): void {
    for (const f of this.fires) {
      ctx.save();
      if (f.phase === 'telegraph') {
        const progress = 1 - f.timer / 0.65;
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(f.x, f.y, 18 + progress * 46, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        const alpha = f.phase === 'fading' ? Math.max(0, f.life / 1.2) : 1;
        const flicker = 0.92 + 0.08 * Math.sin(this.ambientTime * 16 + f.id);
        const r = f.radius * flicker;

        ctx.fillStyle = `rgba(239, 68, 68, ${0.22 * alpha})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(249, 115, 22, ${0.42 * alpha})`;
        ctx.beginPath();
        for (let s = 0; s < 6; s++) {
          const ang = (s * Math.PI) / 3 + this.ambientTime * 0.7 + f.id;
          const sr = r * (0.58 + 0.14 * Math.sin(this.ambientTime * 9 + s * 2));
          const px = f.x + Math.cos(ang) * sr;
          const py = f.y + Math.sin(ang) * sr;
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = `rgba(251, 146, 60, ${0.8 * alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private renderDebris(ctx: CanvasRenderingContext2D): void {
    for (const d of this.debris) {
      ctx.save();
      if (d.phase === 'telegraph') {
        const pct = Math.max(0, Math.min(1, 1 - d.timer / d.duration));
        ctx.fillStyle = `rgba(245, 158, 11, ${0.08 + pct * 0.16})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(d.x, d.y, Math.max(4, d.radius * (1 - pct)), 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#FDE68A';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(d.x - 6, d.y - 6);
        ctx.lineTo(d.x + 6, d.y + 6);
        ctx.moveTo(d.x + 6, d.y - 6);
        ctx.lineTo(d.x - 6, d.y + 6);
        ctx.stroke();
      } else if (d.phase === 'impact') {
        const alpha = Math.max(0, d.timer / d.duration);
        ctx.fillStyle = `rgba(239, 68, 68, ${0.75 * alpha})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const alpha = Math.min(1, d.timer / 1.0) * 0.45;
        ctx.fillStyle = `rgba(15, 23, 35, ${alpha})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.radius * 0.72, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(148, 163, 184, ${alpha * 0.8})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private renderItemsAndTethers(ctx: CanvasRenderingContext2D): void {
    if (this.carriedIds.length > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.72)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(this.player.x, this.player.y);
      for (const id of this.carriedIds) {
        const item = this.items.find((it) => it.id === id);
        if (item) {
          ctx.lineTo(item.x, item.y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    for (const item of this.items) {
      const spec = RESCUE_SPECS[item.kind];
      const pulse = 0.5 + 0.5 * Math.sin(item.pulsePhase);

      ctx.save();
      ctx.translate(item.x, item.y);

      if (item.state === 'waiting') {
        ctx.strokeStyle = spec.color;
        ctx.globalAlpha = 0.28 + pulse * 0.4;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(0, 0, item.radius + 5 + pulse * 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = 'rgba(4, 8, 15, 0.5)';
      ctx.beginPath();
      ctx.arc(2, 3, item.radius, 0, Math.PI * 2);
      ctx.fill();

      if (item.kind === 'normal') {
        // Civilian (100 pts) — Cyan circular beacon
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = spec.color;
        ctx.stroke();

        ctx.fillStyle = spec.color;
        ctx.beginPath();
        ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (item.kind === 'fast') {
        // Fast Moving Target (200 pts) — Emerald sleek dart chevron
        const ang = Math.atan2(item.vy, item.vx);
        ctx.rotate(ang);
        ctx.fillStyle = '#064E3B';
        ctx.strokeStyle = spec.color;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(item.radius + 3, 0);
        ctx.lineTo(-item.radius + 1, -item.radius * 0.85);
        ctx.lineTo(-item.radius * 0.35, 0);
        ctx.lineTo(-item.radius + 1, item.radius * 0.85);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#A7F3D0';
        ctx.beginPath();
        ctx.arc(2, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Heavy Golden Target (350 pts) — Rich gold octagon core
        ctx.fillStyle = '#451A03';
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4 + Math.PI / 8;
          const px = Math.cos(a) * item.radius;
          const py = Math.sin(a) * item.radius;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FDE047';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  private renderDrones(ctx: CanvasRenderingContext2D): void {
    for (const drone of this.drones) {
      ctx.save();

      if (drone.behavior === 'telegraph') {
        const blink = Math.sin(this.ambientTime * 42) > 0;
        ctx.strokeStyle = blink ? '#EF4444' : '#F59E0B';
        ctx.lineWidth = 2.2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(drone.x, drone.y);
        ctx.lineTo(drone.x + drone.chargeDirX * 260, drone.y + drone.chargeDirY * 260);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.translate(drone.x, drone.y);
      ctx.rotate(drone.angle);

      ctx.fillStyle = 'rgba(4, 8, 15, 0.5)';
      ctx.beginPath();
      ctx.arc(3, 4, drone.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = drone.behavior === 'charge' ? '#DC2626' : '#1E293B';
      ctx.strokeStyle = drone.behavior === 'telegraph' ? '#FBBF24' : '#EF4444';
      ctx.lineWidth = 2.4;

      ctx.beginPath();
      ctx.moveTo(drone.radius + 3, 0);
      ctx.lineTo(-drone.radius + 2, -drone.radius * 0.85);
      ctx.lineTo(-drone.radius * 0.45, 0);
      ctx.lineTo(-drone.radius + 2, drone.radius * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = drone.behavior === 'telegraph' ? '#FEF08A' : '#FCA5A5';
      ctx.beginPath();
      ctx.arc(4, 0, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  private renderPointerGuide(ctx: CanvasRenderingContext2D): void {
    if (!this.pointerActive || this.screenState !== 'playing') return;
    const dx = this.pointerWorldX - this.player.x;
    const dy = this.pointerWorldY - this.player.y;
    if (Math.hypot(dx, dy) < 20) return;

    ctx.save();
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(this.player.x, this.player.y);
    ctx.lineTo(this.pointerWorldX, this.pointerWorldY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = 'rgba(249, 115, 22, 0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.pointerWorldX, this.pointerWorldY, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private renderDashGhosts(ctx: CanvasRenderingContext2D): void {
    const r = this.player.radius;
    for (const g of this.dashGhosts) {
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.angle);
      ctx.globalAlpha = Math.max(0, g.alpha * 0.65);
      ctx.fillStyle = '#FB923C';
      ctx.beginPath();
      ctx.moveTo(r + 4, 0);
      ctx.lineTo(4, -r + 2);
      ctx.lineTo(-r + 2, -r * 0.65);
      ctx.lineTo(-r + 5, 0);
      ctx.lineTo(-r + 2, r * 0.65);
      ctx.lineTo(4, r - 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  private renderPlayer(ctx: CanvasRenderingContext2D): void {
    const p = this.player;
    const dashArc =
      p.dashTimer > 0 ? Math.sin((1 - p.dashTimer / DASH_DURATION) * Math.PI) : 0;
    const altitudeLift = dashArc * 11;
    const dashScale = 1 + dashArc * 0.26;

    ctx.save();
    ctx.translate(p.x, p.y);

    if (p.interactPulseTimer > 0) {
      const progress = 1 - p.interactPulseTimer / 0.34;
      const alpha = 1 - progress;
      const radiusMult = this.activePerk === 'wide_pickup' ? 1.45 : 1.0;
      ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.85})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 24 + progress * (INTERACT_RADIUS * radiusMult - 24), 0, Math.PI * 2);
      ctx.stroke();
    }

    // Energy Shield bubble visual
    if (this.screenState === 'playing' && p.shieldTimer > 0) {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.14)';
      ctx.strokeStyle = '#34D399';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Return-to-Safe-Zone directional arrow
    if (this.screenState === 'playing' && this.carriedIds.length > 0 && !p.inSafeZone) {
      const angToSafe = Math.atan2(SAFE_ZONE_CENTER.y - p.y, SAFE_ZONE_CENTER.x - p.x);
      ctx.save();
      ctx.rotate(angToSafe);
      ctx.fillStyle = '#34D399';
      ctx.beginPath();
      ctx.moveTo(35, 0);
      ctx.lineTo(26, -5.5);
      ctx.lineTo(26, 5.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Diegetic Stamina Arc
    if (this.screenState === 'playing' && (p.stamina < 98 || p.exhausted)) {
      const pct = p.stamina / MAX_STAMINA;
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.72)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 7, -Math.PI / 2, Math.PI * 1.5);
      ctx.stroke();

      ctx.strokeStyle = p.exhausted
        ? '#EF4444'
        : p.isRegenerating
        ? '#34D399'
        : p.inFire
        ? '#F97316'
        : '#38BDF8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
      ctx.stroke();
    }

    if (this.screenState === 'playing' && p.empTimer > 0) {
      ctx.strokeStyle = Math.sin(this.ambientTime * 36) > 0 ? '#E879F9' : '#A855F7';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 13, this.ambientTime * 4, this.ambientTime * 4 + Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Ground drop shadow
    ctx.fillStyle = `rgba(4, 8, 15, ${0.55 - dashArc * 0.2})`;
    ctx.beginPath();
    ctx.ellipse(
      3,
      5 + altitudeLift * 0.5,
      p.radius * (1 - dashArc * 0.16),
      p.radius * (0.85 - dashArc * 0.14),
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    if (p.invulnTimer > 0 && Math.floor(p.invulnTimer * 18) % 2 === 0 && p.hitFlashTimer <= 0) {
      ctx.globalAlpha = 0.45;
    }

    ctx.translate(0, -altitudeLift);
    ctx.rotate(p.angle);
    ctx.scale(p.scaleX * dashScale, p.scaleY * dashScale);

    const speedMag = Math.hypot(p.vx, p.vy);
    if (speedMag > 35 || p.dashTimer > 0) {
      const flameLen = p.dashTimer > 0 ? 22 : 9 + (speedMag / 300) * 6;
      ctx.fillStyle =
        p.dashTimer > 0
          ? '#FDE047'
          : p.speedBoostTimer > 0
          ? '#38BDF8'
          : p.exhausted
          ? '#94A3B8'
          : '#F97316';
      ctx.beginPath();
      ctx.moveTo(-p.radius + 2, -6);
      ctx.lineTo(-p.radius - flameLen, 0);
      ctx.lineTo(-p.radius + 2, 6);
      ctx.closePath();
      ctx.fill();
    }

    const isHitFlash = p.hitFlashTimer > 0;
    ctx.fillStyle = isHitFlash ? '#FFFFFF' : '#F8FAFC';
    ctx.strokeStyle = isHitFlash ? '#FFFFFF' : '#0F172A';
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.moveTo(p.radius + 4, 0);
    ctx.lineTo(4, -p.radius + 2);
    ctx.lineTo(-p.radius + 2, -p.radius * 0.65);
    ctx.lineTo(-p.radius + 5, 0);
    ctx.lineTo(-p.radius + 2, p.radius * 0.65);
    ctx.lineTo(4, p.radius - 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (!isHitFlash) {
      ctx.fillStyle = p.speedBoostTimer > 0 ? '#38BDF8' : '#F97316';
      ctx.beginPath();
      ctx.moveTo(p.radius + 1, 0);
      ctx.lineTo(5, -7);
      ctx.lineTo(5, 7);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-5, -5.5, 8, 11);
      ctx.fillStyle = p.empTimer > 0 ? '#E879F9' : '#38BDF8';
      ctx.fillRect(-2, -3.5, 4, 7);
    }

    ctx.restore();

    if (this.screenState === 'playing') {
      ctx.save();
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(8, 14, 24, 0.9)';

      if (p.empTimer > 0) {
        const txt = `EMP JAM ${p.empTimer.toFixed(1)}s`;
        ctx.strokeText(txt, p.x, p.y + p.radius + 20);
        ctx.fillStyle = '#E879F9';
        ctx.fillText(txt, p.x, p.y + p.radius + 20);
      } else if (this.carriedIds.length >= 2) {
        const mult = getConvoyMultiplier(this.carriedIds.length);
        const label = `${this.carriedIds.length} TOW · ${mult.toFixed(1)}x`;
        ctx.strokeText(label, p.x, p.y + p.radius + 20);
        ctx.fillStyle = '#34D399';
        ctx.fillText(label, p.x, p.y + p.radius + 20);
      }
      ctx.restore();
    }
  }

  private renderScreenEdgeWarnings(ctx: CanvasRenderingContext2D): void {
    const finalTen = this.timeRemaining > 0 && this.timeRemaining <= 10 && this.freezeTimer <= 0;
    const isFrozen = this.freezeTimer > 0;
    const isDanger = finalTen || this.player.hull === 1 || this.player.inFire;
    const isEmp = this.player.empTimer > 0;

    if (!isDanger && !isFrozen && !isEmp) return;

    const pulse = 0.5 + 0.5 * Math.sin(this.ambientTime * (finalTen ? 9.5 : 6.5));
    const grad = ctx.createRadialGradient(
      this.viewW * 0.5,
      this.viewH * 0.5,
      Math.min(this.viewW, this.viewH) * 0.3,
      this.viewW * 0.5,
      this.viewH * 0.5,
      Math.max(this.viewW, this.viewH) * 0.65
    );

    if (isFrozen) {
      grad.addColorStop(0, 'rgba(56, 189, 248, 0)');
      grad.addColorStop(1, `rgba(56, 189, 248, ${0.22 + pulse * 0.1})`);
    } else if (isDanger) {
      const alpha = finalTen ? 0.24 + pulse * 0.22 : 0.16 + pulse * 0.1;
      grad.addColorStop(0, 'rgba(239, 68, 68, 0)');
      grad.addColorStop(1, `rgba(239, 68, 68, ${alpha})`);
    } else {
      grad.addColorStop(0, 'rgba(168, 85, 247, 0)');
      grad.addColorStop(1, `rgba(168, 85, 247, ${0.16 + pulse * 0.1})`);
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.viewW, this.viewH);
  }
}
