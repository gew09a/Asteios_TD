import {
  COLS,
  CREEP_SPEED,
  INTERWAVE_PREP_SECONDS,
  ROWS,
  START_GOLD,
  START_LIVES,
  TOWER_SIZE,
  TOWER_STATS,
  WAVE1_PREP_SECONDS,
  waveSpec,
  type TowerTier,
  type TowerType,
} from "./config";
import {
  blockedSet,
  computeFlow,
  inBounds,
  nextTileTowardExit,
  spawnTile,
  towerCovers,
  towerFits,
  towersOverlap,
  type FlowField,
} from "./pathfinding";
import type { Creep, Phase, PlaceResult, Shot, Snapshot, Tower } from "./types";

let nextId = 1;
function id(): number {
  return nextId++;
}

export class Game {
  gold = START_GOLD;
  lives = START_LIVES;
  wave = 1;
  phase: Phase = "prep";
  prepRemaining = WAVE1_PREP_SECONDS;
  cheat = false;

  selectedType: TowerType = "bolt";
  selectedTier: TowerTier = 1;

  towers: Tower[] = [];
  creeps: Creep[] = [];
  shots: Shot[] = [];

  private flow: FlowField = computeFlow([]);
  private toSpawn = 0;
  private spawnCooldown = 0;
  private waveGold = 0;
  private waveHp = 0;
  private spawnInterval = 0.55;

  constructor() {
    this.refreshFlow();
  }

  get pathBlocked(): boolean {
    return !this.flow.reachableFromSpawn;
  }

  get selectedCost(): number {
    return TOWER_STATS[this.selectedType][this.selectedTier].cost;
  }

  selectTower(type: TowerType, tier: TowerTier): void {
    this.selectedType = type;
    this.selectedTier = tier;
  }

  setCheat(on: boolean): void {
    this.cheat = on;
    if (on) {
      for (const t of this.towers) t.buildRemaining = 0;
    }
  }

  toggleCheat(): void {
    this.setCheat(!this.cheat);
  }

  /** Cheat-only helper: seal a mid-channel row so smash-through can be tested. */
  blockForSmashTest(): boolean {
    if (!this.cheat || this.phase === "over") return false;
    const prevType = this.selectedType;
    const prevTier = this.selectedTier;
    this.selectedType = "bolt";
    this.selectedTier = 1;
    let placed = 0;
    for (let col = 0; col < COLS; col += 2) {
      if (this.tryPlace(col, 14).ok) placed += 1;
    }
    this.selectedType = prevType;
    this.selectedTier = prevTier;
    return placed > 0;
  }

  restart(): void {
    const keepCheat = this.cheat;
    const type = this.selectedType;
    const tier = this.selectedTier;
    this.gold = START_GOLD;
    this.lives = START_LIVES;
    this.wave = 1;
    this.phase = "prep";
    this.prepRemaining = WAVE1_PREP_SECONDS;
    this.towers = [];
    this.creeps = [];
    this.shots = [];
    this.toSpawn = 0;
    this.spawnCooldown = 0;
    this.selectedType = type;
    this.selectedTier = tier;
    this.cheat = keepCheat;
    this.refreshFlow();
  }

  canAfford(cost: number): boolean {
    return this.cheat || this.gold >= cost;
  }

  canPlaceAt(col: number, row: number): boolean {
    if (this.phase === "over") return false;
    if (!towerFits(col, row)) return false;
    const ghost = { col, row };
    return !this.towers.some((t) => towersOverlap(t, ghost));
  }

  tryPlace(col: number, row: number): PlaceResult {
    if (this.phase === "over") return { ok: false, reason: "game-over" };
    if (!towerFits(col, row)) return { ok: false, reason: "out-of-bounds" };
    const ghost = { col, row };
    if (this.towers.some((t) => towersOverlap(t, ghost))) {
      return { ok: false, reason: "overlap" };
    }
    const stats = TOWER_STATS[this.selectedType][this.selectedTier];
    if (!this.canAfford(stats.cost)) return { ok: false, reason: "no-gold" };
    if (!this.cheat) this.gold -= stats.cost;

    const buildTotal = this.cheat ? 0 : stats.buildSeconds;
    const tower: Tower = {
      id: id(),
      type: this.selectedType,
      tier: this.selectedTier,
      col,
      row,
      buildRemaining: buildTotal,
      buildTotal: stats.buildSeconds,
      cooldown: 0,
    };
    this.towers.push(tower);
    this.refreshFlow();
    if (this.pathBlocked) this.beginSmash();
    return { ok: true, blockedPath: this.pathBlocked, tower };
  }

