/** Locked first-playable numbers. Tune only if a sim fights "tight cheap maze wins". */

export const COLS = 20;
export const ROWS = 32;
export const TOWER_SIZE = 2;

export const START_GOLD = 500;
export const START_LIVES = 10;

export const T1_COST = 50;
export const T2_COST = 150;
export const T1_BUILD_SECONDS = 4;
export const T2_BUILD_SECONDS = 10;

export const WAVE1_PREP_SECONDS = 15;
export const INTERWAVE_PREP_SECONDS = 8;

export const WAVE1_CREEP_COUNT = 20;
export const WAVE1_GOLD = 12;

/**
 * Wave 1 HP is the tuning target:
 * a crude 10 T1 maze must clear the wave; lining the walls must leak.
 * 140 dies to a crude 10 T1 zipper/gauntlet along the walking lane.
 * Lining the outer walls leaves the center lane untouched.
 */
export const WAVE1_HP = 140;

export const CREEP_SPEED = 1.85;
export const CREEP_SPAWN_INTERVAL = 0.55;

export type TowerType = "bolt" | "frost" | "venom";
export type TowerTier = 1 | 2;

export interface TowerStats {
  cost: number;
  buildSeconds: number;
  damage: number;
  interval: number;
  range: number;
  /** Frost only: move-speed multiplier while slowed. */
  slowFactor?: number;
  slowSeconds?: number;
  /** Venom only: damage-over-time. */
  dotDps?: number;
  dotSeconds?: number;
}

const T1_BUILD = { cost: T1_COST, buildSeconds: T1_BUILD_SECONDS };
const T2_BUILD = { cost: T2_COST, buildSeconds: T2_BUILD_SECONDS };

/** T2 is ~2× T1 power (DPS), not 3×. Range only ticks up slightly. */
export const TOWER_STATS: Record<TowerType, Record<TowerTier, TowerStats>> = {
  bolt: {
    1: { ...T1_BUILD, damage: 20, interval: 0.75, range: 4.1 },
    2: { ...T2_BUILD, damage: 40, interval: 0.75, range: 4.5 },
  },
  frost: {
    1: {
      ...T1_BUILD,
      damage: 6,
      interval: 0.7,
      range: 3.8,
      slowFactor: 0.65,
      slowSeconds: 2.0,
    },
    2: {
      ...T2_BUILD,
      damage: 12,
      interval: 0.7,
      range: 4.2,
      slowFactor: 0.55,
      slowSeconds: 2.4,
    },
  },
  venom: {
    1: {
      ...T1_BUILD,
      damage: 4,
      interval: 0.9,
      range: 3.8,
      dotDps: 10,
      dotSeconds: 3.5,
    },
    2: {
      ...T2_BUILD,
      damage: 8,
      interval: 0.9,
      range: 4.2,
      dotDps: 20,
      dotSeconds: 3.5,
    },
  },
};

export function towerDps(type: TowerType, tier: TowerTier): number {
  const s = TOWER_STATS[type][tier];
  const shot = s.damage / s.interval;
  const dot = s.dotDps ?? 0;
  return shot + dot;
}

export function waveSpec(wave: number): {
  count: number;
  hp: number;
  gold: number;
  interval: number;
} {
  const n = Math.max(1, wave);
  return {
    count: WAVE1_CREEP_COUNT + (n - 1) * 3,
    hp: Math.round(WAVE1_HP * Math.pow(1.16, n - 1)),
    gold: WAVE1_GOLD + (n - 1),
    interval: Math.max(0.35, CREEP_SPAWN_INTERVAL - (n - 1) * 0.015),
  };
}

/** Two-chicane crude maze used as the wave-1 kill baseline. */
export const CRUDE_MAZE_ORIGINS: ReadonlyArray<readonly [number, number]> = [
  [8, 2],
  [8, 8],
  [8, 14],
  [8, 20],
  [8, 26],
  [10, 5],
  [10, 11],
  [10, 17],
  [10, 23],
  [10, 28],
];

/** Towers hugging the long edges — shortest path is a straight shot down the middle. */
export const WALL_LINE_ORIGINS: ReadonlyArray<readonly [number, number]> = [
  [0, 2],
  [0, 8],
  [0, 14],
  [0, 20],
  [0, 26],
  [18, 2],
  [18, 8],
  [18, 14],
  [18, 20],
  [18, 26],
];
