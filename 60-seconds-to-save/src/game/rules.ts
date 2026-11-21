import type {
  ArenaEventId,
  ChallengeResult,
  PerkId,
  PhaseConfig,
  PowerUpKind,
  RectObstacle,
  RescueKind,
  RgbColor,
  RunRank,
  RunSummary,
  SavedBreakdown,
  Vec2,
  WeatherConfig,
} from './types';

export const WORLD_WIDTH = 1280;
export const WORLD_HEIGHT = 800;
export const SAFE_ZONE_CENTER: Vec2 = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
export const SAFE_ZONE_RADIUS = 88;
export const SHRUNK_SAFE_ZONE_RADIUS = 64;
export const HAZARD_EXCLUSION_RADIUS = 165;

export const DEFAULT_DURATION_SECONDS = 60;
export const EXTRA_TIME_PERK_BONUS = 5;
export const MAX_CARRY_ITEMS = 5;
export const MAX_HULL = 3;
export const MAX_STAMINA = 100;
export const BASE_PLAYER_SPEED = 295;

// Dash / Vault action parameters (Spacebar / tap)
export const DASH_DURATION = 0.36;
export const DASH_SPEED_MULT = 2.05;
export const DASH_COOLDOWN = 0.58;
export const DASH_STAMINA_COST = 18;
export const VAULT_BONUS_POINTS = 50;

// Interact / Rescue Magnet pulse parameters
export const INTERACT_RADIUS = 148;
export const INTERACT_COOLDOWN = 1.5;
export const INTERACT_STAMINA_COST = 10;

// Stamina system constants
export const STAMINA_MOVE_DRAIN_BASE = 7.2;
export const STAMINA_CARRY_DRAIN_PER_ITEM = 5.0;
export const STAMINA_REGEN_STATIONARY = 24;
export const STAMINA_REGEN_SAFE_ZONE = 62;
export const STAMINA_EXHAUSTION_RECOVERY_THRESHOLD = 18;
export const EXHAUSTED_SPEED_MULT = 0.48;

// Streak & Power-Up constants
export const STREAK_WINDOW_SECONDS = 6.5;
export const SPEED_BOOST_DURATION = 5.5;
export const FREEZE_TIMER_DURATION = 3.0;
export const SHIELD_DURATION = 8.0;

// Hazard constants
export const FIRE_STAMINA_DRAIN = 28;
export const FIRE_SPEED_MULT = 0.65;
export const EMP_JAM_DURATION = 3.0;

export const HIGH_SCORE_STORAGE_KEY = 'sixty_seconds_to_save_best_v1';
export const MUTE_STORAGE_KEY = 'sixty_seconds_to_save_muted_v1';

export const PERK_SPECS: Record<
  PerkId,
  { id: PerkId; name: string; benefit: string }
> = {
  fast_runner: {
    id: 'fast_runner',
    name: 'Fast Runner',
    benefit: '+15% Move Speed',
  },
  wide_pickup: {
    id: 'wide_pickup',
    name: 'Wide Pickup',
    benefit: '+45% Pickup Radius',
  },
  extra_time: {
    id: 'extra_time',
    name: 'Extra 5 Seconds',
    benefit: '65s Countdown',
  },
};

export const RESCUE_SPECS: Record<
  RescueKind,
  { label: string; weight: number; points: number; radius: number; color: string; moveSpeed: number }
> = {
  normal: {
    label: 'Civilian',
    weight: 1.0,
    points: 100,
    radius: 13,
    color: '#38BDF8',
    moveSpeed: 0,
  },
  fast: {
    label: 'Fast Scout',
    weight: 0.9,
    points: 200,
    radius: 12,
    color: '#34D399',
    moveSpeed: 105,
  },
  golden: {
    label: 'Heavy Gold',
    weight: 1.75,
    points: 350,
    radius: 15,
    color: '#FBBF24',
    moveSpeed: 0,
  },
};

export const POWERUP_SPECS: Record<
  PowerUpKind,
  { label: string; color: string; short: string }
> = {
  speed: { label: 'Speed Boost', color: '#38BDF8', short: 'SPD' },
  shield: { label: 'Energy Shield', color: '#10B981', short: 'SHD' },
  freeze: { label: 'Freeze 3s', color: '#93C5FD', short: 'FRZ' },
};

export const ARENA_EVENTS: Record<
  ArenaEventId,
  { id: ArenaEventId; label: string; subtitle: string }
