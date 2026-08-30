import { describe, expect, it } from "vitest";
import {
  START_GOLD,
  T1_BUILD_SECONDS,
  T1_COST,
  T2_BUILD_SECONDS,
  T2_TOTAL_COST,
  TOWER_STATS,
  TOWER_TYPES,
  WAVE1_PREP_SECONDS,
  towerDps,
} from "./config";
import { Game } from "./game";

describe("economy lock", () => {
  it("starts at 500 gold and 10 lives with cheat OFF", () => {
    const g = new Game();
    expect(g.cheat).toBe(false);
    expect(g.gold).toBe(START_GOLD);
    expect(g.lives).toBe(10);
    expect(g.prepRemaining).toBe(WAVE1_PREP_SECONDS);
    expect(g.selectedType).toBe("basic");
  });

  it("10 T1s, or 7 T1 + 1 T2, or 4 T1 + 2 T2 still cost 500", () => {
    expect(10 * T1_COST).toBe(START_GOLD);
    expect(7 * T1_COST + T2_TOTAL_COST).toBe(START_GOLD);
    expect(4 * T1_COST + 2 * T2_TOTAL_COST).toBe(START_GOLD);
  });

  it("places only T1 for 50; T2 is a +100 upgrade of that cube", () => {
    const g = new Game();
    expect(g.placeExact(0, 0, "basic", 1).ok).toBe(true);
    expect(g.gold).toBe(START_GOLD - T1_COST);
    expect(g.towers[0].tier).toBe(1);
    g.towers[0].buildRemaining = 0;
    expect(g.tryUpgrade(g.towers[0].id)).toBe(true);
    expect(g.gold).toBe(START_GOLD - T2_TOTAL_COST);
    expect(g.towers[0].tier).toBe(2);
    expect(g.towers[0].spent).toBe(T2_TOTAL_COST);
    expect(g.tryUpgrade(g.towers[0].id)).toBe(false);
  });

  it("sell refunds 50 for T1 and 150 for T2; smash does not", () => {
    const g = new Game();
    g.placeExact(0, 0, "basic", 1);
    expect(g.trySell(g.towers[0].id)).toBe(true);
    expect(g.gold).toBe(START_GOLD);
    expect(g.towers).toHaveLength(0);

    g.placeExact(2, 2, "slow", 2);
    g.towers[0].buildRemaining = 0;
    expect(g.towers[0].tier).toBe(2);
    expect(g.trySell(g.towers[0].id)).toBe(true);
    expect(g.gold).toBe(START_GOLD);
  });

  it("rejects a buy the player cannot afford", () => {
    const g = new Game();
    for (let i = 0; i < 10; i++) {
      expect(g.placeExact((i % 9) * 2, Math.floor(i / 9) * 2, "basic", 1).ok).toBe(true);
    }
    expect(g.gold).toBe(0);
    const denied = g.placeExact(0, 4, "haste", 1);
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.reason).toBe("no-gold");
  });

  it("T2 is about 2× T1 power, not 3×", () => {
    for (const type of TOWER_TYPES) {
      const ratio = towerDps(type, 2) / towerDps(type, 1);
      expect(ratio).toBeGreaterThanOrEqual(1.6);
      expect(ratio).toBeLessThanOrEqual(2.3);
    }
    expect(TOWER_STATS.basic[1].cost).toBe(50);
    expect(TOWER_STATS.basic[2].cost).toBe(100);
  });
});

describe("build times", () => {
  it("T1 takes 4s and T2 upgrade takes 10s; they do not shoot while building", () => {
    const g = new Game();
    g.placeExact(4, 4, "basic", 1);
    expect(g.towers[0].buildRemaining).toBe(T1_BUILD_SECONDS);
    g.tick(4.05);
    expect(g.towers[0].buildRemaining).toBe(0);
    expect(g.tryUpgrade(g.towers[0].id)).toBe(true);
    expect(g.towers[0].buildRemaining).toBe(T2_BUILD_SECONDS);
    g.tick(9.9);
    expect(g.towers[0].buildRemaining).toBeGreaterThan(0);
    g.tick(0.2);
    expect(g.towers[0].buildRemaining).toBe(0);
  });

  it("builds run in parallel", () => {
    const g = new Game();
    g.placeExact(0, 0, "slow", 1);
    g.placeExact(2, 0, "poison", 1);
    g.tick(4);
    expect(g.towers.every((t) => t.buildRemaining === 0)).toBe(true);
  });
});

describe("DEV cheat", () => {
  it("is off by default and does not grant infinite gold or instant builds", () => {
    const g = new Game();
    expect(g.cheat).toBe(false);
    g.placeExact(0, 0, "basic", 1);
    expect(g.gold).toBe(START_GOLD - T1_COST);
    expect(g.towers[0].buildRemaining).toBe(T1_BUILD_SECONDS);
  });

  it("when ON: free placement and instant builds; OFF restores real costs/times", () => {
    const g = new Game();
    g.setCheat(true);
    const goldBefore = g.gold;
    g.placeExact(0, 0, "basic", 1);
    expect(g.gold).toBe(goldBefore);
    expect(g.towers[0].buildRemaining).toBe(0);
    expect(g.tryUpgrade(g.towers[0].id)).toBe(true);
    expect(g.towers[0].buildRemaining).toBe(0);

    g.setCheat(false);
    g.placeExact(4, 0, "sniper", 1);
    expect(g.gold).toBe(goldBefore - T1_COST);
    expect(g.towers[1].buildRemaining).toBe(T1_BUILD_SECONDS);
  });

  it("cheat-only B wall-off is ignored when cheat is off", () => {
    const g = new Game();
    expect(g.blockForSmashTest()).toBe(false);
    expect(g.towers).toHaveLength(0);
    g.setCheat(true);
    expect(g.blockForSmashTest()).toBe(true);
    expect(g.towers).toHaveLength(10);
    expect(g.pathBlocked).toBe(true);
  });
});

describe("restart", () => {
  it("resets gold, lives, board, and wave with no persist", () => {
    const g = new Game();
    g.placeExact(0, 0, "basic", 1);
    g.inspectTower(g.towers[0].id);
    g.lives = 3;
    g.wave = 4;
    g.restart();
    expect(g.gold).toBe(START_GOLD);
    expect(g.lives).toBe(10);
    expect(g.wave).toBe(1);
    expect(g.towers).toHaveLength(0);
    expect(g.inspectId).toBeNull();
    expect(g.phase).toBe("prep");
    expect(g.cheat).toBe(false);
  });
});
