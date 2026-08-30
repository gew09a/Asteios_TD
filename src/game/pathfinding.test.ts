import { describe, expect, it } from "vitest";
import { COLS, ROWS, START_GOLD, T1_COST } from "./config";
import { Game } from "./game";
import { blockedSet, canStep, computeFlow, nextTileTowardExit, snapPlaceOrigin, towerFits } from "./pathfinding";

describe("board and placement", () => {
  it("is a 20×32 channel and towers are 2×2", () => {
    expect(COLS).toBe(20);
    expect(ROWS).toBe(32);
    expect(towerFits(18, 30)).toBe(true);
    expect(towerFits(19, 30)).toBe(false);
    expect(towerFits(18, 31)).toBe(false);
  });

  it("snaps a click on the channel to a legal 2×2 origin", () => {
    expect(snapPlaceOrigin(0, 0)).toEqual({ col: 0, row: 0 });
    expect(snapPlaceOrigin(10, 16)).toEqual({ col: 10, row: 16 });
    expect(snapPlaceOrigin(19, 31)).toEqual({ col: 18, row: 30 });
    expect(snapPlaceOrigin(-1, 4)).toBeNull();
    expect(snapPlaceOrigin(4, 32)).toBeNull();
  });

  it("starts with Basic T1 selected so a first click can place", () => {
    const g = new Game();
    expect(g.selectedType).toBe("basic");
    expect(g.tryPlace(6, 8).ok).toBe(true);
    expect(g.towers[0].type).toBe("basic");
    expect(g.towers[0].tier).toBe(1);
  });

  it("rejects overlapping 2×2 towers", () => {
    const g = new Game();
    expect(g.placeExact(4, 4, "basic", 1).ok).toBe(true);
    expect(g.placeExact(5, 4, "slow", 1).ok).toBe(false);
    expect(g.placeExact(4, 5, "poison", 1).ok).toBe(false);
    expect(g.placeExact(5, 5, "basic", 1).ok).toBe(false);
    expect(g.placeExact(6, 4, "basic", 1).ok).toBe(true);
  });

  it("blank board has a straight spawn-to-exit path", () => {
    const flow = computeFlow([]);
    expect(flow.reachableFromSpawn).toBe(true);
    expect(flow.preview.length).toBe(ROWS);
    expect(flow.preview[0].row).toBe(0);
    expect(flow.preview[flow.preview.length - 1].row).toBe(ROWS - 1);
    const cols = new Set(flow.preview.map((t) => t.col));
    expect(cols.size).toBe(1);
    expect([...cols][0]).toBe(10);
  });
});

describe("diagonal bee-line pathing", () => {
  it("bee-lines toward a right-side gap instead of walking an L into the wall", () => {
    const wall = Array.from({ length: 9 }, (_, i) => ({ col: i * 2, row: 6 }));
    const flow = computeFlow(wall);
    expect(flow.reachableFromSpawn).toBe(true);
    const first = nextTileTowardExit(flow, 0, 0);
    expect(first).not.toBeNull();
    if (!first) return;
    expect(first.col).toBeGreaterThan(0);
    expect(first.row).toBeGreaterThan(0);

    const g = new Game();
    for (const t of wall) g.placeExact(t.col, t.row, "basic", 1);
    g.prepRemaining = 0;
    g.tick(0.05);
    const creep = g.creeps[0];
    creep.x = 0.5;
    creep.y = 0.5;
    for (let i = 0; i < 90; i++) g.tick(1 / 30);
    expect(creep.x).toBeGreaterThan(3);
    expect(creep.y).toBeLessThan(6.2);
  });

  it("blocks a corner-cut between two 2×2 cubes that only touch at a point", () => {
    const towers = [
      { col: 2, row: 2 },
      { col: 4, row: 4 },
    ];
    const blocked = blockedSet(towers);
    expect(canStep(3, 4, 1, -1, blocked)).toBe(false);
    expect(canStep(4, 3, -1, 1, blocked)).toBe(false);
    expect(canStep(1, 4, 0, -1, blocked)).toBe(true);

    const flow = computeFlow(towers);
    expect(flow.reachableFromSpawn).toBe(true);
    const pinch = flow.preview.some((t, i) => {
      const n = flow.preview[i + 1];
      if (!n) return false;
      const dc = n.col - t.col;
      const dr = n.row - t.row;
      return Math.abs(dc) === 1 && Math.abs(dr) === 1 && !canStep(t.col, t.row, dc, dr, blocked);
    });
    expect(pinch).toBe(false);
  });
});

