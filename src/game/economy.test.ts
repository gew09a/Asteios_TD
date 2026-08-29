import { describe, expect, it } from "vitest";
import {
  START_GOLD,
  T1_BUILD_SECONDS,
  T1_COST,
  T2_BUILD_SECONDS,
  T2_COST,
  TOWER_STATS,
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
  });

  it("can buy 10 T1s, or 7 T1 + 1 T2, or 4 T1 + 2 T2", () => {
    expect(10 * T1_COST).toBe(START_GOLD);
    expect(7 * T1_COST + T2_COST).toBe(START_GOLD);
    expect(4 * T1_COST + 2 * T2_COST).toBe(START_GOLD);
  });

  it("charges 50 for T1 and 150 for T2 when cheat is off", () => {
    const g = new Game();
    expect(g.placeExact(0, 0, "bolt", 1).ok).toBe(true);
    expect(g.gold).toBe(START_GOLD - T1_COST);
    expect(g.placeExact(2, 0, "frost", 2).ok).toBe(true);
    expect(g.gold).toBe(START_GOLD - T1_COST - T2_COST);
  });

  it("rejects a buy the player cannot afford", () => {
    const g = new Game();
    for (let i = 0; i < 10; i++) {
      expect(g.placeExact((i % 9) * 2, Math.floor(i / 9) * 2, "bolt", 1).ok).toBe(true);
    }
    expect(g.gold).toBe(0);
    const denied = g.placeExact(0, 4, "venom", 1);
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.reason).toBe("no-gold");
  });

  it("T2 is about 2× T1 power, not 3×", () => {
    for (const type of ["bolt", "frost", "venom"] as const) {
      const ratio = towerDps(type, 2) / towerDps(type, 1);
      expect(ratio).toBeGreaterThanOrEqual(1.8);
      expect(ratio).toBeLessThanOrEqual(2.2);
    }
    expect(TOWER_STATS.bolt[1].cost).toBe(50);
    expect(TOWER_STATS.bolt[2].cost).toBe(150);
  });
});

describe("build times", () => {
  it("T1 takes 4s and T2 takes 10s when cheat is off; they do not shoot while building", () => {
    const g = new Game();
    g.placeExact(4, 4, "bolt", 1);
    g.placeExact(8, 4, "bolt", 2);
    const t1 = g.towers[0];
    const t2 = g.towers[1];
    expect(t1.buildRemaining).toBe(T1_BUILD_SECONDS);
    expect(t2.buildRemaining).toBe(T2_BUILD_SECONDS);
    g.tick(3.9);
    expect(t1.buildRemaining).toBeGreaterThan(0);
    expect(t2.buildRemaining).toBeGreaterThan(0);
    g.tick(0.2);
    expect(t1.buildRemaining).toBe(0);
    expect(t2.buildRemaining).toBeGreaterThan(5);
    g.tick(6);
    expect(t2.buildRemaining).toBe(0);
  });

  it("builds run in parallel", () => {
    const g = new Game();
    g.placeExact(0, 0, "frost", 1);
    g.placeExact(2, 0, "venom", 1);
    g.tick(4);
    expect(g.towers.every((t) => t.buildRemaining === 0)).toBe(true);
  });
});

describe("DEV cheat", () => {
  it("is off by default and does not grant infinite gold or instant builds", () => {
    const g = new Game();
    expect(g.cheat).toBe(false);
    g.placeExact(0, 0, "bolt", 1);
    expect(g.gold).toBe(START_GOLD - T1_COST);
    expect(g.towers[0].buildRemaining).toBe(T1_BUILD_SECONDS);
  });

  it("when ON: free placement and instant builds; OFF restores real costs/times", () => {
    const g = new Game();
    g.setCheat(true);
    const goldBefore = g.gold;
    g.placeExact(0, 0, "bolt", 2);
    expect(g.gold).toBe(goldBefore);
    expect(g.towers[0].buildRemaining).toBe(0);

    g.setCheat(false);
    g.placeExact(4, 0, "frost", 1);
    expect(g.gold).toBe(goldBefore - T1_COST);
    expect(g.towers[1].buildRemaining).toBe(T1_BUILD_SECONDS);
  });

  it("turning cheat on finishes in-progress builds but turning it off does not refund gold", () => {
    const g = new Game();
    g.placeExact(0, 0, "bolt", 2);
    expect(g.gold).toBe(START_GOLD - T2_COST);
    g.setCheat(true);
    expect(g.towers[0].buildRemaining).toBe(0);
    g.setCheat(false);
    expect(g.gold).toBe(START_GOLD - T2_COST);
  });
});

describe("restart", () => {
  it("resets gold, lives, board, and wave with no persist", () => {
    const g = new Game();
    g.placeExact(0, 0, "bolt", 1);
    g.lives = 3;
    g.wave = 4;
    g.restart();
    expect(g.gold).toBe(START_GOLD);
    expect(g.lives).toBe(10);
    expect(g.wave).toBe(1);
    expect(g.towers).toHaveLength(0);
    expect(g.creeps).toHaveLength(0);
    expect(g.phase).toBe("prep");
    expect(g.cheat).toBe(false);
  });
});
