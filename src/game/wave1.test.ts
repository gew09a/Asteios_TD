import { describe, expect, it } from "vitest";
import {
  T1_COST,
  TOWER_STATS,
  WAVE1_CREEP_COUNT,
  WAVE1_GOLD,
  WAVE1_HP,
  exitToSpawnDistance,
} from "./config";
import { Game } from "./game";
import { simulateMixedMazeThrough, simulateTwoBasicRowsThrough, simulateWave1Row } from "./sim";

describe("wave 1 grant", () => {
  it("is 20 creeps at 25 gold; Basic one-shots; sniper does not", () => {
    expect(WAVE1_CREEP_COUNT).toBe(20);
    expect(WAVE1_GOLD).toBe(25);
    expect(WAVE1_HP).toBe(TOWER_STATS.basic[1].damage);
    expect(TOWER_STATS.sniper[1].damage).toBeLessThan(WAVE1_HP);
    expect(20 * WAVE1_GOLD).toBe(500);
  });

  it("a full first row of Basics clears wave 1 and funds a second row", () => {
    const result = simulateWave1Row();
    expect(result.leaked).toBe(0);
    expect(result.killed).toBe(20);
    expect(result.gold).toBe(500);
  });

  it("Basic in range kills a wave-1 creep in one shot", () => {
    const g = new Game();
    g.placeExact(8, 2, "basic", 1);
    g.tick(4.05);
    g.prepRemaining = 0;
    g.tick(0.05);
    expect(g.creeps.length).toBeGreaterThan(0);
    const creep = g.creeps[0];
    const hpBefore = creep.hp;
    creep.x = 9;
    creep.y = 3.2;
    g.tick(1);
    expect(creep.hp).toBeLessThanOrEqual(0);
    expect(hpBefore).toBe(WAVE1_HP);
  });

  it("sniper at the exit cannot reach spawn", () => {
    const reach = exitToSpawnDistance();
    expect(TOWER_STATS.sniper[1].range).toBeLessThan(reach);
    expect(TOWER_STATS.sniper[2].range).toBeLessThan(reach);

    const g = new Game();
    g.placeExact(9, 30, "sniper", 1);
    g.tick(4.05);
    g.prepRemaining = 0;
    g.tick(0.05);
    const atSpawn = g.creeps.filter((c) => c.y < 1.2);
    expect(atSpawn.length).toBeGreaterThan(0);
    g.tick(0.2);
    expect(atSpawn.every((c) => c.hp === c.maxHp)).toBe(true);
  });

  it("creeps spawn across the full 20-wide top", () => {
    const g = new Game();
    g.prepRemaining = 0;
    for (let i = 0; i < 25; i++) g.tick(0.4);
    const cols = new Set(g.creeps.map((c) => Math.floor(c.x)));
    expect(cols.size).toBeGreaterThanOrEqual(16);
    expect(Math.min(...cols)).toBeLessThanOrEqual(1);
    expect(Math.max(...cols)).toBeGreaterThanOrEqual(18);
  });

  it("slow, poison, splash, and haste all apply their jobs", () => {
    const g = new Game();
    g.placeExact(8, 4, "slow", 1);
    g.placeExact(10, 8, "poison", 1);
    g.placeExact(6, 12, "splash", 1);
    g.placeExact(12, 16, "haste", 1);
    g.tick(4.05);
    g.prepRemaining = 0;

    let sawSlow = false;
    let sawDot = false;
    let sawDamage = false;
    for (let i = 0; i < 800; i++) {
      g.tick(1 / 30);
      for (const c of g.creeps) {
        if (c.hp < c.maxHp) sawDamage = true;
        if (c.slowRemaining > 0) sawSlow = true;
        if (c.dotRemaining > 0) sawDot = true;
      }
    }
    expect(sawDamage).toBe(true);
    expect(sawSlow).toBe(true);
    expect(sawDot).toBe(true);
    expect(g.gold).toBeLessThanOrEqual(500 - 4 * T1_COST + 20 * WAVE1_GOLD);
  });
});

describe("later waves", () => {
  it("two full Basic rows leak once the ramp is on (wave 3)", () => {
    const result = simulateTwoBasicRowsThrough(3);
    expect(result.leaked).toBeGreaterThanOrEqual(1);
  });

  it("a tight mixed maze still holds wave 3 (walls do not)", () => {
    const maze = simulateMixedMazeThrough(3);
    expect(maze.leaked).toBe(0);
    expect(maze.livesLeft).toBe(10);
  });
});