describe("maze pathing", () => {
  it("routes through 1-tile gaps around 2×2 towers", () => {
    const g = new Game();
    g.placeExact(2, 8, "basic", 1);
    g.placeExact(5, 8, "basic", 1);
    const flow = computeFlow(g.towers);
    expect(flow.reachableFromSpawn).toBe(true);
    const gap = flow.preview.some((t) => t.col === 4 && t.row >= 8 && t.row <= 9);
    const around = flow.preview.some((t) => t.row >= 8 && t.row <= 9 && (t.col < 2 || t.col > 6));
    expect(gap || around).toBe(true);
    expect(flow.preview.some((t) => t.col >= 2 && t.col <= 3 && t.row >= 8 && t.row <= 9)).toBe(
      false,
    );
  });

  it("allows a placement that closes the last path", () => {
    const g = new Game();
    for (let c = 0; c <= 16; c += 2) {
      const r = g.placeExact(c, 10, "basic", 1);
      expect(r.ok).toBe(true);
    }
    expect(g.pathBlocked).toBe(false);
    const last = g.placeExact(18, 10, "basic", 1);
    expect(last.ok).toBe(true);
    if (last.ok) expect(last.blockedPath).toBe(true);
    expect(g.pathBlocked).toBe(true);
  });
});

describe("smash-through", () => {
  it("creeps walk a straight line, delete towers they cross, and do not refund gold", () => {
    const g = new Game();
    g.setCheat(true);
    for (let c = 0; c < COLS; c += 2) {
      expect(g.placeExact(c, 12, "basic", 1).ok).toBe(true);
    }
    expect(g.pathBlocked).toBe(true);
    expect(g.towers).toHaveLength(10);
    const goldBefore = g.gold;

    g.prepRemaining = 0;
    g.tick(0.05);
    expect(g.phase).toBe("wave");
    expect(g.creeps.length).toBeGreaterThan(0);
    expect(g.creeps.every((c) => c.smashing)).toBe(true);

    let destroyed = 0;
    for (let i = 0; i < 2000 && g.towers.length === 10; i++) {
      const before = g.towers.length;
      g.tick(1 / 30);
      if (g.towers.length < before) destroyed += before - g.towers.length;
    }
    expect(destroyed).toBeGreaterThan(0);
    expect(g.gold).toBe(goldBefore);
    expect(g.towers.length).toBeLessThan(10);
  });

  it("after a smash hole is punched, remaining creeps use the opened path", () => {
    const g = new Game();
    g.setCheat(true);
    for (let c = 0; c < COLS; c += 2) {
      g.placeExact(c, 10, "poison", 1);
    }
    g.prepRemaining = 0;
    g.tick(0.2);
    for (let i = 0; i < 1800 && g.pathBlocked; i++) g.tick(1 / 30);
    expect(g.pathBlocked).toBe(false);
    const stillSmashing = g.creeps.filter((c) => c.smashing).length;
    const living = g.creeps.length;
    if (living > 0) {
      expect(stillSmashing).toBe(0);
    }
    expect(g.gold).toBe(START_GOLD);
  });

  it("a leak including smash-through costs 1 life and 0 lives ends the run", () => {
    const g = new Game();
    g.setCheat(true);
    for (let c = 0; c < COLS; c += 2) g.placeExact(c, 4, "basic", 1);
    g.prepRemaining = 0;
    let sawLeak = false;
    for (let i = 0; i < 4000 && g.phase !== "over"; i++) {
      const lives = g.lives;
      g.tick(1 / 30);
      if (g.lives < lives) {
        sawLeak = true;
        expect(lives - g.lives).toBeGreaterThanOrEqual(1);
      }
    }
    expect(sawLeak).toBe(true);
    if (g.lives === 0) expect(g.phase).toBe("over");
  });

  it("does not refund the T1 cost of smashed towers", () => {
    const g = new Game();
    expect(g.cheat).toBe(false);
    for (let c = 0; c < COLS; c += 2) {
      g.placeExact(c, 8, "basic", 1);
    }
    expect(g.gold).toBe(START_GOLD - 10 * T1_COST);
    g.tick(4.1);
    g.prepRemaining = 0;
    g.tick(0.05);
    for (let i = 0; i < 2500 && g.towers.length === 10; i++) g.tick(1 / 30);
    expect(g.towers.length).toBeLessThan(10);
    expect(g.gold).toBeLessThan(START_GOLD + 10 * T1_COST);
  });
});