> = {
  speed_surge: {
    id: 'speed_surge',
    label: 'SPEED SURGE',
    subtitle: 'All Thrusters +22% Faster',
  },
  double_points: {
    id: 'double_points',
    label: 'DOUBLE POINTS',
    subtitle: '2x Score on Extractions',
  },
  extra_hazards: {
    id: 'extra_hazards',
    label: 'HAZARD OVERDRIVE',
    subtitle: 'Extra Hazards + Bonus Gold',
  },
  shrinking_zone: {
    id: 'shrinking_zone',
    label: 'ZONE COMPACTING',
    subtitle: 'Safe Zone Tightens + Bonus Gold',
  },
};

export const ARENA_OBSTACLES: RectObstacle[] = [
  { id: 'nw-pillar', x: 250, y: 175, w: 120, h: 42 },
  { id: 'ne-pillar', x: WORLD_WIDTH - 370, y: 175, w: 120, h: 42 },
  { id: 'sw-pillar', x: 250, y: WORLD_HEIGHT - 217, w: 120, h: 42 },
  { id: 'se-pillar', x: WORLD_WIDTH - 370, y: WORLD_HEIGHT - 217, w: 120, h: 42 },
];

export const PHASE_TABLE: Record<1 | 2 | 3 | 4, PhaseConfig> = {
  1: {
    phase: 1,
    label: 'Seismic Breach',
    debrisInterval: 2.9,
    debrisRadius: 46,
    debrisTelegraph: 0.95,
    shockwaveInterval: 5.8,
    shockwaveSpeed: 215,
    targetDrones: 0,
    droneSpeed: 135,
    targetOrbs: 0,
    orbSpeed: 160,
    empInterval: 999,
    empRadius: 115,
    fireInterval: 999,
    maxFires: 0,
    targetSurvivors: 6,
  },
  2: {
    phase: 2,
    label: 'Erratic Surge',
    debrisInterval: 2.3,
    debrisRadius: 50,
    debrisTelegraph: 0.85,
    shockwaveInterval: 5.0,
    shockwaveSpeed: 235,
    targetDrones: 1,
    droneSpeed: 150,
    targetOrbs: 2,
    orbSpeed: 185,
    empInterval: 999,
    empRadius: 120,
    fireInterval: 999,
    maxFires: 0,
    targetSurvivors: 7,
  },
  3: {
    phase: 3,
    label: 'EMP & Thermal',
    debrisInterval: 1.85,
    debrisRadius: 54,
    debrisTelegraph: 0.78,
    shockwaveInterval: 4.4,
    shockwaveSpeed: 255,
    targetDrones: 2,
    droneSpeed: 170,
    targetOrbs: 2,
    orbSpeed: 205,
    empInterval: 5.4,
    empRadius: 128,
    fireInterval: 4.8,
    maxFires: 3,
    targetSurvivors: 8,
  },
  4: {
    phase: 4,
    label: 'Final Collapse',
    debrisInterval: 1.35,
    debrisRadius: 58,
    debrisTelegraph: 0.7,
    shockwaveInterval: 3.6,
    shockwaveSpeed: 280,
    targetDrones: 3,
    droneSpeed: 195,
    targetOrbs: 3,
    orbSpeed: 230,
    empInterval: 4.2,
    empRadius: 138,
    fireInterval: 3.5,
    maxFires: 5,
    targetSurvivors: 9,
  },
};

export function getPhaseForElapsed(elapsedSeconds: number): PhaseConfig {
  const clamped = Math.max(0, elapsedSeconds);
  if (clamped < 15) return PHASE_TABLE[1];
  if (clamped < 30) return PHASE_TABLE[2];
  if (clamped < 45) return PHASE_TABLE[3];
  return PHASE_TABLE[4];
}

