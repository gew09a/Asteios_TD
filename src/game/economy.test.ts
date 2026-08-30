import { describe, expect, it } from "vitest";
import {
  START_GOLD,
  T1_BUILD_SECONDS,
  T1_COST,
  TOWER_STATS,
  WAVE1_PREP_SECONDS,
  dpsPerGold,
  t1Cost,
  t2UpgradeCost,
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

  it("10 Basics still cost 500; T2 is +T1 cost of that type", () => {
    expect(10 * T1_COST).toBe(START_GOLD);
    expect(t2UpgradeCost("basic")).toBe(50);
    expect(t2UpgradeCost("sniper")).toBe(500);
    expect(t1Cost("slow")).toBe(125);
    expect(t1Cost("haste")).toBe(200);
    expect(t1Cost("poison")).toBe(300);
    expect(t1Cost("splash")).toBe(400);
    expect(t1Cost("sniper")).toBe(500);
  });

  it("places Basic T1 for 50; T2 is a +50 upgrade of that cube", () => {
    const g = new Game();
    expect(g.placeExact(0, 0, "basic", 1).ok).toBe(true);
    expect(g.gold).toBe(START_GOLD - 50);
    expect(g.towers[0].tier).toBe(1);
    g.towers[0].buildRemaining = 0;
    expect(g.tryUpgrade(g.towers[0].id)).toBe(true);
    expect(g.gold).toBe(START_GOLD - 100);
    expect(g.towers[0].tier).toBe(2);
    expect(g.towers[0].spent).toBe(100);
    expect(g.tryUpgrade(g.towers[0].id)).toBe(false);
  });

  it("sell refunds 100% of spent (Basic 50/100, Slow 125); smash does not", () => {
    const g = new Game();
    g.placeExact(0, 0, "basic", 1);
    expect(g.trySell(g.towers[0].id)).toBe(true);
    expect(g.gold).toBe(START_GOLD);
    expect(g.towers).toHaveLength(0);

    g.placeExact(2, 2, "slow", 1);
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

  it("single-target DPS/g follows the sqrt-ish ladder (Basic ~0.20, Sniper ~0.04)", () => {
    expect(dpsPerGold("basic")).toBeGreaterThanOrEqual(0.18);
    expect(dpsPerGold("basic")).toBeLessThanOrEqual(0.22);
    expect(dpsPerGold("sniper")).toBeGreaterThanOrEqual(0.03);
    expect(dpsPerGold("sniper")).toBeLessThanOrEqual(0.055);
    const tenBasics = 10 * towerDps("basic", 1);
    const oneSniper = towerDps("sniper", 1);
    expect(tenBasics / oneSniper).toBeGreaterThanOrEqual(5);
    expect(dpsPerGold("haste")).toBeLessThan(dpsPerGold("basic"));
    expect(dpsPerGold("sniper")).toBeLessThan(dpsPerGold("haste"));
  });

  it("two T1s beat one T2 on raw DPS; T2 is 1.6× power and 1.1× speed", () => {
    for (const type of ["basic", "haste", "sniper", "splash"] as const) {
      expect(2 * towerDps(type, 1)).toBeGreaterThan(towerDps(type, 2));
      const t1 = TOWER_STATS[type][1];
      const t2 = TOWER_STATS[type][2];
      expect(t2.damage / t1.damage).toBeCloseTo(1.6, 5);
      expect(t1.interval / t2.interval).toBeCloseTo(1.1, 5);
    }
    expect(TOWER_STATS.basic[1].cost).toBe(50);
    expect(TOWER_STATS.basic[2].cost).toBe(50);
  });
});

describe("build times", () => {
  it("Basic T1 takes 3s and T2 upgrade takes 3s; they do not shoot while building", () => {
    const g = new Game();
    g.placeExact(4, 4, "basic", 1);
    expect(g.towers[0].buildRemaining).toBe(T1_BUILD_SECONDS);
    g.tick(3.05);
    expect(g.towers[0].buildRemaining).toBe(0);
    expect(g.tryUpgrade(g.towers[0].id)).toBe(true);
    expect(g.towers[0].buildRemaining).toBe(T1_BUILD_SECONDS);
    g.tick(2.9);
    expect(g.towers[0].buildRemaining).toBeGreaterThan(0);
    g.tick(0.2);
    expect(g.towers[0].buildRemaining).toBe(0);
  });

  it("builds run in parallel", () => {
    const g = new Game();
    g.placeExact(0, 0, "slow", 1);
    g.placeExact(2, 0, "basic", 1);
    g.tick(5);
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
    g.placeExact(4, 0, "slow", 1);
    expect(g.gold).toBe(goldBefore - 125);
    expect(g.towers[1].buildRemaining).toBe(TOWER_STATS.slow[1].buildSeconds);
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
