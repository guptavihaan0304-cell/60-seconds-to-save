export type GameScreenState = 'title' | 'playing' | 'paused' | 'gameover';

export type RescueKind = 'normal' | 'fast' | 'golden';

export type PowerUpKind = 'speed' | 'shield' | 'freeze';

export type PerkId = 'fast_runner' | 'wide_pickup' | 'extra_time';

export type ArenaEventId = 'speed_surge' | 'double_points' | 'extra_hazards' | 'shrinking_zone';

export type RunRank = 'S' | 'A' | 'B' | 'C';

export type WeatherId = 'light_fog' | 'digital_rain' | 'ion_storm' | 'ashfall_haze';

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface WeatherConfig {
  id: WeatherId;
  label: string;
  phase: 1 | 2 | 3 | 4;
  fogColor: RgbColor;
  fogSecondaryColor: RgbColor;
  fogOpacity: number;
  fogDriftSpeed: number;
  streakColor: RgbColor;
  streakAccentColor: RgbColor;
  streakOpacity: number;
  streakDensity: number; // 0..1 fraction of pool active
  streakSpeedMin: number;
  streakSpeedMax: number;
  streakLengthMin: number;
  streakLengthMax: number;
  windX: number;
  digitalGlyphRatio: number; // 0..1 fraction of streaks carrying subtle binary/hex glyph heads
  rippleRate: number; // floor splashes per second
  gridGlintRate: number; // background grid circuit glints per second
  ambientWashColor: RgbColor;
  ambientWashOpacity: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface RectObstacle {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RescueItem {
  id: number;
  kind: RescueKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  weight: number;
  points: number;
  state: 'waiting' | 'carried' | 'scattered';
  pulsePhase: number;
  scatterTimer: number;
  wanderTimer: number;
}

export interface PowerUpItem {
  id: number;
  kind: PowerUpKind;
  x: number;
  y: number;
  radius: number;
  life: number;
  pulsePhase: number;
}

export interface DashGhost {
  x: number;
  y: number;
  angle: number;
  alpha: number;
}

export interface DebrisHazard {
  id: number;
  x: number;
  y: number;
  radius: number;
  phase: 'telegraph' | 'impact' | 'rubble';
  timer: number;
  duration: number;
  didHit: boolean;
}

export interface PatrolDrone {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  angle: number;
  behavior: 'patrol' | 'telegraph' | 'charge' | 'recover';
  stateTimer: number;
  patrolAxis: 'x' | 'y';
  patrolDir: 1 | -1;
  patrolMin: number;
  patrolMax: number;
  chargeDirX: number;
  chargeDirY: number;
  hitCooldown: number;
}

export interface FirePatch {
  id: number;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  phase: 'telegraph' | 'burning' | 'fading';
  timer: number;
  life: number;
  maxLife: number;
}

export interface ErraticOrb {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  nextVx: number;
  nextVy: number;
  radius: number;
  phase: 'drift' | 'telegraph';
  timer: number;
  arcSeed: number;
  hitCooldown: number;
}

export interface ShockwaveHazard {
  id: number;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  ringThickness: number;
  expandSpeed: number;
  phase: 'telegraph' | 'expanding';
  timer: number;
  duration: number;
  didHit: boolean;
  didVaultBonus: boolean;
}

export interface EmpHazard {
  id: number;
  x: number;
  y: number;
  radius: number;
  phase: 'telegraph' | 'discharge' | 'fade';
  timer: number;
  duration: number;
  didJam: boolean;
}

export interface PhaseConfig {
  phase: 1 | 2 | 3 | 4;
  label: string;
  debrisInterval: number;
  debrisRadius: number;
  debrisTelegraph: number;
  shockwaveInterval: number;
  shockwaveSpeed: number;
  targetDrones: number;
  droneSpeed: number;
  targetOrbs: number;
  orbSpeed: number;
  empInterval: number;
  empRadius: number;
  fireInterval: number;
  maxFires: number;
  targetSurvivors: number;
}

export interface SavedBreakdown {
  normal: number;
  fast: number;
  golden: number;
}

export interface ChallengeResult {
  id: string;
  label: string;
  completed: boolean;
  progressText: string;
}

export interface HudSnapshot {
  score: number;
  savedTotal: number;
  carryingCount: number;
  maxCarry: number;
  comboMultiplier: number;
  streakCount: number;
  streakMultiplier: number;
  hull: number;
  maxHull: number;
  phase: 1 | 2 | 3 | 4;
  phaseLabel: string;
  activeEventLabel: string | null;
  bannerText: string | null;
  inFire: boolean;
  inSafeZone: boolean;
  exhausted: boolean;
  isRegenerating: boolean;
  empJammedSeconds: number;
  interactCooldownPct: number;
  dashCooldownPct: number;
  hasShield: boolean;
  speedBoostSeconds: number;
  freezeSeconds: number;
  bestScore: number;
}

export interface RunSummary {
  outcome: 'victory' | 'defeat';
  reason: 'time_complete' | 'hull_breach' | 'none_saved';
  rank: RunRank;
  finalScore: number;
  bestScore: number;
  isNewBest: boolean;
  savedTotal: number;
  breakdown: SavedBreakdown;
  bestConvoy: number;
  maxStreak: number;
  damageTaken: number;
  challenges: ChallengeResult[];
  timeSurvived: number;
  duration: number;
  perkUsed: PerkId;
}

export interface HudDomRefs {
  timerEl: HTMLElement | null;
  staminaFillEl: HTMLElement | null;
  staminaGhostEl: HTMLElement | null;
  staminaLabelEl: HTMLElement | null;
}