export const WEATHER_BY_PHASE: Record<1 | 2 | 3 | 4, WeatherConfig> = {
  1: {
    id: 'light_fog',
    label: 'Cool Mist',
    phase: 1,
    fogColor: { r: 125, g: 211, b: 252 },
    fogSecondaryColor: { r: 148, g: 163, b: 184 },
    fogOpacity: 0.11,
    fogDriftSpeed: 22,
    streakColor: { r: 186, g: 230, b: 253 },
    streakAccentColor: { r: 125, g: 211, b: 252 },
    streakOpacity: 0.22,
    streakDensity: 0.42,
    streakSpeedMin: 55,
    streakSpeedMax: 115,
    streakLengthMin: 6,
    streakLengthMax: 16,
    windX: -14,
    digitalGlyphRatio: 0.08,
    rippleRate: 1.5,
    gridGlintRate: 0.8,
    ambientWashColor: { r: 14, g: 116, b: 144 },
    ambientWashOpacity: 0.045,
  },
  2: {
    id: 'digital_rain',
    label: 'Digital Rain',
    phase: 2,
    fogColor: { r: 34, g: 211, b: 238 },
    fogSecondaryColor: { r: 16, g: 185, b: 129 },
    fogOpacity: 0.075,
    fogDriftSpeed: 30,
    streakColor: { r: 56, g: 189, b: 248 },
    streakAccentColor: { r: 52, g: 211, b: 153 },
    streakOpacity: 0.34,
    streakDensity: 0.85,
    streakSpeedMin: 240,
    streakSpeedMax: 420,
    streakLengthMin: 22,
    streakLengthMax: 52,
    windX: -28,
    digitalGlyphRatio: 0.32,
    rippleRate: 6.5,
    gridGlintRate: 2.2,
    ambientWashColor: { r: 6, g: 95, b: 70 },
    ambientWashOpacity: 0.055,
  },
  3: {
    id: 'ion_storm',
    label: 'Ion Haze',
    phase: 3,
    fogColor: { r: 168, g: 85, b: 247 },
    fogSecondaryColor: { r: 56, g: 189, b: 248 },
    fogOpacity: 0.115,
    fogDriftSpeed: 42,
    streakColor: { r: 192, g: 132, b: 252 },
    streakAccentColor: { r: 125, g: 211, b: 252 },
    streakOpacity: 0.31,
    streakDensity: 0.9,
    streakSpeedMin: 290,
    streakSpeedMax: 470,
    streakLengthMin: 24,
    streakLengthMax: 54,
    windX: -88,
    digitalGlyphRatio: 0.24,
    rippleRate: 5.5,
    gridGlintRate: 4.5,
    ambientWashColor: { r: 88, g: 28, b: 135 },
    ambientWashOpacity: 0.065,
  },
  4: {
    id: 'ashfall_haze',
    label: 'Thermal Ashfall',
    phase: 4,
    fogColor: { r: 249, g: 115, b: 22 },
    fogSecondaryColor: { r: 239, g: 68, b: 68 },
    fogOpacity: 0.13,
    fogDriftSpeed: 56,
    streakColor: { r: 251, g: 146, b: 60 },
    streakAccentColor: { r: 253, g: 224, b: 71 },
    streakOpacity: 0.35,
    streakDensity: 1.0,
    streakSpeedMin: 185,
    streakSpeedMax: 340,
    streakLengthMin: 10,
    streakLengthMax: 30,
    windX: -125,
    digitalGlyphRatio: 0.06,
    rippleRate: 2.0,
    gridGlintRate: 3.0,
    ambientWashColor: { r: 154, g: 52, b: 18 },
    ambientWashOpacity: 0.075,
  },
};

export function getWeatherForPhase(phase: 1 | 2 | 3 | 4): WeatherConfig {
  return WEATHER_BY_PHASE[phase];
}

