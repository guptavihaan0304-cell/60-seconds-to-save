import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_PLAYER_SPEED,
  EXHAUSTED_SPEED_MULT,
  SAFE_ZONE_CENTER,
  SAFE_ZONE_RADIUS,
  blendWeatherConfigs,
  calculateBankScore,
  calculateDashCost,
  calculateMoveSpeed,
  calculateRunRank,
  clampToArena,
  computeJoystickVector,
  evaluateChallenges,
  evaluateRunSummary,
  getPhaseForElapsed,
  getRunDurationForPerk,
  getStreakMultiplier,
  getWeatherForPhase,
  isPointInSafeZone,
  pickArenaEvent,
  readStoredBestScore,
  resolveCircleRectCollision,
  stepStaminaState,
  writeStoredBestScore,
} from './rules';

test('escalation phases advance every 15 seconds with dynamic hazards and arena events', () => {
  const p1 = getPhaseForElapsed(0);
  const p2 = getPhaseForElapsed(15);
  const p3 = getPhaseForElapsed(30);
  const p4 = getPhaseForElapsed(45);

  assert.equal(p1.phase, 1);
  assert.equal(p2.phase, 2);
  assert.equal(p3.phase, 3);
  assert.equal(p4.phase, 4);

  assert.ok(p4.shockwaveSpeed > p1.shockwaveSpeed);
  assert.equal(p1.targetOrbs, 0);
  assert.ok(p2.targetOrbs >= 2);
  assert.ok(p3.empInterval < 10);
  assert.ok(p4.maxFires > p3.maxFires);

  const ev1 = pickArenaEvent(2, 0.2, null);
  const ev2 = pickArenaEvent(3, 0.2, ev1);
  assert.notEqual(ev1, ev2);
});

test('pre-game perks modify starting duration and movement speed', () => {
  assert.equal(getRunDurationForPerk(60, 'extra_time'), 65);
  assert.equal(getRunDurationForPerk(60, 'fast_runner'), 60);

  const baseSpeed = calculateMoveSpeed(0, false, false, false);
  const runnerSpeed = calculateMoveSpeed(0, false, false, false, { perk: 'fast_runner' });
  assert.ok(runnerSpeed > baseSpeed * 1.14);
});

test('stamina depletes on movement and heavy carry, slows when exhausted, regenerates when stationary', () => {
  const moveEmpty = stepStaminaState({
    stamina: 100,
    exhausted: false,
    isMoving: true,
    carryingCount: 0,
    inFire: false,
    inSafeZone: false,
    isDashing: false,
    dt: 1.0,
  });
  const moveHeavy = stepStaminaState({
    stamina: 100,
    exhausted: false,
    isMoving: true,
    carryingCount: 3,
    inFire: false,
    inSafeZone: false,
    isDashing: false,
    dt: 1.0,
  });
  assert.ok(moveEmpty.stamina < 100);
  assert.ok(moveHeavy.stamina < moveEmpty.stamina);

  const depleted = stepStaminaState({
    stamina: 2,
    exhausted: false,
    isMoving: true,
    carryingCount: 2,
    inFire: false,
    inSafeZone: false,
    isDashing: false,
    dt: 0.5,
  });
  assert.equal(depleted.stamina, 0);
  assert.equal(depleted.exhausted, true);

  const exhaustedSpeed = calculateMoveSpeed(0, false, false, true);
  assert.equal(exhaustedSpeed, BASE_PLAYER_SPEED * EXHAUSTED_SPEED_MULT);

  const stationaryRegen = stepStaminaState({
    stamina: 5,
    exhausted: true,
    isMoving: false,
    carryingCount: 0,
    inFire: false,
    inSafeZone: false,
    isDashing: false,
    dt: 1.0,
  });
  assert.ok(stationaryRegen.stamina > 20);
  assert.equal(stationaryRegen.exhausted, false);
  assert.equal(stationaryRegen.isRegenerating, true);
});

test('3 target variants, streak multipliers, and Double Points event compute score accurately', () => {
  assert.equal(getStreakMultiplier(1), 1);
  assert.equal(getStreakMultiplier(2), 2);
  assert.equal(getStreakMultiplier(3), 3);

  // normal (100) + fast (200) + golden (350) = 650 base
  // convoy 3 => 2.0x, streak 2 => 2.0x, doublePoints => 2.0x => 650 * 8 = 5200
  const banked = calculateBankScore(['normal', 'fast', 'golden'], 2, true);
  assert.equal(banked.points, 5200);
  assert.equal(banked.totalMultiplier, 8);

  assert.ok(calculateDashCost(4) > calculateDashCost(0));
});

