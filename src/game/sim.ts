import { CRUDE_MAZE_ORIGINS, T1_BUILD_SECONDS, WALL_LINE_ORIGINS } from "./config";
import { Game } from "./game";
import type { TowerType } from "./types";

export interface WaveSimResult {
  leaked: number;
  killed: number;
  livesLeft: number;
  towersLeft: number;
  gold: number;
  gameTime: number;
}

export function placeLayout(
  game: Game,
  origins: ReadonlyArray<readonly [number, number]>,
  type: TowerType = "bolt",
  tier: 1 | 2 = 1,
): void {
  for (const [col, row] of origins) {
    const result = game.placeExact(col, row, type, tier);
    if (!result.ok) {
      throw new Error(`Failed to place ${type} T${tier} at ${col},${row}: ${result.reason}`);
    }
  }
}

/** Fast-forward a live run until wave 1 ends or `limit` seconds elapse. */
export function runUntilWave1Done(game: Game, limit = 90): WaveSimResult {
  const dt = 1 / 30;
  let t = 0;
  let leaked = 0;

  while (t < limit) {
    const livesBefore = game.lives;
    game.tick(dt);
    t += dt;
    if (game.lives < livesBefore) leaked += livesBefore - game.lives;
    if (game.phase === "over") break;
    const wave1Over = game.wave > 1;
    if (wave1Over && game.creeps.length === 0) break;
  }

  const killed = 20 - leaked;
  return {
    leaked,
    killed,
    livesLeft: game.lives,
    towersLeft: game.towers.length,
    gold: game.gold,
    gameTime: t,
  };
}

export function simulateWave1Layout(
  origins: ReadonlyArray<readonly [number, number]>,
  waitForBuilds = true,
): WaveSimResult {
  const game = new Game();
  if (game.cheat) throw new Error("cheat must be off for balance sims");
  placeLayout(game, origins, "bolt", 1);
  if (waitForBuilds) {
    game.tick(T1_BUILD_SECONDS + 0.05);
  }
  return runUntilWave1Done(game);
}

export function simulateCrudeMaze(): WaveSimResult {
  return simulateWave1Layout(CRUDE_MAZE_ORIGINS);
}

export function simulateWallLine(): WaveSimResult {
  return simulateWave1Layout(WALL_LINE_ORIGINS);
}
