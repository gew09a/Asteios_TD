import { Game } from "./game/game";
import { BoardRenderer } from "./render/renderer";
import { bindKeys, mountHud, renderBanners, renderHud } from "./ui/hud";
import "./style.css";

const hud = document.querySelector<HTMLElement>("#hud")!;
const canvas = document.querySelector<HTMLCanvasElement>("#board")!;
const stage = document.querySelector<HTMLElement>("#stage")!;
const banner = document.querySelector<HTMLElement>("#banner")!;
const overlay = document.querySelector<HTMLElement>("#overlay")!;

const game = new Game();
(window as Window & { __asteios?: Game }).__asteios = game;
const view = new BoardRenderer(canvas);

mountHud(hud, game);
bindKeys(game);

function overlayBlocking(): boolean {
  return !overlay.hidden;
}

function onBoardPointer(e: PointerEvent): void {
  if (overlayBlocking()) {
    view.hideHover();
    return;
  }
  const tile = view.pickTile(e.clientX, e.clientY);
  if (!tile) {
    view.hideHover();
    return;
  }
  const valid = game.canPlaceAt(tile.col, tile.row) && game.canAfford(game.selectedCost);
  view.setHover(tile.col, tile.row, valid);
  if (e.type === "pointerdown" && e.button === 0) {
    e.preventDefault();
    game.tryPlace(tile.col, tile.row);
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
  renderBanners(banner, overlay, snap, () => game.restart());
  view.sync(snap);
  view.render();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
