import { describe, expect, it } from "vitest";
import {
  TOWER_STATS,
  WAVE1_CREEP_COUNT,
  WAVE1_GOLD,
  WAVE1_HP,
  exitToSpawnDistance,
  waveSpec,
} from "./config";
import { Game } from "./game";
import { simulateBasicMazeThrough, simulateTwoBasicRowsThrough, simulateWave1Row } from "./sim";

describe("wave 1 grant", () => {
  it("is 20 creeps at 25 gold and HP 10 so Basic one-shots", () => {
    expect(WAVE1_CREEP_COUNT).toBe(20);
    expect(WAVE1_GOLD).toBe(25);
    expect(WAVE1_HP).toBe(TOWER_STATS.basic[1].damage);
    expect(20 * WAVE1_GOLD).toBe(500);
  });

  it("wave 6 is ~40 creeps at ~217 HP; later kills pay 12g", () => {
    const w6 = waveSpec(6);
    expect(w6.count).toBe(40);
    expect(w6.hp).toBe(217);
    expect(w6.gold).toBe(12);
    expect(waveSpec(2).gold).toBe(12);
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
    g.tick(3.05);
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
    g.tick(10.05);
    g.prepRemaining = 0;
    g.tick(0.05);
    const atSpawn = g.creeps.filter((c) => c.y < 1.2);
    expect(atSpawn.length).toBeGreaterThan(0);
    g.tick(0.2);
    expect(atSpawn.every((c) => c.hp === c.maxHp)).toBe(true);
  });

  it("creeps spawn randomly across the full 20-wide top, not a left-to-right file", () => {
    const g = new Game();
    g.prepRemaining = 0;
    for (let i = 0; i < 25; i++) g.tick(0.4);
    const cols = g.creeps.map((c) => Math.floor(c.x));
    const unique = new Set(cols);
    expect(unique.size).toBeGreaterThanOrEqual(16);
    expect(Math.min(...cols)).toBeLessThanOrEqual(1);
    expect(Math.max(...cols)).toBeGreaterThanOrEqual(18);
    const sequential = cols.slice(0, 8).every((c, i) => c === i);
    expect(sequential).toBe(false);
  });

  it("slow, poison, splash, and haste all apply their jobs", () => {
    const g = new Game();
    g.gold = 2000;
    g.placeExact(8, 4, "slow", 1);
    g.placeExact(10, 8, "poison", 1);
    g.placeExact(6, 12, "splash", 1);
    g.placeExact(12, 16, "haste", 1);
    g.tick(8.05);
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
    expect(g.gold).toBeLessThan(2000);
  });
});

describe("later waves", () => {
  it("two full Basic rows leak once the ramp is on", () => {
    const result = simulateTwoBasicRowsThrough(4);
    expect(result.leaked).toBeGreaterThanOrEqual(1);
  });

  it("a maze of Basics plus spice still holds wave 3 (walls do not)", () => {
    const maze = simulateBasicMazeThrough(3);
    expect(maze.leaked).toBe(0);
    expect(maze.livesLeft).toBe(10);
  });
});
