import {
  FUNNEL_ORIGINS,
  FUNNEL_TURN,
  FULL_ROW_ORIGINS,
  MAZE_BEND_ORIGINS,
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

/** Funnel of Basics that forces a corridor, then more Basics plus one Slow. */
export function simulateBasicMazeThrough(wave: number): WaveSimResult {
  const game = new Game();
  placeLayout(game, FUNNEL_ORIGINS, "basic");
  const turn = game.placeExact(FUNNEL_TURN[0], FUNNEL_TURN[1], "basic", 1);
  if (!turn.ok) throw new Error(`Failed funnel turn: ${turn.reason}`);
  game.tick(T1_BUILD_SECONDS + 0.05);
  const first = runUntilWaveDone(game, 1, 90);
  if (first.leaked > 0 || game.gold < 450) {
    return { ...first, wave: game.wave };
  }
  placeLayout(game, MAZE_BEND_ORIGINS, "basic");
  if (game.gold >= 125) {
    const spice = game.placeExact(0, 14, "slow", 1);
    if (!spice.ok) throw new Error(`Failed maze spice: ${spice.reason}`);
  }
  game.tick(T1_BUILD_SECONDS + 0.05);
  const through2 = runUntilWaveDone(game, Math.min(2, wave), 180);
  if (wave <= 2) return through2;
  const extras: Array<readonly [number, number]> = [
    [0, 14],
    [2, 14],
    [16, 20],
    [18, 20],
  ];
  for (const [col, row] of extras) {
    if (game.gold < 50) break;
    game.placeExact(col, row, "basic", 1);
  }
  game.tick(T1_BUILD_SECONDS + 0.05);
  return runUntilWaveDone(game, wave, 240);
}