function lerpNumber(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgb(a: RgbColor, b: RgbColor, t: number): RgbColor {
  return {
    r: Math.round(lerpNumber(a.r, b.r, t)),
    g: Math.round(lerpNumber(a.g, b.g, t)),
    b: Math.round(lerpNumber(a.b, b.b, t)),
  };
}

export function blendWeatherConfigs(
  from: WeatherConfig,
  to: WeatherConfig,
  progress: number
): WeatherConfig {
  const t = Math.max(0, Math.min(1, progress));
  return {
    id: t >= 0.5 ? to.id : from.id,
    label: t >= 0.5 ? to.label : from.label,
    phase: t >= 0.5 ? to.phase : from.phase,
    fogColor: lerpRgb(from.fogColor, to.fogColor, t),
    fogSecondaryColor: lerpRgb(from.fogSecondaryColor, to.fogSecondaryColor, t),
    fogOpacity: lerpNumber(from.fogOpacity, to.fogOpacity, t),
    fogDriftSpeed: lerpNumber(from.fogDriftSpeed, to.fogDriftSpeed, t),
    streakColor: lerpRgb(from.streakColor, to.streakColor, t),
    streakAccentColor: lerpRgb(from.streakAccentColor, to.streakAccentColor, t),
    streakOpacity: lerpNumber(from.streakOpacity, to.streakOpacity, t),
    streakDensity: lerpNumber(from.streakDensity, to.streakDensity, t),
    streakSpeedMin: lerpNumber(from.streakSpeedMin, to.streakSpeedMin, t),
    streakSpeedMax: lerpNumber(from.streakSpeedMax, to.streakSpeedMax, t),
    streakLengthMin: lerpNumber(from.streakLengthMin, to.streakLengthMin, t),
    streakLengthMax: lerpNumber(from.streakLengthMax, to.streakLengthMax, t),
    windX: lerpNumber(from.windX, to.windX, t),
    digitalGlyphRatio: lerpNumber(from.digitalGlyphRatio, to.digitalGlyphRatio, t),
    rippleRate: lerpNumber(from.rippleRate, to.rippleRate, t),
    gridGlintRate: lerpNumber(from.gridGlintRate, to.gridGlintRate, t),
    ambientWashColor: lerpRgb(from.ambientWashColor, to.ambientWashColor, t),
    ambientWashOpacity: lerpNumber(from.ambientWashOpacity, to.ambientWashOpacity, t),
  };
}

export function getRunDurationForPerk(baseDuration: number, perk: PerkId): number {
  return perk === 'extra_time' ? baseDuration + EXTRA_TIME_PERK_BONUS : baseDuration;
}

export function pickArenaEvent(phase: 2 | 3 | 4, roll: number, previous?: ArenaEventId | null): ArenaEventId {
  const pool: ArenaEventId[] =
    phase === 2
      ? ['speed_surge', 'double_points', 'extra_hazards']
      : ['speed_surge', 'double_points', 'extra_hazards', 'shrinking_zone'];
  const filtered = previous ? pool.filter((e) => e !== previous) : pool;
  const idx = Math.floor(Math.max(0, Math.min(0.9999, roll)) * filtered.length);
  return filtered[idx] ?? 'double_points';
}

export function calculateMoveSpeed(
  totalCarryWeight: number,
  inFire: boolean,
  isDashing: boolean,
  isExhausted = false,
  options?: {
    perk?: PerkId;
    speedBoostActive?: boolean;
    speedSurgeEvent?: boolean;
  }
): number {
  const weightPenalty = Math.max(0.52, 1 - Math.max(0, totalCarryWeight) * 0.09);
  const exhaustedFactor = isExhausted && !isDashing ? EXHAUSTED_SPEED_MULT : 1;
  const fireFactor = inFire && !isDashing ? FIRE_SPEED_MULT : 1;
  const dashFactor = isDashing ? DASH_SPEED_MULT : 1;
  const perkFactor = options?.perk === 'fast_runner' ? 1.15 : 1;
  const boostFactor = options?.speedBoostActive ? 1.32 : 1;
  const eventFactor = options?.speedSurgeEvent ? 1.22 : 1;
  return (
    BASE_PLAYER_SPEED *
    weightPenalty *
    exhaustedFactor *
    fireFactor *
    dashFactor *
    perkFactor *
    boostFactor *
    eventFactor
  );
}

export function stepStaminaState(params: {
  stamina: number;
  exhausted: boolean;
  isMoving: boolean;
  carryingCount: number;
  inFire: boolean;
  inSafeZone: boolean;
  isDashing: boolean;
  speedBoostActive?: boolean;
  dt: number;
}): { stamina: number; exhausted: boolean; isRegenerating: boolean } {
  const { isMoving, carryingCount, inFire, inSafeZone, isDashing, speedBoostActive, dt } = params;
  let nextStamina = params.stamina;
  let isRegenerating = false;

  if (inFire && !isDashing) {
    nextStamina -= FIRE_STAMINA_DRAIN * dt;
  }

  if (isMoving) {
    const multiCarryDrain =
      carryingCount > 0 ? carryingCount * STAMINA_CARRY_DRAIN_PER_ITEM : 0;
    const boostDiscount = speedBoostActive ? 0.5 : 1;
    const drainRate = (STAMINA_MOVE_DRAIN_BASE + multiCarryDrain) * boostDiscount;
    nextStamina -= drainRate * dt;
  } else if (!inFire) {
    const loadDrag = Math.max(0.6, 1 - Math.max(0, carryingCount - 1) * 0.1);
    const regenRate = inSafeZone
      ? STAMINA_REGEN_SAFE_ZONE
      : STAMINA_REGEN_STATIONARY * loadDrag;
    if (nextStamina < MAX_STAMINA) {
      isRegenerating = true;
    }
    nextStamina += regenRate * dt;
  }

  nextStamina = Math.max(0, Math.min(MAX_STAMINA, nextStamina));

  let nextExhausted = params.exhausted;
  if (nextStamina <= 0.01) {
    nextExhausted = true;
  } else if (nextExhausted && nextStamina >= STAMINA_EXHAUSTION_RECOVERY_THRESHOLD) {
    nextExhausted = false;
  }

  return {
    stamina: nextStamina,
    exhausted: nextExhausted,
    isRegenerating,
  };
}

export function calculateDashCost(totalCarryWeight: number): number {
  return Math.round(DASH_STAMINA_COST + Math.max(0, totalCarryWeight) * 2.5);
}

export function computeJoystickVector(
  dx: number,
  dy: number,
  maxRadius: number,
  deadzoneRatio = 0.14
): { x: number; y: number; magnitude: number } {
  const safeMax = Math.max(1, maxRadius);
  const rawDist = Math.hypot(dx, dy);
  const normDist = Math.min(1, rawDist / safeMax);
  if (normDist <= deadzoneRatio || rawDist < 0.0001) {
    return { x: 0, y: 0, magnitude: 0 };
  }
  const scaled = (normDist - deadzoneRatio) / (1 - deadzoneRatio);
  const curved = Math.pow(Math.max(0, Math.min(1, scaled)), 1.15);
  return {
    x: (dx / rawDist) * curved,
    y: (dy / rawDist) * curved,
    magnitude: curved,
  };
}

export function getConvoyMultiplier(count: number): number {
  if (count <= 1) return 1.0;
  if (count === 2) return 1.5;
  if (count === 3) return 2.0;
  if (count === 4) return 2.5;
  return 3.0;
}

export function getStreakMultiplier(streakCount: number): number {
  if (streakCount <= 1) return 1.0;
  if (streakCount === 2) return 2.0;
  if (streakCount === 3) return 3.0;
  return 4.0;
}

export function calculateBankScore(
  kinds: RescueKind[],
  streakCount = 1,
  doublePointsActive = false
): {
  points: number;
  convoyMultiplier: number;
  streakMultiplier: number;
  totalMultiplier: number;
} {
  if (kinds.length === 0) {
    return { points: 0, convoyMultiplier: 1, streakMultiplier: 1, totalMultiplier: 1 };
  }
  const baseSum = kinds.reduce((acc, k) => acc + RESCUE_SPECS[k].points, 0);
  const convoyMultiplier = getConvoyMultiplier(kinds.length);
  const streakMultiplier = getStreakMultiplier(streakCount);
  const eventMult = doublePointsActive ? 2 : 1;
  const totalMultiplier = convoyMultiplier * streakMultiplier * eventMult;
  return {
    points: Math.round(baseSum * totalMultiplier),
    convoyMultiplier,
    streakMultiplier,
    totalMultiplier,
  };
}

export function calculateRunRank(score: number, savedTotal: number, outcome: 'victory' | 'defeat'): RunRank {
  if (outcome === 'defeat' && savedTotal === 0) return 'C';
  if (score >= 4500 || (outcome === 'victory' && savedTotal >= 12)) return 'S';
  if (score >= 2400 || (outcome === 'victory' && savedTotal >= 8)) return 'A';
  if (score >= 1000 || savedTotal >= 4) return 'B';
  return 'C';
}

export function evaluateChallenges(params: {
  savedTotal: number;
  damageTaken: number;
  goldenSaved: number;
  maxStreak: number;
}): ChallengeResult[] {
  const flawless = params.savedTotal >= 8 && params.damageTaken === 0;
  const goldRush = params.goldenSaved >= 2;
  const streakMaster = params.maxStreak >= 3;

  return [
    {
      id: 'flawless_8',
      label: 'Save 8 targets without taking damage',
      completed: flawless,
      progressText:
        params.damageTaken > 0
          ? `${params.damageTaken} hit${params.damageTaken === 1 ? '' : 's'} taken`
          : `${Math.min(8, params.savedTotal)}/8 saved`,
    },
    {
      id: 'gold_rush',
      label: 'Extract 2 Heavy Golden targets',
      completed: goldRush,
      progressText: `${Math.min(2, params.goldenSaved)}/2 gold`,
    },
    {
      id: 'streak_master',
      label: 'Reach a 3x Consecutive Save Streak',
      completed: streakMaster,
      progressText: `${Math.min(3, params.maxStreak)}x/3x streak`,
    },
  ];
}

export function distanceSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function isPointInSafeZone(
  x: number,
  y: number,
  margin = 0,
  zoneRadius = SAFE_ZONE_RADIUS
): boolean {
  const r = zoneRadius + margin;
  return distanceSq(x, y, SAFE_ZONE_CENTER.x, SAFE_ZONE_CENTER.y) <= r * r;
}

export function resolveCircleRectCollision(
  cx: number,
  cy: number,
  radius: number,
  rect: RectObstacle
): { x: number; y: number; collided: boolean } {
  const nearestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  const distSq = dx * dx + dy * dy;

  if (distSq >= radius * radius) {
    return { x: cx, y: cy, collided: false };
  }

  if (distSq > 0.0001) {
    const dist = Math.sqrt(distSq);
    const overlap = radius - dist;
    return {
      x: cx + (dx / dist) * overlap,
      y: cy + (dy / dist) * overlap,
      collided: true,
    };
  }

  const leftDist = Math.abs(cx - rect.x);
  const rightDist = Math.abs(rect.x + rect.w - cx);
  const topDist = Math.abs(cy - rect.y);
  const bottomDist = Math.abs(rect.y + rect.h - cy);
  const minDist = Math.min(leftDist, rightDist, topDist, bottomDist);

  if (minDist === leftDist) return { x: rect.x - radius, y: cy, collided: true };
  if (minDist === rightDist) return { x: rect.x + rect.w + radius, y: cy, collided: true };
  if (minDist === topDist) return { x: cx, y: rect.y - radius, collided: true };
  return { x: cx, y: rect.y + rect.h + radius, collided: true };
}

export function clampToArena(
  x: number,
  y: number,
  radius: number,
  wallPadding = 28
): Vec2 {
  return {
    x: Math.max(wallPadding + radius, Math.min(WORLD_WIDTH - wallPadding - radius, x)),
    y: Math.max(wallPadding + radius, Math.min(WORLD_HEIGHT - wallPadding - radius, y)),
  };
}

export function pickRescueKind(phase: 1 | 2 | 3 | 4, roll: number): RescueKind {
  const r = Math.max(0, Math.min(0.9999, roll));
  if (phase === 1) {
    if (r < 0.56) return 'normal';
    if (r < 0.84) return 'fast';
    return 'golden';
  }
  if (phase === 2) {
    if (r < 0.44) return 'normal';
    if (r < 0.78) return 'fast';
    return 'golden';
  }
  if (r < 0.34) return 'normal';
  if (r < 0.68) return 'fast';
  return 'golden';
}

export function evaluateRunSummary(params: {
  finalScore: number;
  previousBest: number;
  savedTotal: number;
  breakdown: SavedBreakdown;
  bestConvoy: number;
  maxStreak: number;
  damageTaken: number;
  timeSurvived: number;
  duration: number;
  hullRemaining: number;
  perkUsed: PerkId;
}): RunSummary {
  const isNewBest = params.finalScore > params.previousBest && params.finalScore > 0;
  const bestScore = Math.max(params.finalScore, params.previousBest);
  const outcome: 'victory' | 'defeat' =
    params.hullRemaining <= 0 || params.savedTotal <= 0 ? 'defeat' : 'victory';
  const reason: RunSummary['reason'] =
    params.hullRemaining <= 0
      ? 'hull_breach'
      : params.savedTotal <= 0
      ? 'none_saved'
      : 'time_complete';

  const rank = calculateRunRank(params.finalScore, params.savedTotal, outcome);
  const challenges = evaluateChallenges({
    savedTotal: params.savedTotal,
    damageTaken: params.damageTaken,
    goldenSaved: params.breakdown.golden,
    maxStreak: params.maxStreak,
  });

  return {
    outcome,
    reason,
    rank,
    finalScore: params.finalScore,
    bestScore,
    isNewBest,
    savedTotal: params.savedTotal,
    breakdown: { ...params.breakdown },
    bestConvoy: params.bestConvoy,
    maxStreak: params.maxStreak,
    damageTaken: params.damageTaken,
    challenges,
    timeSurvived: params.timeSurvived,
    duration: params.duration,
    perkUsed: params.perkUsed,
  };
}

export function readStoredBestScore(storage?: Pick<Storage, 'getItem'>): number {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!store) return 0;
    const raw = store.getItem(HIGH_SCORE_STORAGE_KEY);
    if (!raw) return 0;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function writeStoredBestScore(
  score: number,
  storage?: Pick<Storage, 'setItem'>
): void {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!store) return;
    store.setItem(HIGH_SCORE_STORAGE_KEY, String(Math.max(0, Math.round(score))));
  } catch {
    // Ignore storage quota or sandbox errors
  }
}
