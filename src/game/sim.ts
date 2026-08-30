import {
  FUNNEL_ORIGINS,
  FULL_ROW_ORIGINS,
  MAZE_BEND_ORIGINS,
  MIXED_BEND_TYPES,
  T1_BUILD_SECONDS,
} from "./config";
import { Game } from "./game";
import type { TowerType } from "./types";

export interface WaveSimResult {
  leaked: number;
  killed: number;
  livesLeft: number;
  towersLeft: number;
  gold: number;
  gameTime: number;
  wave: number;
}

export function placeLayout(
  game: Game,
  origins: ReadonlyArray<readonly [number, number]>,
  type: TowerType = "basic",
): void {
  for (const [col, row] of origins) {
    const result = game.placeExact(col, row, type, 1);
    if (!result.ok) {
      throw new Error(`Failed to place ${type} at ${col},${row}: ${result.reason}`);
    }
  }
}

export function runUntilWaveDone(game: Game, targetWave: number, limit = 120): WaveSimResult {
  const dt = 1 / 30;
  let t = 0;
  let leaked = 0;

  while (t < limit) {
    const livesBefore = game.lives;
    game.tick(dt);
    t += dt;
    if (game.lives < livesBefore) leaked += livesBefore - game.lives;
    if (game.phase === "over") break;
    if (game.wave > targetWave && game.creeps.length === 0) break;
  }

  return {
    leaked,
    killed: Math.max(0, 20 - leaked),
    livesLeft: game.lives,
    towersLeft: game.towers.length,
    gold: game.gold,
    gameTime: t,
    wave: game.wave,
  };
}

export function simulateWave1Row(): WaveSimResult {
  const game = new Game();
  placeLayout(game, FULL_ROW_ORIGINS(2), "basic");
  game.tick(T1_BUILD_SECONDS + 0.05);
  return runUntilWaveDone(game, 1);
}

export function simulateTwoBasicRowsThrough(wave: number): WaveSimResult {
  const game = new Game();
  placeLayout(game, FULL_ROW_ORIGINS(2), "basic");
  game.tick(T1_BUILD_SECONDS + 0.05);
  const first = runUntilWaveDone(game, 1, 90);
  if (first.leaked > 0 || game.gold < 500) {
    return { ...first, wave: game.wave };
  }
  placeLayout(game, FULL_ROW_ORIGINS(6), "basic");
  game.tick(T1_BUILD_SECONDS + 0.05);
  return runUntilWaveDone(game, wave, 180);
}

/** Funnel of Basics, then a mixed chicane bought with the wave-1 grant. */
export function simulateMixedMazeThrough(wave: number): WaveSimResult {
  const game = new Game();
  placeLayout(game, FUNNEL_ORIGINS, "basic");
  const turn = game.placeExact(18, 5, "slow", 1);
  if (!turn.ok) throw new Error(`Failed to place maze turn: ${turn.reason}`);
  game.tick(T1_BUILD_SECONDS + 0.05);
  const first = runUntilWaveDone(game, 1, 90);
  if (first.leaked > 0 || game.gold < 500) {
    return { ...first, wave: game.wave };
  }
  MAZE_BEND_ORIGINS.forEach(([col, row], i) => {
    const type = MIXED_BEND_TYPES[i] ?? "basic";
    const result = game.placeExact(col, row, type, 1);
    if (!result.ok) throw new Error(`Failed maze bend ${col},${row}: ${result.reason}`);
  });
  const tail = game.placeExact(0, 14, "poison", 1);
  if (!tail.ok) throw new Error(`Failed maze tail: ${tail.reason}`);
  game.tick(T1_BUILD_SECONDS + 0.05);
  return runUntilWaveDone(game, wave, 240);
}