test('virtual joystick deadzone and smooth sensitivity curve behave accurately', () => {
  const inside = computeJoystickVector(3, 2, 42, 0.14);
  assert.equal(inside.magnitude, 0);

  const full = computeJoystickVector(90, 0, 42, 0.14);
  assert.ok(Math.abs(full.x - 1) < 0.001);
  assert.equal(full.magnitude, 1);
});

test('post-game ranks (S/A/B/C) and 3 mini-challenges evaluate accurately', () => {
  assert.equal(calculateRunRank(4800, 10, 'victory'), 'S');
  assert.equal(calculateRunRank(2600, 7, 'victory'), 'A');
  assert.equal(calculateRunRank(1200, 4, 'victory'), 'B');
  assert.equal(calculateRunRank(200, 1, 'defeat'), 'C');

  const challenges = evaluateChallenges({
    savedTotal: 9,
    damageTaken: 0,
    goldenSaved: 2,
    maxStreak: 3,
  });
  assert.equal(challenges.length, 3);
  assert.equal(challenges.every((c) => c.completed), true);

  const summary = evaluateRunSummary({
    finalScore: 4600,
    previousBest: 3000,
    savedTotal: 10,
    breakdown: { normal: 4, fast: 4, golden: 2 },
    bestConvoy: 3,
    maxStreak: 3,
    damageTaken: 0,
    timeSurvived: 65,
    duration: 65,
    hullRemaining: 3,
    perkUsed: 'extra_time',
  });
  assert.equal(summary.rank, 'S');
  assert.equal(summary.isNewBest, true);
  assert.equal(summary.outcome, 'victory');
});

test('safe zone, collisions, and localStorage helpers work cleanly', () => {
  assert.equal(isPointInSafeZone(SAFE_ZONE_CENTER.x, SAFE_ZONE_CENTER.y), true);
  assert.equal(
    isPointInSafeZone(SAFE_ZONE_CENTER.x + SAFE_ZONE_RADIUS + 10, SAFE_ZONE_CENTER.y),
    false
  );

  const rect = { id: 'test', x: 100, y: 100, w: 100, h: 40 };
  assert.equal(resolveCircleRectCollision(95, 120, 15, rect).collided, true);
  assert.equal(clampToArena(-50, 9999, 16, 28).x, 44);

  const map = new Map<string, string>();
  const fakeStorage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };
  writeStoredBestScore(5100, fakeStorage);
  assert.equal(readStoredBestScore(fakeStorage), 5100);
});

test('dynamic weather varies distinctly per arena phase with non-obscuring opacity caps and smooth blending', () => {
  const w1 = getWeatherForPhase(1);
  const w2 = getWeatherForPhase(2);
  const w3 = getWeatherForPhase(3);
  const w4 = getWeatherForPhase(4);

  assert.deepEqual(
    [w1.id, w2.id, w3.id, w4.id],
    ['light_fog', 'digital_rain', 'ion_storm', 'ashfall_haze']
  );

  // Every phase must keep background fog & streak opacity bounded so gameplay actors stay readable
  for (const w of [w1, w2, w3, w4]) {
    assert.ok(w.fogOpacity > 0 && w.fogOpacity <= 0.16);
    assert.ok(w.streakOpacity > 0 && w.streakOpacity <= 0.4);
    assert.ok(w.ambientWashOpacity > 0 && w.ambientWashOpacity <= 0.1);
  }

  // Digital rain has higher glyph ratio and faster descent than Phase 1 light fog
  assert.ok(w2.digitalGlyphRatio > w1.digitalGlyphRatio);
  assert.ok(w2.streakSpeedMax > w1.streakSpeedMax);

  // Smooth blending interpolates numeric parameters and switches target ID at midpoint
  const mid = blendWeatherConfigs(w1, w2, 0.5);
  assert.equal(mid.id, 'digital_rain');
  assert.ok(mid.windX < w1.windX && mid.windX > w2.windX);
  assert.ok(mid.streakDensity > w1.streakDensity && mid.streakDensity < w2.streakDensity);

  const start = blendWeatherConfigs(w1, w2, 0);
  assert.equal(start.id, 'light_fog');
  assert.equal(start.fogOpacity, w1.fogOpacity);

  const end = blendWeatherConfigs(w1, w2, 1);
  assert.equal(end.id, 'digital_rain');
  assert.equal(end.fogOpacity, w2.fogOpacity);
});

