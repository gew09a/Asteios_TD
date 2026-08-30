import { COLS, ROWS, TOWER_SIZE } from "./config";
import type { Tile, Tower } from "./types";

const CARD: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 0],
  [-1, 0],
  [0, -1],
];

const DIAG: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

export function inBounds(col: number, row: number): boolean {
  return col >= 0 && col < COLS && row >= 0 && row < ROWS;
}

export function towerFits(col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col + TOWER_SIZE <= COLS && row + TOWER_SIZE <= ROWS;
}

/** Clamp a clicked tile to a legal 2×2 origin, or null if off the channel. */
export function snapPlaceOrigin(col: number, row: number): { col: number; row: number } | null {
  if (!inBounds(col, row)) return null;
  return {
    col: Math.min(col, COLS - TOWER_SIZE),
    row: Math.min(row, ROWS - TOWER_SIZE),
  };
}

export function towerCovers(tower: Pick<Tower, "col" | "row">, col: number, row: number): boolean {
  return (
    col >= tower.col &&
    col < tower.col + TOWER_SIZE &&
    row >= tower.row &&
    row < tower.row + TOWER_SIZE
  );
}

export function towersOverlap(
  a: Pick<Tower, "col" | "row">,
  b: Pick<Tower, "col" | "row">,
): boolean {
  return !(
    a.col + TOWER_SIZE <= b.col ||
    b.col + TOWER_SIZE <= a.col ||
    a.row + TOWER_SIZE <= b.row ||
    b.row + TOWER_SIZE <= a.row
  );
}

export function blockedSet(towers: readonly Pick<Tower, "col" | "row">[]): boolean[][] {
  const blocked = Array.from({ length: COLS }, () => Array<boolean>(ROWS).fill(false));
  for (const t of towers) {
    for (let dc = 0; dc < TOWER_SIZE; dc++) {
      for (let dr = 0; dr < TOWER_SIZE; dr++) {
        const c = t.col + dc;
        const r = t.row + dr;
        if (inBounds(c, r)) blocked[c][r] = true;
      }
    }
  }
  return blocked;
}

export function tileKey(col: number, row: number): number {
  return row * COLS + col;
}

export interface FlowField {
  /** Next walkable tile toward the exit, or null if this tile cannot reach. */
  next: Array<Tile | null>;
  dist: Float64Array;
  reachableFromSpawn: boolean;
  /** One shortest path from a spawn-edge tile to an exit-edge tile. */
  preview: Tile[];
}

/**
 * Diagonal is legal only if both orthogonal adjacent tiles are walkable.
 * Two 2×2 cubes that meet at a point cannot be squeezed through.
 */
export function canStep(
  col: number,
  row: number,
  dc: number,
  dr: number,
  blocked: boolean[][],
): boolean {
  const nc = col + dc;
  const nr = row + dr;
  if (!inBounds(nc, nr) || blocked[nc][nr]) return false;
  if (dc !== 0 && dr !== 0) {
    if (!inBounds(col + dc, row) || !inBounds(col, row + dr)) return false;
    if (blocked[col + dc][row] || blocked[col][row + dr]) return false;
  }
  return true;
}

export interface Step extends Tile {
  cost: number;
}

export function walkableSteps(col: number, row: number, blocked: boolean[][], out: Step[]): void {
  out.length = 0;
  for (const [dc, dr] of CARD) {
    if (canStep(col, row, dc, dr, blocked)) out.push({ col: col + dc, row: row + dr, cost: 1 });
  }
  for (const [dc, dr] of DIAG) {
    if (canStep(col, row, dc, dr, blocked)) {
      out.push({ col: col + dc, row: row + dr, cost: Math.SQRT2 });
    }
  }
}

/** Octile Dijkstra from every walkable exit-edge tile. Cardinals are tried first so ties stay straight. */
export function computeFlow(towers: readonly Pick<Tower, "col" | "row">[]): FlowField {
  const blocked = blockedSet(towers);
  const total = COLS * ROWS;
  const next: Array<Tile | null> = Array.from({ length: total }, () => null);
  const dist = new Float64Array(total);
  dist.fill(Infinity);

  const heap: number[] = [];

  const push = (k: number): void => {
    heap.push(k);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (dist[heap[p]] <= dist[heap[i]]) break;
      const tmp = heap[p];
      heap[p] = heap[i];
      heap[i] = tmp;
      i = p;
    }
  };

  const pop = (): number => {
    const root = heap[0];
    const last = heap.pop();
    if (heap.length === 0 || last === undefined) return root;
    heap[0] = last;
    let i = 0;
    for (;;) {
      const l = i * 2 + 1;
      const r = l + 1;
      let s = i;
      if (l < heap.length && dist[heap[l]] < dist[heap[s]]) s = l;
      if (r < heap.length && dist[heap[r]] < dist[heap[s]]) s = r;
      if (s === i) break;
      const tmp = heap[s];
      heap[s] = heap[i];
      heap[i] = tmp;
      i = s;
    }
    return root;
  };

  for (let c = 0; c < COLS; c++) {
    if (!blocked[c][ROWS - 1]) {
      const k = tileKey(c, ROWS - 1);
      dist[k] = 0;
      push(k);
    }
  }

  const neigh: Step[] = [];
  while (heap.length > 0) {
    const cur = pop();
    const col = cur % COLS;
    const row = (cur / COLS) | 0;
    walkableSteps(col, row, blocked, neigh);
    for (const n of neigh) {
      const nk = tileKey(n.col, n.row);
      const nd = dist[cur] + n.cost;
      if (nd + 1e-9 < dist[nk]) {
        dist[nk] = nd;
        next[nk] = { col, row };
        push(nk);
      }
    }
  }

  const bestSpawn = pickSpawnKey(blocked, dist);
  const bestDist = bestSpawn >= 0 ? dist[bestSpawn] : Infinity;

  const preview: Tile[] = [];
  if (bestSpawn >= 0 && Number.isFinite(bestDist)) {
    let k = bestSpawn;
    const guard = COLS * ROWS + 2;
    for (let i = 0; i < guard; i++) {
      const col = k % COLS;
      const row = (k / COLS) | 0;
      preview.push({ col, row });
      if (row === ROWS - 1) break;
      const step = next[k];
      if (!step) break;
      k = tileKey(step.col, step.row);
    }
  }

  return {
    next,
    dist,
    reachableFromSpawn: bestSpawn >= 0 && Number.isFinite(bestDist),
    preview,
  };
}

const CENTER = COLS / 2;

/** Shortest spawn-edge tile; ties break toward the channel center. */
export function pickSpawnKey(blocked: boolean[][], dist: ArrayLike<number>): number {
  let best = -1;
  let bestDist = Infinity;
  let bestCenter = Infinity;
  for (let c = 0; c < COLS; c++) {
    if (blocked[c][0]) continue;
    const k = tileKey(c, 0);
    const d = dist[k];
    const center = Math.abs(c - CENTER);
    if (d < bestDist - 1e-9 || (Math.abs(d - bestDist) <= 1e-9 && center < bestCenter)) {
      bestDist = d;
      bestCenter = center;
      best = k;
    }
  }
  return best;
}

export function spawnTile(flow: FlowField, blocked: boolean[][]): Tile {
  const k = pickSpawnKey(blocked, flow.dist);
  if (k < 0) return { col: (COLS / 2) | 0, row: 0 };
  return { col: k % COLS, row: 0 };
}

export function nextTileTowardExit(flow: FlowField, col: number, row: number): Tile | null {
  if (!inBounds(col, row)) return null;
  return flow.next[tileKey(col, row)];
}
