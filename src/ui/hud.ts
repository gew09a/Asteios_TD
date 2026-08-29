import { TOWER_STATS, type TowerType } from "../game/config";
import type { Game } from "../game/game";
import type { Snapshot } from "../game/types";

const TYPES: TowerType[] = ["bolt", "frost", "venom"];

export function mountHud(root: HTMLElement, game: Game): void {
  root.innerHTML = `
    <div class="stat"><b>Gold</b><span data-k="gold">500</span></div>
    <div class="stat"><b>Lives</b><span data-k="lives">10</span></div>
    <div class="stat"><b>Wave</b><span data-k="wave">1</span></div>
    <div class="stat"><b>Timer</b><span data-k="timer">15s prep</span></div>
    <div class="stat"><b>Selected</b><span data-k="sel">Bolt T1 · 50g</span></div>
    <div class="picks" data-k="picks"></div>
    <button type="button" data-k="restart">Restart run</button>
    <button type="button" class="cheat" data-k="cheat">DEV cheat: OFF</button>
  `;

  const picks = root.querySelector("[data-k=picks]") as HTMLElement;
  for (const type of TYPES) {
    for (const tier of [1, 2] as const) {
      const stats = TOWER_STATS[type][tier];
      const btn = document.createElement("button");
      btn.className = type;
      btn.dataset.type = type;
      btn.dataset.tier = String(tier);
      btn.textContent = `${label(type)} T${tier} ${stats.cost}g`;
      btn.addEventListener("click", () => game.selectTower(type, tier));
      picks.appendChild(btn);
    }
  }

  root.querySelector("[data-k=restart]")?.addEventListener("click", () => game.restart());
  root.querySelector("[data-k=cheat]")?.addEventListener("click", () => game.toggleCheat());
}

export function bindKeys(game: Game): void {
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.key === "1") game.selectTower("bolt", game.selectedTier);
    if (e.key === "2") game.selectTower("frost", game.selectedTier);
    if (e.key === "3") game.selectTower("venom", game.selectedTier);
    if (e.key === "q" || e.key === "Q") game.selectTower(game.selectedType, 1);
    if (e.key === "w" || e.key === "W") game.selectTower(game.selectedType, 2);
    if (e.key === "r" || e.key === "R") game.restart();
  });
}

export function renderHud(root: HTMLElement, snap: Snapshot): void {
  set(root, "gold", snap.cheat ? "∞" : String(snap.gold));
  set(root, "lives", String(snap.lives));
  set(root, "wave", String(snap.wave));
  set(root, "timer", timerText(snap));
  set(
    root,
    "sel",
    `${label(snap.selectedType)} T${snap.selectedTier} · ${snap.selectedCost}g`,
  );

  const cheat = root.querySelector("[data-k=cheat]") as HTMLButtonElement;
  cheat.textContent = snap.cheat ? "DEV cheat: ON" : "DEV cheat: OFF";
  cheat.classList.toggle("on", snap.cheat);

  for (const btn of root.querySelectorAll<HTMLButtonElement>("[data-type]")) {
    const type = btn.dataset.type as TowerType;
    const tier = Number(btn.dataset.tier) as 1 | 2;
    btn.classList.toggle("selected", type === snap.selectedType && tier === snap.selectedTier);
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

function label(type: TowerType): string {
  return type[0].toUpperCase() + type.slice(1);
}

function set(root: HTMLElement, key: string, value: string): void {
  const el = root.querySelector(`[data-k="${key}"]`);
  if (el && el.textContent !== value) el.textContent = value;
}
