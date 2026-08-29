import { Game } from "./game/game";
import { snapPlaceOrigin } from "./game/pathfinding";
import { BoardRenderer } from "./render/renderer";
import { bindKeys, mountHud, renderBanners, renderCubePop, renderHud } from "./ui/hud";
import "./style.css";

const hud = document.querySelector<HTMLElement>("#hud")!;
const canvas = document.querySelector<HTMLCanvasElement>("#board")!;
const stage = document.querySelector<HTMLElement>("#stage")!;
const banner = document.querySelector<HTMLElement>("#banner")!;
const cubePop = document.querySelector<HTMLElement>("#cube-pop")!;
const overlay = document.querySelector<HTMLElement>("#overlay")!;

const game = new Game();
(window as Window & { __asteios?: Game }).__asteios = game;
const view = new BoardRenderer(canvas);

mountHud(hud, game);
bindKeys(game);

cubePop.addEventListener("pointerdown", (e) => e.stopPropagation());
cubePop.addEventListener("pointermove", (e) => e.stopPropagation());

function overlayBlocking(): boolean {
  return !overlay.hidden;
}

function onBoardPointer(e: PointerEvent): void {
  if (overlayBlocking()) {
    view.hideHover();
    return;
  }
  const cell = view.pickCell(e.clientX, e.clientY);
  if (!cell) {
    view.hideHover();
    if (e.type === "pointerdown" && e.button === 0) game.clearInspect();
    return;
  }

  const existing = game.towerCovering(cell.col, cell.row);
  if (existing) {
    view.hideHover();
    if (e.type === "pointerdown" && e.button === 0) {
      e.preventDefault();
      game.inspectTower(existing.id);
    }
    return;
  }

  const place = snapPlaceOrigin(cell.col, cell.row);
  if (!place) {
    view.hideHover();
    return;
  }
  const valid = game.canPlaceAt(place.col, place.row) && game.canAfford(game.selectedCost);
  view.setHover(place.col, place.row, valid);
  if (e.type === "pointerdown" && e.button === 0) {
    e.preventDefault();
    game.clearInspect();
    game.tryPlace(place.col, place.row);
  }
}

stage.addEventListener("pointermove", onBoardPointer);
stage.addEventListener("pointerdown", onBoardPointer);
stage.addEventListener("pointerleave", () => view.hideHover());

window.addEventListener("resize", () => view.resize());

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.tick(dt);
  const snap = game.snapshot();
  renderHud(hud, snap);
  renderCubePop(cubePop, stage, view, game, snap);
  renderBanners(banner, overlay, snap, () => game.restart());
  view.sync(snap);
  view.render();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