  /** Test helper: place a specific type/tier without changing the player's selection. */
  placeExact(col: number, row: number, type: TowerType, tier: TowerTier): PlaceResult {
    const prevType = this.selectedType;
    const prevTier = this.selectedTier;
    this.selectedType = type;
    this.selectedTier = tier;
    const result = this.tryPlace(col, row);
    this.selectedType = prevType;
    this.selectedTier = prevTier;
    return result;
  }

  tick(dt: number): void {
    if (dt <= 0) return;
    if (this.phase === "over") {
      this.ageShots(dt);
      return;
    }

    this.progressBuilds(dt);
    this.tickPhase(dt);
    this.tickDots(dt);
    this.tickTowers(dt);
    this.tickCreeps(dt);
    this.ageShots(dt);
    this.cullDead();
    this.maybeFinishWave();
  }

  snapshot(): Snapshot {
    return {
      gold: this.gold,
      lives: this.lives,
      wave: this.wave,
      phase: this.phase,
      prepRemaining: this.prepRemaining,
      creepsAlive: this.creeps.length,
      creepsRemainingInWave: this.toSpawn,
      selectedType: this.selectedType,
      selectedTier: this.selectedTier,
      selectedCost: this.selectedCost,
      cheat: this.cheat,
      pathBlocked: this.pathBlocked,
      towers: this.towers,
      creeps: this.creeps,
      shots: this.shots,
      pathPreview: this.flow.preview,
    };
  }

  private refreshFlow(): void {
    this.flow = computeFlow(this.towers);
  }

  private progressBuilds(dt: number): void {
    for (const t of this.towers) {
      if (t.buildRemaining <= 0) continue;
      t.buildRemaining = this.cheat ? 0 : Math.max(0, t.buildRemaining - dt);
    }
  }

  private tickPhase(dt: number): void {
    if (this.phase === "prep") {
      this.prepRemaining = Math.max(0, this.prepRemaining - dt);
      if (this.prepRemaining <= 0) this.startWave();
    }
    if (this.phase === "wave" && this.toSpawn > 0) {
      this.spawnCooldown -= dt;
      while (this.toSpawn > 0 && this.spawnCooldown <= 0) {
        this.spawnCreep();
        this.toSpawn -= 1;
        this.spawnCooldown += this.spawnInterval;
      }
    }
  }

  private startWave(): void {
    const spec = waveSpec(this.wave);
    this.phase = "wave";
    this.toSpawn = spec.count;
    this.waveHp = spec.hp;
    this.waveGold = spec.gold;
    this.spawnInterval = spec.interval;
    this.spawnCooldown = 0;
    this.refreshFlow();
    if (this.pathBlocked) this.beginSmash();
  }

  private spawnCreep(): void {
    const blocked = blockedSet(this.towers);
    const tile = spawnTile(this.flow, blocked);
    const smash = this.pathBlocked;
    this.creeps.push({
      id: id(),
      x: tile.col + 0.5,
      y: tile.row + 0.5,
      hp: this.waveHp,
      maxHp: this.waveHp,
      bounty: this.waveGold,
      slowRemaining: 0,
      slowFactor: 1,
      dotRemaining: 0,
      dotDps: 0,
      smashing: smash,
    });
  }

  private beginSmash(): void {
    for (const c of this.creeps) c.smashing = true;
  }

  private clearSmashIfPathOpen(): void {
    if (this.pathBlocked) return;
    for (const c of this.creeps) c.smashing = false;
  }

  private tickDots(dt: number): void {
    for (const c of this.creeps) {
      if (c.dotRemaining <= 0) continue;
      const step = Math.min(dt, c.dotRemaining);
      c.hp -= c.dotDps * step;
      c.dotRemaining -= step;
      if (c.dotRemaining <= 0) c.dotDps = 0;
    }
  }

  private tickTowers(dt: number): void {
    for (const t of this.towers) {
      if (t.buildRemaining > 0) continue;
      t.cooldown = Math.max(0, t.cooldown - dt);
      if (t.cooldown > 0) continue;
      const stats = TOWER_STATS[t.type][t.tier];
      const cx = t.col + TOWER_SIZE / 2;
      const cy = t.row + TOWER_SIZE / 2;
      const target = this.pickTarget(cx, cy, stats.range);
      if (!target) continue;
      t.cooldown = stats.interval;
      this.fire(t, target, cx, cy);
    }
  }

  private pickTarget(cx: number, cy: number, range: number): Creep | null {
    let best: Creep | null = null;
    let bestScore = -Infinity;
    const r2 = range * range;
    for (const c of this.creeps) {
      if (c.hp <= 0) continue;
      const dx = c.x - cx;
      const dy = c.y - cy;
      if (dx * dx + dy * dy > r2) continue;
      const towardExit = c.y;
      if (towardExit > bestScore) {
        bestScore = towardExit;
        best = c;
      }
    }
    return best;
  }

