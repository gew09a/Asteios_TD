/** Locked kit and wave-1 grant. Later-wave HP/count is the retune knob. */

export const COLS = 20;
export const ROWS = 32;
export const TOWER_SIZE = 2;

export const START_GOLD = 500;
export const START_LIVES = 10;

export const T1_COST = 50;
export const T2_UPGRADE_COST = 100;
export const T2_TOTAL_COST = T1_COST + T2_UPGRADE_COST;
export const T1_BUILD_SECONDS = 4;
export const T2_BUILD_SECONDS = 10;

export const WAVE1_PREP_SECONDS = 15;
export const INTERWAVE_PREP_SECONDS = 8;

export const WAVE1_CREEP_COUNT = 20;
export const WAVE1_GOLD = 25;

/**
 * Wave 1 is a gold grant: Basic one-shots at Basic range (HP === Basic T1 damage).
 * Sniper T1 damage is below this so it is not a one-shot.
 */
export const WAVE1_HP = 28;

export const CREEP_SPEED = 2.0;
export const CREEP_SPAWN_INTERVAL = 0.4;

export type TowerType = "basic" | "sniper" | "slow" | "poison" | "splash" | "haste";
export type TowerTier = 1 | 2;

export const TOWER_TYPES: readonly TowerType[] = [
  "basic",
  "sniper",
  "slow",
  "poison",
  "splash",
  "haste",
];

export const TYPE_LABEL: Record<TowerType, string> = {
  basic: "Basic",
  sniper: "Sniper",
  slow: "Slow",
  poison: "Poison",
  splash: "Splash",
  haste: "Haste",
};

export const TYPE_COLOR: Record<TowerType, number> = {
  basic: 0xd8d2c4,
  sniper: 0x6aa8ff,
  slow: 0x5ec8e8,
  poison: 0x7dce6a,
  splash: 0xe8a04a,
  haste: 0xe87ad4,
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

const T1 = { cost: T1_COST, buildSeconds: T1_BUILD_SECONDS };
const T2 = { cost: T2_UPGRADE_COST, buildSeconds: T2_BUILD_SECONDS };

/**
 * T2 is ~2× T1, not 3×. Sniper range is long but well under the 30.5-tile
 * spawn↔exit gap so an exit sniper cannot delete spawn.
 */
export const TOWER_STATS: Record<TowerType, Record<TowerTier, TowerStats>> = {
  basic: {
    1: { ...T1, damage: 28, interval: 0.85, range: 3.6 },
    2: { ...T2, damage: 52, interval: 0.8, range: 3.9 },
  },
  sniper: {
    1: { ...T1, damage: 14, interval: 1.35, range: 10.5 },
    2: { ...T2, damage: 26, interval: 1.25, range: 12.0 },
  },
  slow: {
    1: { ...T1, damage: 5, interval: 0.8, range: 3.5, slowFactor: 0.62, slowSeconds: 2.0 },
    2: { ...T2, damage: 9, interval: 0.75, range: 3.8, slowFactor: 0.52, slowSeconds: 2.4 },
  },
  poison: {
    1: { ...T1, damage: 3, interval: 1.0, range: 3.5, dotDps: 8, dotSeconds: 4.0 },
    2: { ...T2, damage: 6, interval: 0.95, range: 3.8, dotDps: 15, dotSeconds: 4.2 },
  },
  splash: {
    1: {
      ...T1,
      damage: 16,
      interval: 1.0,
      range: 3.4,
      splashRadius: 1.65,
      splashScale: 0.5,
    },
    2: {
      ...T2,
      damage: 28,
      interval: 0.95,
      range: 3.6,
      splashRadius: 1.8,
      splashScale: 0.55,
    },
  },
  haste: {
    1: { ...T1, damage: 8, interval: 0.28, range: 3.3 },
    2: { ...T2, damage: 14, interval: 0.24, range: 3.5 },
  },
};

export function towerDps(type: TowerType, tier: TowerTier): number {
  const s = TOWER_STATS[type][tier];
  return s.damage / s.interval + (s.dotDps ?? 0);
}

export function spentOnTower(tier: TowerTier): number {
  return tier === 2 ? T2_TOTAL_COST : T1_COST;
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
    count: WAVE1_CREEP_COUNT + (n - 1) * 6,
    hp: Math.round(WAVE1_HP * Math.pow(1.55, n - 1)),
    gold: WAVE1_GOLD + (n - 1) * 2,
    interval: Math.max(0.22, CREEP_SPAWN_INTERVAL - (n - 1) * 0.03),
    armor: n <= 1 ? 0 : 3 + (n - 2) * 3,
  };
}

/** Full-width first row of T1s (10 towers). A complete row is a wall → smash. */
export const FULL_ROW_ORIGINS = (row: number): Array<readonly [number, number]> =>
  Array.from({ length: 10 }, (_, i) => [i * 2, row] as const);

/**
 * Opening funnel: 9× T1 covering cols 0–17, 2-tile gap at 18–19.
 * Not a wall, so creeps path instead of smash. Edge Basics still one-shot wave 1.
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

export const MIXED_BEND_TYPES: ReadonlyArray<TowerType> = [
  "slow",
  "poison",
  "splash",
  "haste",
  "sniper",
  "poison",
  "splash",
  "slow",
  "haste",
];
