import { T2_UPGRADE_COST, TOWER_TYPES, TYPE_LABEL, type TowerType } from "../game/config";
import type { Game } from "../game/game";
import type { Snapshot } from "../game/types";
import type { BoardRenderer } from "../render/renderer";

export function mountHud(root: HTMLElement, game: Game): void {
  root.innerHTML = `
    <div class="stat"><b>Gold</b><span data-k="gold">500</span></div>
    <div class="stat"><b>Lives</b><span data-k="lives">10</span></div>
    <div class="stat"><b>Wave</b><span data-k="wave">1</span></div>
    <div class="stat"><b>Timer</b><span data-k="timer">15s prep</span></div>
    <div class="stat"><b>Place</b><span data-k="sel">Basic · 50g</span></div>
    <p class="hint">Click empty tiles to place. Click a cube to upgrade or sell.</p>
    <div class="picks" data-k="picks"></div>
    <button type="button" data-k="restart">Restart run</button>
    <button type="button" class="cheat" data-k="cheat">DEV cheat: OFF</button>
  `;

  const picks = root.querySelector("[data-k=picks]") as HTMLElement;
  for (const type of TOWER_TYPES) {
    const btn = document.createElement("button");
    btn.className = type;
    btn.dataset.type = type;
    btn.textContent = `${TYPE_LABEL[type]} 50g`;
    btn.addEventListener("click", () => game.selectType(type));
    picks.appendChild(btn);
  }

  root.querySelector("[data-k=restart]")?.addEventListener("click", () => game.restart());
  root.querySelector("[data-k=cheat]")?.addEventListener("click", () => game.toggleCheat());
}

export function bindKeys(game: Game): void {
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    const map: Record<string, TowerType> = {
      "1": "basic",
      "2": "sniper",
      "3": "slow",
      "4": "poison",
      "5": "splash",
      "6": "haste",
    };
    if (map[e.key]) game.selectType(map[e.key]);
    if (e.key === "r" || e.key === "R") game.restart();
    if ((e.key === "b" || e.key === "B") && game.cheat) game.blockForSmashTest();
    if (e.key === "Escape") game.clearInspect();
  });
}

export function renderHud(root: HTMLElement, snap: Snapshot): void {
  set(root, "gold", snap.cheat ? "∞" : String(snap.gold));
  set(root, "lives", String(snap.lives));
  set(root, "wave", String(snap.wave));
  set(root, "timer", timerText(snap));
  set(root, "sel", `${TYPE_LABEL[snap.selectedType]} · ${snap.selectedCost}g`);

  const cheat = root.querySelector("[data-k=cheat]") as HTMLButtonElement;
  cheat.textContent = snap.cheat ? "DEV cheat: ON" : "DEV cheat: OFF";
  cheat.classList.toggle("on", snap.cheat);

  for (const btn of root.querySelectorAll<HTMLButtonElement>("[data-type]")) {
    btn.classList.toggle("selected", btn.dataset.type === snap.selectedType);
  }
}

let popKey = "";

export function renderCubePop(
  pop: HTMLElement,
  stage: HTMLElement,
  view: BoardRenderer,
  game: Game,
  snap: Snapshot,
): void {
  const tower = snap.inspectId === null ? null : snap.towers.find((t) => t.id === snap.inspectId);
  if (!tower || snap.phase === "over") {
    pop.hidden = true;
    pop.innerHTML = "";
    popKey = "";
    return;
  }

  const canUp = game.canUpgrade(tower);
  const key = `${tower.id}:${tower.tier}:${tower.spent}:${canUp ? 1 : 0}`;
  if (key !== popKey) {
    popKey = key;
    pop.hidden = false;
    pop.innerHTML = `
      <strong>${TYPE_LABEL[tower.type]} T${tower.tier}</strong>
      <button type="button" data-k="up" ${canUp ? "" : "disabled"}>Upgrade +${T2_UPGRADE_COST}</button>
      <button type="button" data-k="sell">Sell ${tower.spent}</button>
    `;
    pop.querySelector("[data-k=up]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      game.tryUpgrade(tower.id);
    });
    pop.querySelector("[data-k=sell]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      game.trySell(tower.id);
    });
  }

  const pos = view.worldToStage(tower.col, tower.row, stage);
  if (pos) {
    pop.style.left = `${Math.min(stage.clientWidth - 148, Math.max(8, pos.x - 20))}px`;
    pop.style.top = `${Math.min(stage.clientHeight - 110, Math.max(8, pos.y - 70))}px`;
  }
}

export function renderBanners(
  banner: HTMLElement,
  overlay: HTMLElement,
  snap: Snapshot,
  onRestart: () => void,
): void {
  if (snap.pathBlocked && snap.phase !== "over") {
    banner.hidden = false;
    banner.textContent = "PATH BLOCKED — smash-through (no refund)";
  } else {
    banner.hidden = true;
  }

  const showing = overlay.dataset.over === "1";
  if (snap.phase === "over" && !showing) {
    overlay.hidden = false;
    overlay.dataset.over = "1";
    overlay.innerHTML = `
      <div class="card">
        <h2>Run over</h2>
        <p>0 lives. No persist — restart a fresh run.</p>
        <button type="button" data-k="over-restart">Restart run</button>
      </div>
    `;
    overlay.querySelector("[data-k=over-restart]")?.addEventListener("click", onRestart);
  } else if (snap.phase !== "over" && showing) {
    overlay.hidden = true;
    overlay.dataset.over = "0";
    overlay.innerHTML = "";
  }
}

function timerText(snap: Snapshot): string {
  if (snap.phase === "over") return "ended";
  if (snap.phase === "prep") return `${snap.prepRemaining.toFixed(1)}s prep`;
  const left = snap.creepsAlive + snap.creepsRemainingInWave;
  return `fighting · ${left} left`;
}

function set(root: HTMLElement, key: string, value: string): void {
  const el = root.querySelector(`[data-k="${key}"]`);
  if (el && el.textContent !== value) el.textContent = value;
}