  private fire(tower: Tower, creep: Creep, cx: number, cy: number): void {
    const stats = TOWER_STATS[tower.type][tower.tier];
    creep.hp -= stats.damage;
    if (stats.slowFactor !== undefined && stats.slowSeconds !== undefined) {
      creep.slowFactor = stats.slowFactor;
      creep.slowRemaining = stats.slowSeconds;
    }
    if (stats.dotDps !== undefined && stats.dotSeconds !== undefined) {
      creep.dotDps = stats.dotDps;
      creep.dotRemaining = stats.dotSeconds;
    }
    const color =
      tower.type === "bolt" ? 0xe8b84a : tower.type === "frost" ? 0x5ec8e8 : 0x7dce6a;
    this.shots.push({
      id: id(),
      x0: cx,
      y0: cy,
      x1: creep.x,
      y1: creep.y,
      color,
      ttl: 0.12,
    });
  }

  private tickCreeps(dt: number): void {
    const blocked = blockedSet(this.towers);
    for (const c of this.creeps) {
      if (c.hp <= 0) continue;
      if (c.slowRemaining > 0) {
        c.slowRemaining = Math.max(0, c.slowRemaining - dt);
        if (c.slowRemaining <= 0) c.slowFactor = 1;
      }
      const speed = CREEP_SPEED * (c.slowRemaining > 0 ? c.slowFactor : 1);
      this.advanceCreep(c, speed * dt, blocked);
      if (c.hp <= 0) continue;
      if (c.y >= ROWS - 0.05) {
        this.leak(c);
      }
    }
  }

  private advanceCreep(c: Creep, step: number, blocked: boolean[][]): void {
    let remaining = step;
    for (let guard = 0; guard < 8 && remaining > 1e-6; guard++) {
      if (c.smashing || this.pathBlocked) {
        c.smashing = true;
        remaining = this.stepSmash(c, remaining, blocked);
        continue;
      }
      remaining = this.stepPath(c, remaining);
    }
  }

  private stepPath(c: Creep, remaining: number): number {
    const col = clampTile(Math.floor(c.x), COLS);
    const row = clampTile(Math.floor(c.y), ROWS);
    const next = nextTileTowardExit(this.flow, col, row);
    const target = next
      ? { x: next.col + 0.5, y: next.row + 0.5 }
      : { x: c.x, y: ROWS + 0.5 };
    return this.stepToward(c, target.x, target.y, remaining);
  }

  private stepSmash(c: Creep, remaining: number, blocked: boolean[][]): number {
    const tx = Math.floor(c.x) + 0.5;
    const ty = ROWS + 0.5;
    const used = this.stepToward(c, tx, ty, remaining);
    this.smashTowersUnder(c, blocked);
    return used;
  }

  private stepToward(c: Creep, tx: number, ty: number, remaining: number): number {
    const dx = tx - c.x;
    const dy = ty - c.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 1e-6) {
      c.x = tx;
      c.y = ty;
      return remaining;
    }
    if (dist <= remaining) {
      c.x = tx;
      c.y = ty;
      return remaining - dist;
    }
    c.x += (dx / dist) * remaining;
    c.y += (dy / dist) * remaining;
    return 0;
  }

  private smashTowersUnder(c: Creep, blocked: boolean[][]): void {
    const col = clampTile(Math.floor(c.x), COLS);
    const row = clampTile(Math.floor(c.y), ROWS);
    if (!inBounds(col, row) || !blocked[col][row]) return;
    const victim = this.towers.find((t) => towerCovers(t, col, row));
    if (!victim) return;
    this.towers = this.towers.filter((t) => t.id !== victim.id);
    this.refreshFlow();
    this.clearSmashIfPathOpen();
  }

  private leak(c: Creep): void {
    c.hp = 0;
    c.bounty = 0;
    this.lives -= 1;
    if (this.lives <= 0) {
      this.lives = 0;
      this.phase = "over";
    }
  }

  private cullDead(): void {
    const living: Creep[] = [];
    for (const c of this.creeps) {
      if (c.hp > 0) {
        living.push(c);
        continue;
      }
      if (c.bounty > 0 && this.phase !== "over") {
        if (!this.cheat) this.gold += c.bounty;
      }
    }
    this.creeps = living;
  }

  private maybeFinishWave(): void {
    if (this.phase !== "wave") return;
    if (this.toSpawn > 0 || this.creeps.length > 0) return;
    this.wave += 1;
    this.phase = "prep";
    this.prepRemaining = INTERWAVE_PREP_SECONDS;
    this.refreshFlow();
  }

  private ageShots(dt: number): void {
    this.shots = this.shots.filter((s) => {
      s.ttl -= dt;
      return s.ttl > 0;
    });
  }
}

function clampTile(v: number, max: number): number {
  return Math.max(0, Math.min(max - 1, v));
}
