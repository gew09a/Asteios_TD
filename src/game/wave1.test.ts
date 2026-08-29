import { describe, expect, it } from "vitest";
import { T1_COST, WAVE1_CREEP_COUNT, WAVE1_GOLD, WAVE1_HP } from "./config";
import { Game } from "./game";
import { simulateCrudeMaze, simulateWallLine } from "./sim";

describe("wave 1 tuning target", () => {
  it("is 20 creeps at 12 gold with HP locked for maze-vs-wall", () => {
    expect(WAVE1_CREEP_COUNT).toBe(20);
    expect(WAVE1_GOLD).toBe(12);
    expect(WAVE1_HP).toBe(140);
  });

  it("a crude 10 T1 maze clears wave 1 (no leaks)", () => {
    const result = simulateCrudeMaze();
    expect(result.gameTime).toBeLessThan(90);
    expect(result.leaked).toBe(0);
    expect(result.killed).toBe(20);
    expect(result.livesLeft).toBe(10);
    expect(result.gold).toBe(20 * WAVE1_GOLD);
  });

  it("lining the walls without a maze leaks wave 1", () => {
    const result = simulateWallLine();
    expect(result.leaked).toBeGreaterThanOrEqual(10);
    expect(result.livesLeft).toBeLessThan(10);
  });

  it("three T1 types all function: bolt hits, frost slows, venom applies DoT", () => {
    const g = new Game();
    g.placeExact(9, 6, "bolt", 1);
    g.placeExact(9, 10, "frost", 1);
    g.placeExact(9, 14, "venom", 1);
    g.tick(4.05);
    g.prepRemaining = 0;
    g.tick(0.6);
    expect(g.creeps.length).toBeGreaterThan(0);

    let sawSlow = false;
    let sawDot = false;
    let sawDamage = false;
    for (let i = 0; i < 600; i++) {
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
    expect(g.towers).toHaveLength(3);
    expect(g.gold).toBeLessThanOrEqual(500 - 3 * T1_COST + 20 * WAVE1_GOLD);
  });
});
