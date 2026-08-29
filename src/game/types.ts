import type { TowerTier, TowerType } from "./config";

export type { TowerTier, TowerType };

export type Phase = "prep" | "wave" | "over";

export interface Tower {
  id: number;
  type: TowerType;
  tier: TowerTier;
  col: number;
  row: number;
  spent: number;
  buildRemaining: number;
  buildTotal: number;
  cooldown: number;
}

export interface Creep {
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  bounty: number;
  armor: number;
  slowRemaining: number;
  slowFactor: number;
  dotRemaining: number;
  dotDps: number;
  smashing: boolean;
}

export interface Shot {
  id: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: number;
  ttl: number;
}

export interface Tile {
  col: number;
  row: number;
}

export type PlaceFail =
  | "out-of-bounds"
  | "overlap"
  | "no-gold"
  | "game-over"
  | "no-selection";

export type PlaceResult =
  | { ok: true; blockedPath: boolean; tower: Tower }
  | { ok: false; reason: PlaceFail };

export interface Snapshot {
  gold: number;
  lives: number;
  wave: number;
  phase: Phase;
  prepRemaining: number;
  creepsAlive: number;
  creepsRemainingInWave: number;
  selectedType: TowerType;
  selectedCost: number;
  inspectId: number | null;
  cheat: boolean;
  pathBlocked: boolean;
  towers: Tower[];
  creeps: Creep[];
  shots: Shot[];
  pathPreview: Tile[];
}
