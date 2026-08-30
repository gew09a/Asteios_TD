/** Kit, waves, and the sqrt-ish DPS/g law. Tags move if the law fails. */

export const COLS = 20;
export const ROWS = 32;
export const TOWER_SIZE = 2;

export const START_GOLD = 500;
export const START_LIVES = 10;

export const WAVE1_PREP_SECONDS = 15;
export const INTERWAVE_PREP_SECONDS = 8;

export const WAVE1_CREEP_COUNT = 20;
export const WAVE1_GOLD = 25;
/** Wave 1 HP === Basic T1 damage so Basic one-shots at Basic range. */
export const WAVE1_HP = 10;

export const LATER_WAVE_GOLD = 12;
export const CREEPS_PER_WAVE = 4;
export const HP_RAMP = 1.85;

export const CREEP_SPEED = 2.0;
export const CREEP_SPAWN_INTERVAL = 0.4;

export type TowerType = "basic" | "slow" | "haste" | "poison" | "splash" | "sniper";
export type TowerTier = 1 | 2;

export const TOWER_TYPES: readonly TowerType[] = [
  "basic",
  "slow",
  "haste",
  "poison",
  "splash",
  "sniper",
];

export const TYPE_LABEL: Record<TowerType, string> = {
  basic: "Basic",
  slow: "Slow",
  haste: "Haste",
  poison: "Poison",
  splash: "Splash",
  sniper: "Sniper",
};

export const TYPE_COLOR: Record<TowerType, number> = {
  basic: 0xd8d2c4,
  slow: 0x5ec8e8,
  haste: 0xe87ad4,
  poison: 0x7dce6a,
  splash: 0xe8a04a,
  sniper: 0x6aa8ff,
};

export interface TowerStats {
  cost: number;
  buildSeconds: number;
  damage: number;
  interval: number;
  range: number;
  slowFactor?: number;
  slowSeconds?: number;
  dotDps?: number;
  dotSeconds?: number;
  splashRadius?: number;
  splashScale?: number;
}

const T2_POWER = 1.6;
const T2_SPEED = 1.1;

function t2(t1: TowerStats): TowerStats {
  return {
    cost: t1.cost,
    buildSeconds: t1.buildSeconds,
    damage: t1.damage * T2_POWER,
    interval: t1.interval / T2_SPEED,
    range: t1.range,
    slowFactor: t1.slowFactor === undefined ? undefined : 1 - (1 - t1.slowFactor) * T2_POWER,
    slowSeconds: t1.slowSeconds,
    dotDps: t1.dotDps === undefined ? undefined : t1.dotDps * T2_POWER,
    dotSeconds: t1.dotSeconds,
    splashRadius: t1.splashRadius,
    splashScale: t1.splashScale,
  };
}

/**
 * First-pass tags. Single-target DPS/g falls with cost (Basic ~0.20, Sniper ~0.04).
 * T2 is +T1 cost (total 2C), 1.6× power, 1.1× speed — two T1s still beat one T2.
 * Sniper range 12 cannot reach spawn from the exit (~30.5).
 */
export const TOWER_STATS: Record<TowerType, Record<TowerTier, TowerStats>> = {
  basic: (() => {
    const t1: TowerStats = { cost: 50, buildSeconds: 3, damage: 10, interval: 1.0, range: 4 };
    return { 1: t1, 2: t2(t1) };
  })(),
  slow: (() => {
    const t1: TowerStats = {
      cost: 125,
      buildSeconds: 5,
      damage: 2,
      interval: 0.8,
      range: 4,
      slowFactor: 0.65,
      slowSeconds: 2.0,
    };
    return { 1: t1, 2: t2(t1) };
  })(),
  haste: (() => {
    const t1: TowerStats = { cost: 200, buildSeconds: 6, damage: 6, interval: 1 / 3, range: 3 };
    return { 1: t1, 2: t2(t1) };
  })(),
  poison: (() => {
    const t1: TowerStats = {
      cost: 300,
      buildSeconds: 7,
      damage: 0,
      interval: 1.0,
      range: 4,
      dotDps: 8,
      dotSeconds: 3,
    };
    return { 1: t1, 2: t2(t1) };
  })(),
  splash: (() => {
    const t1: TowerStats = {
      cost: 400,
      buildSeconds: 8,
      damage: 12,
      interval: 1 / 0.7,
      range: 4,
      splashRadius: 1.5,
      splashScale: 1,
    };
    return { 1: t1, 2: t2(t1) };
  })(),
  sniper: (() => {
    const t1: TowerStats = { cost: 500, buildSeconds: 10, damage: 40, interval: 2.0, range: 12 };
    return { 1: t1, 2: t2(t1) };
  })(),
};

export const T1_COST = TOWER_STATS.basic[1].cost;
export const T1_BUILD_SECONDS = TOWER_STATS.basic[1].buildSeconds;

export function t1Cost(type: TowerType): number {
  return TOWER_STATS[type][1].cost;
}

export function t2UpgradeCost(type: TowerType): number {
  return t1Cost(type);
}

export function spentOnTower(type: TowerType, tier: TowerTier): number {
  return tier === 2 ? 2 * t1Cost(type) : t1Cost(type);
}

/** Instant + DoT. Slow is utility and is not scored here. */
export function towerDps(type: TowerType, tier: TowerTier): number {
  const s = TOWER_STATS[type][tier];
  const shot = s.damage / s.interval;
  return shot + (s.dotDps ?? 0);
}

export function dpsPerGold(type: TowerType, tier: TowerTier = 1): number {
  return towerDps(type, tier) / t1Cost(type);
}

/** Exit-row tower center to spawn-row creep — sniper must lose this. */
export function exitToSpawnDistance(): number {
  const towerCy = ROWS - TOWER_SIZE / 2;
  const spawnY = 0.5;
  return Math.abs(towerCy - spawnY);
}

export function waveSpec(wave: number): {
  count: number;
  hp: number;
  gold: number;
  interval: number;
  armor: number;
} {
  const n = Math.max(1, wave);
  return {
    count: WAVE1_CREEP_COUNT + (n - 1) * CREEPS_PER_WAVE,
    hp: Math.round(WAVE1_HP * Math.pow(HP_RAMP, n - 1)),
    gold: n <= 1 ? WAVE1_GOLD : LATER_WAVE_GOLD,
    interval: Math.max(0.22, CREEP_SPAWN_INTERVAL - (n - 1) * 0.03),
    armor: 0,
  };
}

/** Full-width first row of T1s (10 towers). A complete row is a wall → smash. */
export const FULL_ROW_ORIGINS = (row: number): Array<readonly [number, number]> =>
  Array.from({ length: 10 }, (_, i) => [i * 2, row] as const);

/**
 * Opening funnel: 9× T1 covering cols 0–17, 2-tile gap at 18–19.
 * Not a wall, so creeps path instead of smash.
 */
export const FUNNEL_ORIGINS: ReadonlyArray<readonly [number, number]> = [
  [0, 2],
  [2, 2],
  [4, 2],
  [6, 2],
  [8, 2],
  [10, 2],
  [12, 2],
  [14, 2],
  [16, 2],
];

/** Offset plug that turns the 2-tile right gap into a left-hand corridor. */
export const FUNNEL_TURN: readonly [number, number] = [18, 4];

/** Second chicane after the wave-1 gold grant (gap on the left). */
export const MAZE_BEND_ORIGINS: ReadonlyArray<readonly [number, number]> = [
  [2, 8],
  [4, 8],
  [6, 8],
  [8, 8],
  [10, 8],
  [12, 8],
  [14, 8],
  [16, 8],
  [18, 8],
];
